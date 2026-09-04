/**
 * Crafting orders and auto-production: computes which recipes are currently
 * available (cached, see below), queues craft tasks, and runs the auto-cook /
 * auto-craft passes. updateAutoCook and updateAutoCraft are called from
 * simulationTick every 10th tick; queueCraftingOrder is player-driven.
 */
import { RECIPES, WORK_CONFIG, ENCHANT_COST_BY_TIER } from '../core/config.js';
import { getEquippedItems } from '../entities/colonist.js';

// Cached recipe availability. Invalidated when resources, research, structures,
// or the task queue change. Uses a version counter on game to detect staleness.
let _recipeCache = null;
let _recipeCacheVersion = -1;

export function invalidateRecipeCache() {
    _recipeCacheVersion = -1;
}

export function queueCraftingOrder(game, recipeKey) {
    const recipe = RECIPES[recipeKey];
    if (!recipe) return false;
    if (recipe.research && !game.research.isResearched(recipe.research)) return false;
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

    _recipeCacheVersion = -1;
    return true;
}

export function queueEnchantingOrder(game, itemKey, itemQuality, itemType, itemTier) {
    const station = findAvailableStation(game, 'enchanting_table');
    if (!station) return 'No enchanting table has been built.';
    if (!station.powered) return 'The enchanting table needs power.';
    const cost = ENCHANT_COST_BY_TIER[itemTier] ?? { resource: 'runite', amount: 5 };
    if (!game.resources.has({ [cost.resource]: cost.amount })) return `Not enough ${cost.resource.replace(/_/g, ' ')} (need ${cost.amount}).`;
    game.resources.deduct({ [cost.resource]: cost.amount });

    let workAmount = 100; // Base work amount for enchanting, can be adjusted as needed.

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
        for (const { x, y } of stations) {
            const count = taskCountAt(x, y);
            if (count < bestCount) { best = { x, y, powered: true }; bestCount = count; }
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
    const version = game._recipeCacheVersion || 0;
    if (_recipeCache && _recipeCacheVersion === version) return _recipeCache;

    const available = [];
    for (const [key, recipe] of Object.entries(RECIPES)) {
        if (recipe.research && !game.research.isResearched(recipe.research)) continue;
        const hasResources = game.resources.has(recipe.input);
        const hasStation = findAvailableStation(game, recipe.station) !== null;
        available.push({ key, recipe, hasResources, hasStation, canCraft: hasResources && hasStation });
    }
    _recipeCache = available;
    _recipeCacheVersion = version;
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
        if (recipe.research && !game.research.isResearched(recipe.research)) continue;
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
