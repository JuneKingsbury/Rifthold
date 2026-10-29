/**
 * Crafting orders and auto-production: computes which recipes are currently
 * available (cached, see below), queues craft tasks, and runs the auto-cook /
 * auto-craft passes. updateAutoCook and updateAutoCraft are called from
 * simulationTick every 10th tick; queueCraftingOrder is player-driven.
 */
import { RECIPES, WORK_CONFIG, ENCHANT_COST_BY_TIER } from '../core/config.js';
import { getEquippedItems } from '../entities/colonist.js';

// Cached recipe availability. Availability depends only on research, the stock of
// recipe inputs, which station types exist and grid power, so the cache is keyed
// by a cheap signature of exactly those (plus game._recipeCacheVersion for
// explicit invalidation) and rebuilt only when one of them really changes.
let _recipeCache = null;
let _recipeCacheKey = null;
let _recipeInputs = null;   // { resources: string[], stations: string[] }, from RECIPES

export function invalidateRecipeCache() {
    _recipeCacheKey = null;
    _recipeInputs = null;
}

function recipeCacheKey(game) {
    if (!_recipeInputs) {
        const resources = new Set();
        const stations = new Set(['enchanting_table']);
        for (const recipe of Object.values(RECIPES)) {
            for (const res of Object.keys(recipe.input || {})) resources.add(res);
            if (recipe.station) stations.add(recipe.station);
        }
        _recipeInputs = { resources: [...resources], stations: [...stations] };
    }
    const stock = game.resources.stockpile;
    const parts = [game._recipeCacheVersion || 0, game.research.completed.size, game.power.hasPower() ? 1 : 0];
    for (const st of _recipeInputs.stations) parts.push(game.mapIndex.getStructurePositions(st).size > 0 ? 1 : 0);
    for (const res of _recipeInputs.resources) parts.push(res === 'foodstuffs' ? game.resources.getFoodstuffTotal() : (stock[res] || 0));
    return parts.join(',');
}

function isRecipeResearched(game, research) {
    if (Array.isArray(research)) return research.every(r => game.research.isResearched(r));
    return game.research.isResearched(research);
}

export function queueCraftingOrder(game, recipeKey) {
    const recipe = RECIPES[recipeKey];
    if (!recipe) return false;
    if (recipe.research && !isRecipeResearched(game, recipe.research)) return false;
    if (!game.resources.has(recipe.input)) return false;

    const stationType = recipe.station;
    const station = findAvailableStation(game, stationType);
    if (!station) return false;

    game.resources.deduct(recipe.input);

    let workAmount = recipe.ticks;
    if (stationType === 'workbench' && station.powered) {
        workAmount = Math.ceil(workAmount / WORK_CONFIG.poweredWorkbenchDivisor);
    }

    game.taskQueue.add({
        type: recipe.skill === 'cooking' ? 'cook' : 'craft',
        skillRequired: recipe.skill,
        x: station.x,
        y: station.y,
        workAmount,
        recipe,
    });

    return true;
}

export function queueEnchantingOrder(game, itemKey, itemQuality, itemType, itemTier) {
    const station = findAvailableStation(game, 'enchanting_table');
    if (!station) return 'No enchanting table has been built.';
    if (!station.powered) return 'The enchanting table needs power.';
    const cost = ENCHANT_COST_BY_TIER[itemTier] ?? { resource: 'runite', amount: 5 };
    if (!game.resources.has({ [cost.resource]: cost.amount })) return `Not enough ${cost.resource.replace(/_/g, ' ')} (need ${cost.amount}).`;
    game.resources.deduct({ [cost.resource]: cost.amount });

    let workAmount = 100; // Base work amount for enchanting.

    game.taskQueue.add({
        type: 'enchant',
        skillRequired: 'crafting',
        x: station.x,
        y: station.y,
        workAmount,
        itemKey,
        itemQuality,
        itemType
    });

    return true;
}

