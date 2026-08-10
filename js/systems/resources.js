/**
 * The colony's central store: the resource stockpile plus item inventories
 * (weapons, armor, tomes, artifacts, consumables). Owns add/deduct/has resource
 * math and food spoilage. decayFood is called from simulationTick on the
 * FOOD_DECAY_CONFIG.decayInterval cadence; the rest is invoked on demand by
 * building, crafting, trading, and equipment code.
 */
import { CONFIG, FOODSTUFFS, FOOD_DECAY_CONFIG, WORK_CONFIG, ALL_ITEMS } from '../core/config.js';

export { FOODSTUFFS };

const FOODSTUFFS_BY_DECAY = [...FOODSTUFFS].sort(
    (a, b) => (FOOD_DECAY_CONFIG.decayMultipliers[b] || 1) - (FOOD_DECAY_CONFIG.decayMultipliers[a] || 1)
);

export class ResourceManager {
    constructor() {
        this.stockpile = { ...CONFIG.START_RESOURCES };
        this.weapons = [];
        this.armors = [];
        this.helmets = [];
        this.tools = [];
        this.artifacts = [];
        this.potions = [];
        this.tomes = [];
        this.consumables = [];
        this._decayAccumulators = {};
        this.reservedFoodstuffs = {};
    }

    getFoodstuffTotal() {
        let total = 0;
        for (const item of FOODSTUFFS) {
            total += this.stockpile[item] || 0;
        }
        return total;
    }

    has(costs) {
        for (const [resource, amount] of Object.entries(costs)) {
            if (resource === 'foodstuffs') {
                if (this.getFoodstuffTotal() < amount) return false;
            } else {
                if ((this.stockpile[resource] || 0) < amount) return false;
            }
        }
        return true;
    }

    deduct(costs) {
        for (const [resource, amount] of Object.entries(costs)) {
            if (resource === 'foodstuffs') {
                this.deductFoodstuffs(amount);
            } else {
                this.stockpile[resource] = (this.stockpile[resource] || 0) - amount;
            }
        }
    }

    deductFoodstuffs(amount) {
        let remaining = amount;
        for (const item of FOODSTUFFS_BY_DECAY) {
            if (remaining <= 0) break;
            if (this.reservedFoodstuffs[item]) continue;
            const available = this.stockpile[item] || 0;
            const take = Math.min(available, remaining);
            this.stockpile[item] -= take;
            remaining -= take;
        }
        if (remaining > 0) {
            for (const item of FOODSTUFFS_BY_DECAY) {
                if (remaining <= 0) break;
                const available = this.stockpile[item] || 0;
                const take = Math.min(available, remaining);
                this.stockpile[item] -= take;
                remaining -= take;
            }
        }
    }

    add(resources) {
        for (const [resource, amount] of Object.entries(resources)) {
            if (ALL_ITEMS[resource]?.type === 'tome') {
                for (let i = 0; i < amount; i++) {
                    this.addTome({ ...ALL_ITEMS[resource], key: resource });
                }
            } else {
                this.stockpile[resource] = (this.stockpile[resource] || 0) + amount;
            }
        }
    }

    addItem(item) {
        switch (item.type) {
            case 'weapon':     return this.addWeapon(item);
            case 'armor':      return this.addArmor(item);
            case 'helmet':     return this.addHelmet(item);
            case 'tool':       return this.addTool(item);
            case 'artifact':   return this.addArtifact(item);
            case 'potion':     return this.addPotion(item);
            case 'tome':       return this.addTome(item);
            case 'consumable': return this.addConsumable(item);
            default:           return this.addConsumable(item);
        }
    }

    addWeapon(weaponType) {
        this.weapons.push(weaponType);
    }

    takeWeapon() {
        if (this.weapons.length === 0) return null;
        this.weapons.sort((a, b) => b.damage - a.damage);
        return this.weapons.shift();
    }

    addArmor(armor) {
        this.armors.push(armor);
    }

    takeArmor() {
        if (this.armors.length === 0) return null;
        this.armors.sort((a, b) => b.damageReduction - a.damageReduction);
        return this.armors.shift();
    }

    addHelmet(helmet) {
        this.helmets.push(helmet);
    }

    takeHelmet() {
        if (this.helmets.length === 0) return null;
        this.helmets.sort((a, b) => b.damageReduction - a.damageReduction);
        return this.helmets.shift();
    }

    addTool(tool) {
        this.tools.push(tool);
    }

    takeTool() {
        if (this.tools.length === 0) return null;
        return this.tools.shift();
    }

    addArtifact(artifact) {
        this.artifacts.push(artifact);
    }

    removeArtifact(key) {
        const idx = this.artifacts.findIndex(a => a.key === key);
        if (idx !== -1) this.artifacts.splice(idx, 1);
    }

    takeArtifact() {
        if (this.artifacts.length === 0) return null;
        return this.artifacts.shift();
    }

    addTome(tome) {
        this.tomes.push(tome);
    }

    takeTome(index) {
        if (index < 0 || index >= this.tomes.length) return null;
        return this.tomes.splice(index, 1)[0];
    }

    addPotion(potion) {
        this.potions.push(potion);
    }

    takePotion(type) {
        const idx = this.potions.findIndex(p => (p.key ?? p.type) === type);
        if (idx < 0) return null;
        return this.potions.splice(idx, 1)[0];
    }

    getPotionCount(type) {
        return this.potions.filter(p => (p.key ?? p.type) === type).length;
    }

    addConsumable(item) {
        this.consumables.push(item);
    }

    takeConsumable(index) {
        if (index < 0 || index >= this.consumables.length) return null;
        return this.consumables.splice(index, 1)[0];
    }

    getWealth() {
        let wealth = 0;
        for (const [, amount] of Object.entries(this.stockpile)) {
            wealth += amount;
        }
        wealth += this.weapons.length * WORK_CONFIG.wealthPerWeapon;
        return wealth;
    }

    // Spoil stored food. Rate scales with season and per-item multipliers, and
    // is reduced by food chests (always) and ice boxes (only when powered), each
    // capped independently and then jointly. Fractional decay is carried in
    // _decayAccumulators so slow-spoiling items still lose whole units over time
    // rather than rounding to zero every call. Returns units lost this call.
    decayFood(game) {
        const season = game.weather.season;
        const seasonMult = FOOD_DECAY_CONFIG.seasonDecayMult[season] || 1.0;

        const foodChestCount = game.mapIndex ? game.mapIndex.getStructurePositions('food_chest').size : 0;
        const iceBoxCount = game.mapIndex ? game.mapIndex.getStructurePositions('ice_box').size : 0;
        const noPower = game.power && !game.power.powered;

        let reduction = Math.min(FOOD_DECAY_CONFIG.foodChestMaxReduction, foodChestCount * FOOD_DECAY_CONFIG.foodChestReduction);
        if (!noPower) {
            reduction += iceBoxCount * FOOD_DECAY_CONFIG.iceBoxReduction;
        }
        reduction = Math.min(FOOD_DECAY_CONFIG.maxTotalReduction, reduction);
        const storageMult = 1.0 - reduction;

        const decayableItems = [...FOODSTUFFS, 'food'];
        let totalLost = 0;

        for (const item of decayableItems) {
            const qty = this.stockpile[item] || 0;
            if (qty <= 0) continue;

            const itemMult = FOOD_DECAY_CONFIG.decayMultipliers[item] || 1.0;
            const decayRate = FOOD_DECAY_CONFIG.baseDecayRate * itemMult * seasonMult * storageMult;
            const decayAmount = qty * decayRate;

            if (!this._decayAccumulators[item]) this._decayAccumulators[item] = 0;
            this._decayAccumulators[item] += decayAmount;

            const toRemove = Math.floor(this._decayAccumulators[item]);
            if (toRemove > 0) {
                this.stockpile[item] = Math.max(0, qty - toRemove);
                this._decayAccumulators[item] -= toRemove;
                totalLost += toRemove;
            }
        }

        return totalLost;
    }
}