function findAvailableStation(game, stationType) {
    let usePowered = stationType === 'workbench' && game.research.isResearched('arcane_infusion') && game.power.hasPower();

    const pendingTasks = game.taskQueue.getAll().filter(t => t.type === 'craft' || t.type === 'cook' || t.type === 'enchant');
    const taskCountAt = (x, y) => pendingTasks.filter(t => t.x === x && t.y === y).length;

    if (stationType === 'enchanting_table' || usePowered) {
        const stations = game.mapIndex.findAll('enchanting_table');
        let best = null, bestCount = Infinity;
        // Enchanting tables draw grid mana, so they only count as powered while
        // the grid is net-positive.
        const powered = game.power.hasPower();
        for (const { x, y } of stations) {
            const count = taskCountAt(x, y);
            if (count < bestCount) { best = { x, y, powered }; bestCount = count; }
        }
        if (best) return best;
    }

    const stations = game.mapIndex.findAll(stationType);
    let best = null, bestCount = Infinity;
    for (const { x, y } of stations) {
        const count = taskCountAt(x, y);
        if (count < bestCount) { best = { x, y, powered: false }; bestCount = count; }
    }
    return best;
}

export function getAvailableRecipes(game) {
    const key = recipeCacheKey(game);
    if (_recipeCache && _recipeCacheKey === key) return _recipeCache;

    const available = [];
    for (const [key, recipe] of Object.entries(RECIPES)) {
        if (recipe.research && !isRecipeResearched(game, recipe.research)) continue;
        const hasResources = game.resources.has(recipe.input);
        const hasStation = findAvailableStation(game, recipe.station) !== null;
        available.push({ key, recipe, hasResources, hasStation, canCraft: hasResources && hasStation });
    }
    _recipeCache = available;
    _recipeCacheKey = key;
    return available;
}

export function updateAutoCook(game) {
    const target = game.settings.autoCookTarget || 0;
    if (target <= 0) return;

    const recipe = RECIPES.cook_meal;
    if (!recipe) return;
    if (!findAvailableStation(game, recipe.station)) return;

    const currentFood = game.resources.stockpile.food || 0;
    const pendingCookTasks = game.taskQueue.getAll().filter(t => t.type === 'cook').length;
    const expectedFood = currentFood + pendingCookTasks * recipe.output.food;

    if (expectedFood < target && game.resources.has(recipe.input)) {
        queueCraftingOrder(game, 'cook_meal');
    }
}

// Count items matching `outputKey` currently equipped by colonists, so the
// auto-craft stock target isn't refilled just because gear moved from the store
// onto a colonist. Equipped weapon/armor/helmet/tool/trinket/boots are the same
// objects taken from the store arrays, so they keep their `.key`. Tomes are
// tracked separately as the `equippedTome` key string.
function countEquipped(game, outputKey) {
    let count = 0;
    for (const c of game.colonists) {
        for (const item of getEquippedItems(c)) {
            if (item.key === outputKey) count++;
        }
        if (c.equippedTome === outputKey) count++;
    }
    return count;
}

export function updateAutoCraft(game) {
    const targets = game.settings.craftTargets;
    if (!targets) return;

    for (const [recipeKey, config] of Object.entries(targets)) {
        if (!config.repeat && !config.target) continue;
        if (recipeKey === 'cook_meal' && game.settings.autoCookTarget > 0) continue;

        const recipe = RECIPES[recipeKey];
        if (!recipe) continue;
        if (recipe.research && !isRecipeResearched(game, recipe.research)) continue;
        if (!findAvailableStation(game, recipe.station)) continue;
        if (!game.resources.has(recipe.input)) continue;

        const outputKey = Object.keys(recipe.output)[0];
        const pendingForRecipe = game.taskQueue.getAll().filter(t =>
            (t.type === 'craft' || t.type === 'cook') && t.recipe &&
            Object.keys(t.recipe.output)[0] === outputKey
        ).length;

        let shouldQueue = false;
        if (config.target > 0) {
            // Count everything the colony holds toward the target, not just the
            // stockpile: crafted gear/potions/tomes are stored in typed arrays
            // (never in stockpile), and gear a colonist has equipped has left the
            // store arrays entirely. Omitting either made `current` read 0 for
            // those recipes, so the target was never satisfied and we crafted
            // forever past it.
            const current = game.resources.countItem(outputKey) + countEquipped(game, outputKey);
            const expected = current + pendingForRecipe * (recipe.output[outputKey] || 1);
            shouldQueue = expected < config.target;
        } else if (config.repeat) {
            shouldQueue = pendingForRecipe === 0;
        }

        if (shouldQueue) queueCraftingOrder(game, recipeKey);
    }
}
