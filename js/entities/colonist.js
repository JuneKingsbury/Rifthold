import { CONFIG, COLONIST_NAMES, COLONIST_APPEARANCE, COLONIST_CONFIG, TRAITS, TRAIT_EXCLUSIONS, NEED_DECAY, MOOD_THRESHOLDS, MOOD_SPEED_MULT, WEAPONS, POTIONS, SKILLS, MAGIC_SKILLS, MANA_CONFIG, MAGIC_STUDY_CONFIG, SPELLS, THOUGHTS, COMBAT_VISUALS, WORK_CONFIG, TASK_CONFIG, GOLEM_TYPES, SUMMON_TYPES, TASK_SPEED_STATS, DAY_NIGHT, SOCIAL_CONFIG } from '../core/config.js';
import { getRelationshipTier } from '../systems/social-utils.js';
import { findPath, findPathAdjacent, manhattanDist } from '../world/pathfinding.js';
import { isPassable, getMoveCost, hasLineOfSight } from '../world/map.js';
import { moveEntity, computeMoveDuration, computeMoveCooldown } from '../systems/movement-lerp.js';
import { FOODSTUFFS } from '../systems/resources.js';
import { spawnSummon } from './summons.js';
import { getNextId } from './entity-factory.js';
import { completeTask } from './task-executor.js';

function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
        const k = (n + h / 30) % 12;
        return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

export function createColonist(x, y, skillBias, existingNames = []) {
    const id = getNextId();
    const usedNames = new Set(existingNames);
    const available = COLONIST_NAMES.filter(n => !usedNames.has(n));
    let name = available.length > 0
        ? available[Math.floor(Math.random() * available.length)]
        : `Colonist ${id}`;
    // Pick 1–3 traits via weighted random, respecting exclusion pairs.
    // Constraints: cumulative value never goes below 0, total value never exceeds 5.
    const TRAIT_BUDGET = 5;
    const numTraits = 1 + Math.floor(Math.random() * 3);
    const traits = [];
    for (let i = 0; i < numTraits; i++) {
        const currentSum = traits.reduce((s, t) => s + (TRAITS[t]?.value || 0), 0);
        const pool = Object.entries(TRAITS).filter(([key, def]) => {
            if (traits.includes(key)) return false;
            for (const pair of TRAIT_EXCLUSIONS) {
                if (pair.includes(key) && traits.some(t => pair.includes(t))) return false;
            }
            const newSum = currentSum + (def.value || 0);
            if (newSum < 0) return false;           // never let running total go negative
            if (newSum > TRAIT_BUDGET) return false; // never exceed budget
            return true;
        });
        if (pool.length === 0) break;
        const totalWeight = pool.reduce((s, [, def]) => s + (def.weight || 1), 0);
        let roll = Math.random() * totalWeight;
        for (const [key, def] of pool) {
            roll -= def.weight || 1;
            if (roll <= 0) { traits.push(key); break; }
        }
        if (traits.length < i + 1) traits.push(pool[pool.length - 1][0]); // fallback
    }

    // Allocate skill points randomly up to SKILL_POINT_TOTAL, respecting per-skill max.
    const SKILL_POINT_TOTAL = 22;
    const SKILL_MAX_LEVEL = 8;
    const skills = {};
    const skillKeys = Object.keys(SKILLS);
    for (const key of skillKeys) skills[key] = SKILLS[key].baseLevel[0];
    let remaining = SKILL_POINT_TOTAL - skillKeys.reduce((s, k) => s + skills[k], 0);
    // Shuffle to avoid always favouring earlier skills
    const shuffled = [...skillKeys].sort(() => Math.random() - 0.5);
    for (let pass = 0; pass < remaining; pass++) {
        const eligible = shuffled.filter(k => skills[k] < SKILL_MAX_LEVEL);
        if (eligible.length === 0) break;
        skills[eligible[Math.floor(Math.random() * eligible.length)]]++;
    }
    if (skillBias && skills[skillBias] !== undefined) {
        skills[skillBias] = Math.min(10, skills[skillBias] + (SKILLS[skillBias].biasBonus || 3));
    }

    const magicSkills = {};
    for (const [key, def] of Object.entries(MAGIC_SKILLS)) {
        const [min, max] = def.baseLevel;
        magicSkills[key] = min + Math.floor(Math.random() * (max - min + 1));
    }
    const magicKeys = Object.keys(MAGIC_SKILLS);
    let magicBias = null;
    if (traits.includes('magically_gifted') || Math.random() < COLONIST_CONFIG.magicBiasChance) {
        magicBias = magicKeys[Math.floor(Math.random() * magicKeys.length)];
        magicSkills[magicBias] = Math.min(10, magicSkills[magicBias] + (MAGIC_SKILLS[magicBias].biasBonus || 2));
    }

    // Magically Gifted colonists start knowing the level-0 spell for their magic school.
    const starterSpell = (traits.includes('magically_gifted') && magicBias)
        ? Object.entries(SPELLS).find(([, s]) => s.school === magicBias && s.minLevel === 0)?.[0] ?? null
        : null;

    const combinedMagicLevel = Object.values(magicSkills).reduce((sum, lvl) => sum + lvl, 0);
    const maxMana = MANA_CONFIG.baseMana + combinedMagicLevel * MANA_CONFIG.manaPerMagicLevel;

    // Use a large seed range so getColonistSprite's modulo wraps correctly into
    // however many sprites the active pack actually has at render time.
    const bodyVariant = Math.floor(Math.random() * 1000) + 1;
    const hairVariant = Math.floor(Math.random() * 1000) + 1;
    const shirtVariant = Math.floor(Math.random() * 1000) + 1;

    // Random vibrant color: full hue wheel, stored as hex for use in canvas/input[type=color].
    const hue = Math.floor(Math.random() * 360);
    const nameColor = hslToHex(hue, 90, 65);

    return {
        id, name, x, y, skills, skillXp: {}, magicSkills, magicBias, traits,
        nameColor,
        bodyVariant,
        hairVariant,
        shirtVariant,
        priorities: Object.fromEntries(Object.keys(SKILLS).map(k => [k, 3])),
        needs: { hunger: COLONIST_CONFIG.initialHunger[0] + Math.random() * (COLONIST_CONFIG.initialHunger[1] - COLONIST_CONFIG.initialHunger[0]), rest: COLONIST_CONFIG.initialRest[0] + Math.random() * (COLONIST_CONFIG.initialRest[1] - COLONIST_CONFIG.initialRest[0]) },
        mood: COLONIST_CONFIG.initialMood,
        thoughts: [],
        hp: COLONIST_CONFIG.maxHp, maxHp: COLONIST_CONFIG.maxHp,
        mana: maxMana, maxMana,
        knownSpells: starterSpell ? [starterSpell] : [],
        disabledSpells: [],
        equippedTome: null,
        tomeProgress: {},
        state: 'idle',
        currentTaskId: null,
        path: [],
        workProgress: 0,
        assignedBed: null,
        weapon: null,
        armor: null,
        helmet: null,
        tool: null,
        artifact: null,
        drafted: false,
        draftTarget: null,
        guardMode: false,
        guardPost: null,
        stateTimer: 0,
        wanderCooldown: 0,
        moveCooldown: 0,
        opinions: {},
        relationships: {},
    };
}

export function createGolem(type, x, y) {
    const def = GOLEM_TYPES[type];
    const id = getNextId();
    const skills = Object.fromEntries(Object.keys(SKILLS).map(k => [k, 0]));
    if (def.specialty && skills.hasOwnProperty(def.specialty)) {
        skills[def.specialty] = def.skillLevel || 6;
    }
    return {
        id, name: def.name, x, y, skills,
        magicSkills: Object.fromEntries(Object.keys(MAGIC_SKILLS).map(k => [k, { level: 0, xp: 0 }])),
        magicBias: null, traits: def.traits || [],
        nameColor: def.color,
        priorities: Object.fromEntries(Object.keys(SKILLS).map(k => [k, k === def.specialty ? 1 : 5])),
        needs: { hunger: 100, rest: 100 },
        mood: 60,
        thoughts: [],
        hp: def.hp, maxHp: def.hp,
        mana: 0, maxMana: 0,
        knownSpells: [], disabledSpells: [],
        equippedTome: null, tomeProgress: {},
        state: 'idle',
        currentTaskId: null, path: [], workProgress: 0,
        assignedBed: null,
        weapon: null, armor: null, helmet: null, tool: null, artifact: null,
        drafted: false, draftTarget: null,
        guardMode: false, guardPost: null,
        stateTimer: 0, wanderCooldown: 0, moveCooldown: 0,
        golem: true, golemType: type,
    };
}

export function updateColonist(colonist, game) {
    if (colonist.onExpedition) return;

    if (colonist.golem) {
        colonist.needs.hunger = 100;
        colonist.needs.rest = 100;
    } else {
        updateNeeds(colonist, game);
        updateThoughts(colonist, game);
    }
    colonist.mood = computeMood(colonist);

    if (!colonist.golem) checkCriticalAlerts(colonist, game);

    if (colonist.hp <= 0) return;

    tryUsePotions(colonist, game);
    tickPotionEffects(colonist, game);
    updateHealth(colonist);
    updateMana(colonist);
    tryAutocastSpells(colonist, game);

    if (!CONFIG.PEACEFUL_MODE && colonist.traits.includes('pyromaniac') && Math.random() < TRAITS.pyromaniac.fireChance) {
        const tile = game.map[colonist.y][colonist.x];
        if (!tile.onFire && tile.terrain !== 'water' && tile.terrain !== 'rock' && tile.terrain !== 'tall_rock') {
            tile.onFire = true;
            tile.fireTimer = 0;
            if (game.mapIndex) game.mapIndex.addFire(colonist.x, colonist.y);
        }
    }

    switch (colonist.state) {
        case 'idle': updateIdle(colonist, game); break;
        case 'moving': updateMoving(colonist, game); break;
        case 'working': updateWorking(colonist, game); break;
        case 'eating': updateEating(colonist, game); break;
        case 'sleeping': updateSleeping(colonist, game); break;
        case 'fighting': updateFighting(colonist, game); break;
        case 'fleeing': updateFleeing(colonist, game); break;
        case 'drafted': updateDrafted(colonist, game); break;
        case 'wandering': updateWandering(colonist, game); break;
        case 'hunting': updateHunting(colonist, game); break;
    }

    if (game.tick % 15 === 0) {
        if (colonist.needs.hunger < 20) {
            game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: 'Starving!', color: '#ff4444', fontSize: 11, ttl: 12, maxTtl: 12 });
        }
        if (colonist.thoughts && colonist.thoughts.some(t => t.text === 'Freezing outside')) {
            game.combatEffects.push({ x: colonist.x, y: colonist.y, char: COMBAT_VISUALS.freezingChar, color: COMBAT_VISUALS.freezingColor, ttl: COMBAT_VISUALS.freezingTtl });
        }
        if (colonist.maxHp > 0 && colonist.hp < colonist.maxHp && colonist.hp > 0) {
            game.combatEffects.push({ x: colonist.x, y: colonist.y, char: COMBAT_VISUALS.healTickChar, color: COMBAT_VISUALS.healTickColor, ttl: COMBAT_VISUALS.healTickTtl });
        }
        if (colonist.maxMana > 0 && colonist.mana < colonist.maxMana && colonist.mana > 0) {
            game.combatEffects.push({ x: colonist.x, y: colonist.y, char: COMBAT_VISUALS.manaRegenChar, color: COMBAT_VISUALS.manaRegenColor, ttl: COMBAT_VISUALS.manaRegenTtl });
        }
    }
    if (game.tick % 8 === 0 && colonist.activeEffects && colonist.activeEffects.some(e => e.moveSpeedBonus > 0)) {
        game.combatEffects.push({ x: colonist.x, y: colonist.y, char: '·', color: '#88ffff', ttl: 4 });
    }
}

function updateNeeds(colonist, game) {
    let hungerMult = 1;
    if (colonist.traits.includes('iron_stomach')) hungerMult = TRAITS.iron_stomach.hungerDecayMult;
    if (colonist.traits.includes('gluttonous')) hungerMult *= TRAITS.gluttonous.hungerDecayMult;
    const hungerReduction = getEquipmentStat(colonist, 'hungerReduction');
    if (hungerReduction > 0) hungerMult *= (1 - hungerReduction);
    colonist.needs.hunger = Math.max(0, colonist.needs.hunger - NEED_DECAY.hunger * hungerMult);

    let restDecayMult = 1;
    if (colonist.traits.includes('light_sleeper')) restDecayMult = TRAITS.light_sleeper.restDecayMult;
    if (colonist.traits.includes('deep_sleeper')) restDecayMult = TRAITS.deep_sleeper.restDecayMult;
    colonist.needs.rest = Math.max(0, colonist.needs.rest - NEED_DECAY.rest * restDecayMult);

    if (game.weather.season === 'winter' && !isIndoors(colonist, game.map)) {
        const warmed = game.power.isTileWarmed(game, colonist.x, colonist.y);
        if (!warmed) {
            const coldRes = getEquipmentStat(colonist, 'coldResistance');
            if (coldRes <= 0 || Math.random() >= coldRes) {
                applyThought(colonist, 'freezing', game.tick);
            }
        }
    }
}

function updateHealth(colonist) {
    if (colonist.hp >= colonist.maxHp) return;
    let regen = COLONIST_CONFIG.baseHealthRegen;
    regen += getEquipmentStat(colonist, 'healthRegen');
    if (colonist.state === 'sleeping') regen *= COLONIST_CONFIG.healthRegenWhileSleeping;
    else if (colonist.state === 'idle') regen *= COLONIST_CONFIG.healthRegenWhileIdle;
    colonist.hp = Math.min(colonist.maxHp, colonist.hp + regen);
}

function updateMana(colonist) {
    if (colonist.mana >= colonist.maxMana) return;
    const combinedLevel = Object.values(colonist.magicSkills).reduce((sum, lvl) => sum + lvl, 0);
    let regen = MANA_CONFIG.baseRegen + combinedLevel * MANA_CONFIG.regenPerMagicLevel;
    regen += getEquipmentStat(colonist, 'manaRegen');
    if (colonist.state === 'sleeping') regen *= MANA_CONFIG.regenWhileSleeping;
    else if (colonist.state === 'idle') regen *= MANA_CONFIG.regenWhileIdle;
    colonist.mana = Math.min(colonist.maxMana, colonist.mana + regen);
}

export function recalcMaxMana(colonist) {
    const combinedLevel = Object.values(colonist.magicSkills).reduce((sum, lvl) => sum + lvl, 0);
    colonist.maxMana = MANA_CONFIG.baseMana + combinedLevel * MANA_CONFIG.manaPerMagicLevel;
}

function updateThoughts(colonist, game) {
    colonist.thoughts = colonist.thoughts.filter(t => {
        if (t.duration === -1) return true;
        return game.tick - t.tickAdded < t.duration;
    });

    if (colonist.traits.includes('socialite')) {
        const nearOthers = game.colonists.some(c => c.id !== colonist.id && c.hp > 0 &&
            manhattanDist(colonist.x, colonist.y, c.x, c.y) <= COLONIST_CONFIG.socialRange);
        if (nearOthers) {
            addThought(colonist, 'Enjoying company', TRAITS.socialite.nearOthersMoodBonus, 20, game.tick);
        } else {
            addThought(colonist, 'Feeling lonely', TRAITS.socialite.aloneMoodPenalty, 20, game.tick);
        }
    }
    if (colonist.traits.includes('loner')) {
        const nearOthers = game.colonists.some(c => c.id !== colonist.id && c.hp > 0 &&
            manhattanDist(colonist.x, colonist.y, c.x, c.y) <= COLONIST_CONFIG.socialRange);
        if (!nearOthers) {
            addThought(colonist, 'Peaceful solitude', TRAITS.loner.aloneMoodBonus, 20, game.tick);
        } else {
            addThought(colonist, 'Too crowded', TRAITS.loner.nearOthersMoodPenalty, 20, game.tick);
        }
    }
    if (colonist.traits.includes('lazy') && colonist.state === 'idle') {
        addThought(colonist, 'Relaxing', TRAITS.lazy.idleMoodBonus, 30, game.tick);
    }
}

function checkCriticalAlerts(colonist, game) {
    if (!colonist._alertFlags) colonist._alertFlags = {};
    const flags = colonist._alertFlags;

    const hasFood = game.resources.stockpile.food > 0 || game.resources.getFoodstuffTotal() > 0;
    if (colonist.needs.hunger < 30 && !flags.hunger && !hasFood) {
        flags.hunger = true;
        game.notifications.push({ text: `${colonist.name} is hungry and there's no food!`, tick: game.tick, type: 'warning' });
    } else if (colonist.needs.hunger >= 40 || hasFood) {
        flags.hunger = false;
    }

    if (colonist.mood < 30 && colonist.mood > 20 && !flags.mood) {
        flags.mood = true;
        game.notifications.push({ text: `${colonist.name} is near breaking!`, tick: game.tick, type: 'warning' });
        game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: 'Low mood!', color: '#ff4444', fontSize: 11, ttl: 12, maxTtl: 12 });
    } else if (colonist.mood >= 40) {
        flags.mood = false;
    }

    const freezing = colonist.thoughts.some(t => t.text === 'Freezing outside');
    if (freezing && !flags.freezing) {
        flags.freezing = true;
        game.notifications.push({ text: `${colonist.name} is freezing!`, tick: game.tick, type: 'danger' });
        game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: 'Freezing!', color: '#88ddff', fontSize: 11, ttl: 12, maxTtl: 12 });
    } else if (!freezing) {
        flags.freezing = false;
    }
}

export function addThought(colonist, text, moodEffect, duration, tick) {
    const existing = colonist.thoughts.find(t => t.text === text);
    if (existing) {
        existing.tickAdded = tick;
        return;
    }

    let effect = moodEffect;
    if (effect > 0 && colonist.traits.includes('optimist')) effect *= TRAITS.optimist.positiveThoughtMult;
    if (effect < 0 && colonist.traits.includes('pessimist')) effect *= TRAITS.pessimist.negativeThoughtMult;

    colonist.thoughts.push({ text, moodEffect: effect, duration, tickAdded: tick });
}

function applyThought(colonist, thoughtKey, tick) {
    const t = THOUGHTS[thoughtKey];
    if (t) addThought(colonist, t.text, t.moodEffect, t.duration, tick);
}

function computeMood(colonist) {
    let mood = COLONIST_CONFIG.baseMood;
    for (const thought of colonist.thoughts) {
        mood += thought.moodEffect;
    }
    if (colonist.needs.hunger < COLONIST_CONFIG.hungerMoodThreshold) mood += COLONIST_CONFIG.hungerMoodPenalty;
    if (colonist.needs.rest < COLONIST_CONFIG.restMoodThreshold) mood += COLONIST_CONFIG.restMoodPenalty;
    if (colonist.assignedBed) mood += COLONIST_CONFIG.bedMoodBonus;
    mood += getEquipmentStat(colonist, 'moodBonus');
    return Math.max(0, Math.min(100, mood));
}

function getMoodLevel(mood) {
    if (mood >= MOOD_THRESHOLDS.inspired) return 'inspired';
    if (mood >= MOOD_THRESHOLDS.content) return 'content';
    if (mood >= MOOD_THRESHOLDS.stressed) return 'stressed';
    return 'breaking';
}

function getWorkSpeed(colonist, game) {
    let speed = 1.0;
    const moodLevel = getMoodLevel(colonist.mood);
    speed *= MOOD_SPEED_MULT[moodLevel];

    if (colonist.traits.includes('hard_worker')) speed *= TRAITS.hard_worker.workSpeedMult;
    if (colonist.traits.includes('lazy')) speed *= TRAITS.lazy.workSpeedMult;
    if (colonist.traits.includes('sturdy')) speed *= TRAITS.sturdy.workSpeedMult;

    const t = game.timeOfDay / CONFIG.TICKS_PER_DAY;
    const isNight = t > DAY_NIGHT.nightStart || t < DAY_NIGHT.dayStart;
    if (colonist.traits.includes('night_owl')) {
        speed *= isNight ? TRAITS.night_owl.nightSpeedMult : TRAITS.night_owl.daySpeedMult;
    }
    if (colonist.traits.includes('early_bird')) {
        speed *= isNight ? TRAITS.early_bird.nightSpeedMult : TRAITS.early_bird.daySpeedMult;
    }

    return speed;
}

export function getEquippedItems(colonist) {
    const items = [];
    if (colonist.weapon) items.push(colonist.weapon);
    if (colonist.armor) items.push(colonist.armor);
    if (colonist.helmet) items.push(colonist.helmet);
    if (colonist.tool) items.push(colonist.tool);
    if (colonist.artifact && !colonist.artifactBroken) items.push(colonist.artifact);
    return items;
}

function getMoveSpeedBonus(colonist) {
    let bonus = 0;
    for (const item of getEquippedItems(colonist)) {
        if (item.moveSpeedBonus) bonus += item.moveSpeedBonus;
    }
    if (colonist.activeEffects) {
        for (const e of colonist.activeEffects) {
            if (e.type === 'speed' && e.moveSpeedBonus) bonus += e.moveSpeedBonus;
        }
    }
    if (colonist.traits.includes('quick')) bonus += TRAITS.quick.moveSpeedBonus;
    return Math.min(bonus, 0.8);
}

function getEquipmentWorkBonus(colonist, task) {
    let mult = 1.0;
    const statKey = TASK_SPEED_STATS[task.type];
    for (const item of getEquippedItems(colonist)) {
        if (statKey && item[statKey]) mult *= item[statKey];
        if (item.workSpeedBonus) mult *= (1 + item.workSpeedBonus);
    }
    if (colonist.pedestalWorkBonus) mult *= (1 + colonist.pedestalWorkBonus);
    return mult;
}

function getEquipmentDamageReduction(colonist) {
    let mult = 1;
    for (const item of getEquippedItems(colonist)) {
        if (item.damageReduction) mult *= (1 - item.damageReduction);
        if (item.combat?.damageReduction) mult *= (1 - item.combat.damageReduction);
    }
    return mult;
}

function getEquipmentSpellBonus(colonist) {
    let bonus = 0;
    for (const item of getEquippedItems(colonist)) {
        if (item.spellDamageBonus) bonus += item.spellDamageBonus;
    }
    return bonus;
}

export function getEquipmentStat(colonist, stat) {
    let total = 0;
    for (const item of getEquippedItems(colonist)) {
        if (item[stat]) total += item[stat];
    }
    return total;
}

function tryUsePotions(colonist, game) {
    if (!colonist._potionCooldowns) colonist._potionCooldowns = {};

    for (const [key, potion] of Object.entries(POTIONS)) {
        if (colonist._potionCooldowns[key] && game.tick - colonist._potionCooldowns[key] < potion.cooldown) continue;
        if (game.resources.getPotionCount(key) <= 0) continue;

        let shouldUse = false;
        if (potion.trigger === 'lowHealth') {
            shouldUse = colonist.hp < colonist.maxHp * potion.hpThreshold;
        } else if (potion.trigger === 'hasTask') {
            shouldUse = colonist.currentTaskId !== null && (colonist.state === 'moving' || colonist.state === 'working');
        }

        if (shouldUse) {
            game.resources.takePotion(key);
            colonist._potionCooldowns[key] = game.tick;

            if (potion.effect === 'heal') {
                colonist.hp = Math.min(colonist.maxHp, colonist.hp + potion.healAmount);
                game.combatEffects.push({ x: colonist.x, y: colonist.y, char: COMBAT_VISUALS.healTickChar, color: COMBAT_VISUALS.healTickColor, ttl: COMBAT_VISUALS.healTickTtl });
            } else if (potion.effect === 'speed') {
                if (!colonist.activeEffects) colonist.activeEffects = [];
                colonist.activeEffects.push({
                    type: 'speed',
                    moveSpeedBonus: potion.moveSpeedBonus,
                    workSpeedBonus: potion.workSpeedBonus,
                    expiresAt: game.tick + potion.duration,
                });
                game.combatEffects.push({ x: colonist.x, y: colonist.y, char: COMBAT_VISUALS.spellBuffChar, color: COMBAT_VISUALS.spellBuffColor, ttl: 3 });
            }

            game.notifications.push({ text: `${colonist.name} used ${potion.name}`, tick: game.tick, type: 'success' });
        }
    }
}

function tickPotionEffects(colonist, game) {
    if (!colonist.activeEffects) return;
    colonist.activeEffects = colonist.activeEffects.filter(e => game.tick < e.expiresAt);
}

export function grantCastXp(colonist, spell, game) {
    const school = spell.school;
    if (!school || colonist.magicSkills[school] >= 10) return;
    if (!colonist._magicXpAccumulator) colonist._magicXpAccumulator = {};
    if (!colonist._magicXpAccumulator[school]) colonist._magicXpAccumulator[school] = 0;
    let castXpGain = MAGIC_STUDY_CONFIG.xpPerCast;
    if (colonist.traits.includes('scholar')) castXpGain *= TRAITS.scholar.magicXpMult;
    if (colonist.traits.includes('prodigy')) castXpGain *= TRAITS.prodigy.magicXpMult;
    colonist._magicXpAccumulator[school] += castXpGain;
    let magicXpNeeded = MAGIC_STUDY_CONFIG.magicXpToLevel + colonist.magicSkills[school] * MAGIC_STUDY_CONFIG.magicXpScalePerLevel;
    while (colonist._magicXpAccumulator[school] >= magicXpNeeded && colonist.magicSkills[school] < 10) {
        colonist._magicXpAccumulator[school] -= magicXpNeeded;
        colonist.magicSkills[school] = Math.min(10, colonist.magicSkills[school] + 1);
        recalcMaxMana(colonist);
        game.notifications.push({ text: `${colonist.name}'s ${MAGIC_SKILLS[school].name} increased to ${colonist.magicSkills[school]}`, tick: game.tick, type: 'success' });
        game.eventLog.add(game, `${colonist.name}'s ${MAGIC_SKILLS[school].name} increased to ${colonist.magicSkills[school]}!`, 'success', { type: 'colonist', id: colonist.id });
        game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: `${MAGIC_SKILLS[school].name} lvl ${colonist.magicSkills[school]}`, color: '#aa66ff', fontSize: 11, ttl: 20, maxTtl: 20 });
        window.soundManager?.playSFX('magic_levelup');
        magicXpNeeded = MAGIC_STUDY_CONFIG.magicXpToLevel + colonist.magicSkills[school] * MAGIC_STUDY_CONFIG.magicXpScalePerLevel;
    }
}

function tryAutocastSpells(colonist, game) {
    if (!colonist.knownSpells || colonist.knownSpells.length === 0) return;
    if (!colonist._spellCooldowns) colonist._spellCooldowns = {};

    for (const spellKey of colonist.knownSpells) {
        const spell = SPELLS[spellKey];
        if (!spell || spell.castType !== 'auto') continue;
        if (colonist.disabledSpells && colonist.disabledSpells.includes(spellKey)) continue;
        if (colonist._spellCooldowns[spellKey] && game.tick - colonist._spellCooldowns[spellKey] < spell.cooldown) continue;
        const costReduction = getEquipmentStat(colonist, 'spellCostReduction');
        const effectiveCost = Math.max(1, Math.floor(spell.manaCost * (1 - costReduction)));
        if (colonist.mana < effectiveCost) {
            game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: 'No mana', color: '#6688cc', fontSize: 10, ttl: 10, maxTtl: 10 });
            continue;
        }

        if (!shouldCastSpell(colonist, spell, game)) continue;

        colonist.mana -= effectiveCost;
        colonist._spellCooldowns[spellKey] = game.tick;
        applySpellEffect(colonist, spell, game);
        grantCastXp(colonist, spell, game);
        applyThought(colonist, 'cast_spell', game.tick);
        game.story.checkMilestone('first_spell_cast', game);
        window.soundManager?.playSFX('spell_cast');
        game.combatEffects.push({
            x: colonist.x, y: colonist.y,
            char: COMBAT_VISUALS.spellCastChar,
            color: spell.projectileColor || COMBAT_VISUALS.spellCastColor,
            ttl: 2,
        });
        game.overlays.push({
            type: 'glow',
            x: colonist.x, y: colonist.y,
            color: spell.projectileColor || COMBAT_VISUALS.spellCastColor,
            radius: 1.2, alpha: 0.35, ttl: 3,
        });
    }
}

function shouldCastSpell(colonist, spell, game) {
    switch (spell.trigger) {
        case 'inCombat': {
            const hostile = findNearestHostile(colonist, game);
            if (!hostile) return false;
            const dist = manhattanDist(colonist.x, colonist.y, hostile.x, hostile.y);
            return dist <= (spell.range || COLONIST_CONFIG.fightEngageDistance);
        }
        case 'lowHealth':
            return colonist.hp < colonist.maxHp * (spell.hpThreshold || 0.5);
        case 'allyLowHealth': {
            const range = spell.range || COLONIST_CONFIG.hostileSearchRadius;
            return game.colonists.some(c => c.id !== colonist.id && c.hp > 0 &&
                c.hp < c.maxHp * (spell.hpThreshold || 0.5) &&
                manhattanDist(colonist.x, colonist.y, c.x, c.y) <= range);
        }
        case 'hasTask':
            if (spell.idleExclude && colonist.state === 'idle') return false;
            return colonist.currentTaskId !== null && (colonist.state === 'moving' || colonist.state === 'working');
        case 'always':
            if (spell.idleExclude && colonist.state === 'idle') return false;
            return true;
        default:
            return false;
    }
}

function applySpellEffect(colonist, spell, game) {
    switch (spell.effect) {
        case 'ranged_damage': {
            const target = findNearestHostile(colonist, game);
            if (!target) return;
            const dist = manhattanDist(colonist.x, colonist.y, target.x, target.y);
            if (dist > spell.range) return;
            let dmg = spell.damage;
            const spellBonus = getEquipmentSpellBonus(colonist);
            if (spellBonus) dmg = Math.floor(dmg * (1 + spellBonus));
            target.hp -= dmg;
            target._dmgFlashUntil = game.tick + COMBAT_VISUALS.dmgFlashTtl;
            const projDuration = (dist / COMBAT_VISUALS.projectileSpeed) * 1000;
            game.projectiles.push({
                fromX: colonist.x, fromY: colonist.y, toX: target.x, toY: target.y,
                char: spell.projectileChar || '*',
                color: spell.projectileColor || '#ff44ff',
                skinKey: 'projectile_spell',
                _startTime: performance.now(), _duration: projDuration,
            });
            break;
        }
        case 'ranged_damage_aoe': {
            const target = findNearestHostile(colonist, game);
            if (!target) return;
            const dist = manhattanDist(colonist.x, colonist.y, target.x, target.y);
            if (dist > spell.range) return;
            let aoeDmg = spell.damage;
            const aoeSpellBonus = getEquipmentSpellBonus(colonist);
            if (aoeSpellBonus) aoeDmg = Math.floor(aoeDmg * (1 + aoeSpellBonus));
            const aoeProjDuration = (dist / COMBAT_VISUALS.projectileSpeed) * 1000;
            game.projectiles.push({
                fromX: colonist.x, fromY: colonist.y, toX: target.x, toY: target.y,
                char: spell.projectileChar || '●',
                color: spell.projectileColor || '#ff6600',
                skinKey: 'projectile_spell',
                _startTime: performance.now(), _duration: aoeProjDuration,
            });
            const allHostiles = [...game.raiders, ...(game.waves ? game.waves.enemies : []), ...game.entities.filter(w => w.category === 'animal' && !w.tamed && w.hostile)];
            for (const h of allHostiles) {
                if (h.hp <= 0) continue;
                if (manhattanDist(target.x, target.y, h.x, h.y) <= spell.radius) {
                    h.hp -= aoeDmg;
                    h._dmgFlashUntil = game.tick + COMBAT_VISUALS.dmgFlashTtl;
                    game.combatEffects.push({ x: h.x, y: h.y, char: spell.projectileChar || '●', color: spell.projectileColor || '#ff6600', ttl: 3 });
                }
            }
            break;
        }
        case 'melee_damage': {
            const target = findNearestHostile(colonist, game);
            if (!target) return;
            const dist = manhattanDist(colonist.x, colonist.y, target.x, target.y);
            if (dist > (spell.range || 1)) return;
            let dmg = spell.damage;
            const spellBonus = getEquipmentSpellBonus(colonist);
            if (spellBonus) dmg = Math.floor(dmg * (1 + spellBonus));
            target.hp -= dmg;
            target._dmgFlashUntil = game.tick + COMBAT_VISUALS.dmgFlashTtl;
            colonist._atkShakeUntil = game.tick + COMBAT_VISUALS.atkShakeTtl;
            game.combatEffects.push({ x: target.x, y: target.y, char: spell.projectileChar || '✝', color: spell.projectileColor || '#ffffaa', ttl: 4 });
            break;
        }
        case 'heal':
            if (spell.targetSelf) {
                colonist.hp = Math.min(colonist.maxHp, colonist.hp + spell.healAmount);
            }
            game.combatEffects.push({ x: colonist.x, y: colonist.y, char: COMBAT_VISUALS.spellHealChar, color: COMBAT_VISUALS.spellHealColor, ttl: 3 });
            window.soundManager?.playSFX('spell_heal');
            break;
        case 'buff_speed': {
            if (!colonist.activeEffects) colonist.activeEffects = [];
            colonist.activeEffects.push({
                type: 'speed',
                source: 'spell',
                moveSpeedBonus: spell.moveSpeedBonus || 0,
                workSpeedBonus: spell.workSpeedBonus || 1.0,
                expiresAt: game.tick + spell.duration,
            });
            game.combatEffects.push({ x: colonist.x, y: colonist.y, char: COMBAT_VISUALS.spellBuffChar, color: COMBAT_VISUALS.spellBuffColor, ttl: 2 });
            window.soundManager?.playSFX('spell_buff');
            break;
        }
        case 'buff_defense': {
            if (!colonist.activeEffects) colonist.activeEffects = [];
            colonist.activeEffects.push({
                type: 'shield',
                source: 'spell',
                damageReduction: spell.damageReduction || 0.3,
                expiresAt: game.tick + spell.duration,
            });
            game.combatEffects.push({ x: colonist.x, y: colonist.y, char: COMBAT_VISUALS.spellShieldChar, color: COMBAT_VISUALS.spellShieldColor, ttl: 3 });
            game.combatEffects.push({ x: colonist.x, y: colonist.y, char: COMBAT_VISUALS.spellBuffChar, color: COMBAT_VISUALS.spellBuffColor, ttl: 3 });
            window.soundManager?.playSFX('spell_shield');
            break;
        }
        case 'summon': {
            const summonDef = SUMMON_TYPES[spell.summonType];
            if (!summonDef) break;
            const sx = colonist.x + (Math.random() > 0.5 ? 1 : -1);
            const sy = colonist.y + (Math.random() > 0.5 ? 1 : -1);
            spawnSummon(spell.summonType, sx, sy, colonist.id, game);
            break;
        }
        case 'divination_modifier': {
            if (!game.divinationModifiers) game.divinationModifiers = [];
            const modKey = JSON.stringify(spell.modifiers);
            const alreadyActive = game.divinationModifiers.some(m => {
                const { expiresAt, casterName, ...rest } = m;
                return JSON.stringify(rest) === modKey;
            });
            if (alreadyActive) return;
            game.divinationModifiers.push({
                ...spell.modifiers,
                expiresAt: game.tick + spell.duration,
                casterName: colonist.name,
            });
            game.combatEffects.push({ x: colonist.x, y: colonist.y, char: COMBAT_VISUALS.spellDivinationChar, color: COMBAT_VISUALS.spellDivinationColor, ttl: 3 });
            window.soundManager?.playSFX('spell_divination');
            game.notifications.push({ text: `${colonist.name} cast ${spell.name}`, tick: game.tick, type: 'success' });
            break;
        }
    }
}

function updateIdle(colonist, game) {
    if (colonist.expeditionPending) return;

    if (colonist.drafted) {
        colonist.state = 'drafted';
        return;
    }

    if (getMoodLevel(colonist.mood) === 'breaking') {
        colonist.state = 'wandering';
        colonist.stateTimer = COLONIST_CONFIG.breakingWanderDuration[0] + Math.floor(Math.random() * (COLONIST_CONFIG.breakingWanderDuration[1] - COLONIST_CONFIG.breakingWanderDuration[0]));
        game.story.checkMilestone('first_mental_break', game);
        game.combatEffects.push({ x: colonist.x, y: colonist.y, char: COMBAT_VISUALS.mentalBreakChar, color: COMBAT_VISUALS.mentalBreakColor, ttl: COMBAT_VISUALS.mentalBreakTtl });
        window.soundManager?.playSFX('mental_break');
        return;
    }

    const waveActive = game.waves && game.waves.active && game.waves.enemies.length > 0;
    const threat = findNearestHostile(colonist, game);
    if (threat && !colonist.traits.includes('pacifist')) {
        const dist = manhattanDist(colonist.x, colonist.y, threat.x, threat.y);
        const wpnRange = colonist.weapon && colonist.weapon.ranged ? colonist.weapon.range : 0;
        const autoEngageDist = Math.max(COLONIST_CONFIG.fightEngageDistance, wpnRange);
        if (waveActive || dist <= autoEngageDist) {
            colonist.state = 'fighting';
            return;
        }
    }

    if (colonist.needs.hunger < COLONIST_CONFIG.hungerMoodThreshold &&
        (game.resources.stockpile.food > 0 || game.resources.getFoodstuffTotal() > 0)) {
        colonist.state = 'eating';
        return;
    }
    if (colonist.needs.rest < COLONIST_CONFIG.restMoodThreshold) {
        startSleeping(colonist, game);
        return;
    }

    if (colonist.guardMode && colonist.guardPost) {
        updateGuarding(colonist, game);
        return;
    }

    const task = game.taskQueue.findBestTask(colonist, game.tick);
    if (task) {
        game.taskQueue.claim(task.id, colonist.id);
        colonist.currentTaskId = task.id;
        const path = findPathAdjacent(game.map, colonist.x, colonist.y, task.x, task.y);
        if (path && path.length > 0) {
            colonist.path = path;
            colonist.state = 'moving';
        } else if (manhattanDist(colonist.x, colonist.y, task.x, task.y) <= 1) {
            colonist.state = 'working';
            colonist.workProgress = 0;
        } else {
            game.taskQueue.release(task.id);
            colonist.currentTaskId = null;
            if (!colonist._failedTasks) colonist._failedTasks = {};
            colonist._failedTasks[task.id] = game.tick;

            if (!task._unreachableFailers) task._unreachableFailers = {};
            task._unreachableFailers[colonist.id] = true;

            const failCount = Object.keys(task._unreachableFailers).length;
            if (failCount >= TASK_CONFIG.unreachableFailThreshold) {
                game.taskQueue.remove(task.id);
                const tile = game.map[task.y] && game.map[task.y][task.x];
                if (tile) {
                    tile.designation = null;
                    game.combatEffects.push({ x: task.x, y: task.y, char: COMBAT_VISUALS.needCriticalChar, color: COMBAT_VISUALS.needCriticalColor, ttl: COMBAT_VISUALS.needCriticalTtl });
                }
                game.notifications.push({ text: `Cancelled unreachable ${task.type} task`, tick: game.tick, type: 'warning' });
            } else if (!colonist._lastPathFailNotify || game.tick - colonist._lastPathFailNotify > TASK_CONFIG.unreachableCheckInterval) {
                colonist._lastPathFailNotify = game.tick;
                game.notifications.push({ text: `${colonist.name} can't reach ${task.type} task`, tick: game.tick, type: 'danger' });
            }
        }
        return;
    }

    if (colonist.traits.includes('socialite')) {
        const socialRange = SOCIAL_CONFIG.interactionRange;
        const alreadyNear = game.colonists.some(c =>
            c.id !== colonist.id && c.hp > 0 && !c.onExpedition &&
            manhattanDist(colonist.x, colonist.y, c.x, c.y) <= socialRange
        );
        if (!alreadyNear) {
            const target = game.colonists.reduce((best, c) => {
                if (c.id === colonist.id || c.hp <= 0 || c.onExpedition) return best;
                const d = manhattanDist(colonist.x, colonist.y, c.x, c.y);
                return (!best || d < best.dist) ? { c, dist: d } : best;
            }, null);
            if (target) {
                const path = findPathAdjacent(game.map, colonist.x, colonist.y, target.c.x, target.c.y);
                if (path && path.length > 0) {
                    colonist.path = path;
                    colonist.state = 'moving';
                    return;
                }
            }
        }
    }

    colonist.wanderCooldown--;
    if (colonist.wanderCooldown <= 0) {
        wander(colonist, game);
        colonist.wanderCooldown = COLONIST_CONFIG.wanderCooldown[0] + Math.floor(Math.random() * (COLONIST_CONFIG.wanderCooldown[1] - COLONIST_CONFIG.wanderCooldown[0]));
    }
}

function wander(colonist, game) {
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const dir = dirs[Math.floor(Math.random() * 4)];
    const nx = colonist.x + dir[0];
    const ny = colonist.y + dir[1];
    if (isPassable(game.map, nx, ny) && !game.isTileOccupied(nx, ny)) {
        moveEntity(colonist, nx, ny, CONFIG.TICK_RATE / game.speed);
    }
}

function updateGuarding(colonist, game) {
    const post = colonist.guardPost;
    const threat = findNearestHostile(colonist, game);

    if (threat) {
        const distToThreat = manhattanDist(colonist.x, colonist.y, threat.x, threat.y);
        const distFromPost = manhattanDist(colonist.x, colonist.y, post.x, post.y);

        if (distFromPost > WORK_CONFIG.guardReturnThreshold) {
            moveTowardPoint(colonist, post.x, post.y, game.map, CONFIG.TICK_RATE / game.speed, game);
            return;
        }

        if (distToThreat <= WORK_CONFIG.guardEngageRadius) {
            colonist.state = 'fighting';
            return;
        }
    }

    const distFromPost = manhattanDist(colonist.x, colonist.y, post.x, post.y);
    if (distFromPost > WORK_CONFIG.guardPatrolRadius) {
        moveTowardPoint(colonist, post.x, post.y, game.map, CONFIG.TICK_RATE / game.speed, game);
    } else if (Math.random() < 0.15) {
        const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        const dir = dirs[Math.floor(Math.random() * 4)];
        const nx = colonist.x + dir[0];
        const ny = colonist.y + dir[1];
        if (isPassable(game.map, nx, ny) && manhattanDist(nx, ny, post.x, post.y) <= WORK_CONFIG.guardPatrolRadius && !game.isTileOccupied(nx, ny)) {
            moveEntity(colonist, nx, ny, CONFIG.TICK_RATE / game.speed);
        }
    }
}

function moveTowardPoint(colonist, tx, ty, map, dur, game) {
    const dx = Math.sign(tx - colonist.x);
    const dy = Math.sign(ty - colonist.y);
    const candidates = [];
    if (dx !== 0 && isPassable(map, colonist.x + dx, colonist.y)) candidates.push([colonist.x + dx, colonist.y]);
    if (dy !== 0 && isPassable(map, colonist.x, colonist.y + dy)) candidates.push([colonist.x, colonist.y + dy]);
    if (candidates.length === 0) return;
    if (game) {
        const unoccupied = candidates.filter(([cx, cy]) => !game.isTileOccupied(cx, cy));
        if (unoccupied.length > 0) {
            const pick = unoccupied[Math.floor(Math.random() * unoccupied.length)];
            moveEntity(colonist, pick[0], pick[1], dur);
            return;
        }
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    moveEntity(colonist, pick[0], pick[1], dur);
}

function updateMoving(colonist, game) {
    if (game.waves && game.waves.active && game.waves.enemies.length > 0) {
        const threat = findNearestHostile(colonist, game);
        if (threat && colonist.currentTaskId) {
            game.taskQueue.release(colonist.currentTaskId);
            colonist.currentTaskId = null;
            colonist.path = [];
            colonist.state = 'fighting';
            return;
        }
    }

    if (colonist.moveCooldown > 0) {
        colonist.moveCooldown--;
        return;
    }
    if (colonist.path.length === 0) {
        if (colonist._expeditionMove) {
            colonist.state = 'idle';
            return;
        }
        if (colonist._sleepAfterMove) {
            delete colonist._sleepAfterMove;
            colonist.state = 'sleeping';
            colonist.stateTimer = COLONIST_CONFIG.sleepAfterMoveDuration;
            return;
        }
        colonist.state = 'working';
        colonist.workProgress = 0;
        return;
    }
    const next = colonist.path[0];
    if (isPassable(game.map, next.x, next.y)) {
        if (game.isTileOccupied(next.x, next.y) && colonist.path.length > 1) {
            colonist._occupiedWait = (colonist._occupiedWait || 0) + 1;
            if (colonist._occupiedWait < 3) {
                colonist.moveCooldown = 1;
                return;
            }
        }
        colonist._occupiedWait = 0;
        const cost = getMoveCost(game.map, next.x, next.y);
        const moveBonus = getMoveSpeedBonus(colonist);
        const dur = computeMoveDuration(cost, moveBonus, game.speed);
        moveEntity(colonist, next.x, next.y, dur);
        colonist.path.shift();
        colonist.moveCooldown = computeMoveCooldown(cost, moveBonus);
    } else {
        const task = game.taskQueue.getById(colonist.currentTaskId);
        if (task) {
            const newPath = findPathAdjacent(game.map, colonist.x, colonist.y, task.x, task.y);
            if (newPath) {
                colonist.path = newPath;
            } else {
                game.taskQueue.release(colonist.currentTaskId);
                colonist.currentTaskId = null;
                colonist.state = 'idle';
            }
        } else {
            colonist.state = 'idle';
            colonist.path = [];
        }
    }
}

function updateWorking(colonist, game) {
    if (game.waves && game.waves.active && game.waves.enemies.length > 0) {
        const threat = findNearestHostile(colonist, game);
        if (threat && colonist.currentTaskId) {
            game.taskQueue.release(colonist.currentTaskId);
            colonist.currentTaskId = null;
            colonist.state = 'fighting';
            return;
        }
    }

    const task = game.taskQueue.getById(colonist.currentTaskId);
    if (!task) {
        colonist.state = 'idle';
        colonist.currentTaskId = null;
        return;
    }

    if (getMoodLevel(colonist.mood) === 'breaking') {
        game.taskQueue.release(colonist.currentTaskId);
        colonist.currentTaskId = null;
        colonist.state = 'idle';
        return;
    }

    let speed = getWorkSpeed(colonist, game);
    const skill = colonist.skills[task.skillRequired] || 1;
    speed *= (1 + skill * COLONIST_CONFIG.skillWorkBonus);

    if (task.skillRequired === 'farming' && colonist.traits.includes('green_thumb')) {
        speed *= TRAITS.green_thumb.farmingSpeedMult;
    }
    if ((task.type === 'craft' || task.type === 'cook') && colonist.traits.includes('creative')) {
        speed *= TRAITS.creative.craftingSpeedMult;
    }
    if (task.type === 'research' && colonist.traits.includes('scholar')) {
        speed *= TRAITS.scholar.researchSpeedMult;
    }
    if (task.type === 'research' && game.tick % 10 === 0) {
        game.combatEffects.push({ x: colonist.x, y: colonist.y, char: COMBAT_VISUALS.xpGainChar, color: COMBAT_VISUALS.xpGainColor, ttl: COMBAT_VISUALS.xpGainTtl });
    }

    speed *= getEquipmentWorkBonus(colonist, task);

    if ((task.type === 'craft' || task.type === 'cook') && game.workshopQualities) {
        const roomId = game.map[colonist.y]?.[colonist.x]?.roomId;
        if (roomId !== null && roomId !== undefined && game.workshopQualities[roomId]) {
            speed *= game.workshopQualities[roomId].speedMult;
        }
    }

    if (colonist.activeEffects) {
        for (const e of colonist.activeEffects) {
            if (e.type === 'speed' && e.workSpeedBonus) speed *= e.workSpeedBonus;
        }
    }

    task.workDone += speed;
    colonist.workProgress = task.workDone / task.workAmount;

    if (task.workDone >= task.workAmount) {
        completeTask(colonist, task, game);
    }
}


function updateEating(colonist, game) {
    if (game.resources.stockpile.food > 0) {
        game.resources.stockpile.food--;
        colonist.needs.hunger = COLONIST_CONFIG.cookedFoodRestore;
        colonist.state = 'idle';
        if (colonist.traits.includes('gourmand')) {
            addThought(colonist, 'Delicious meal', TRAITS.gourmand.cookedFoodMoodBonus, COLONIST_CONFIG.mealMoodDuration, game.tick);
        } else {
            addThought(colonist, 'Ate a meal', COLONIST_CONFIG.mealMoodBonus, COLONIST_CONFIG.mealMoodDuration, game.tick);
        }
    } else {
        const eaten = eatRawFoodstuff(game);
        if (eaten) {
            colonist.needs.hunger = Math.min(100, colonist.needs.hunger + COLONIST_CONFIG.rawFoodRestore);
            colonist.state = 'idle';
            if (colonist.traits.includes('gourmand')) {
                addThought(colonist, 'Ate raw food', TRAITS.gourmand.rawFoodMoodPenalty, COLONIST_CONFIG.rawFoodMoodDuration, game.tick);
            } else {
                addThought(colonist, 'Ate raw food', COLONIST_CONFIG.rawFoodMoodPenalty, COLONIST_CONFIG.rawFoodMoodDuration, game.tick);
            }
        } else {
            colonist.state = 'idle';
            addThought(colonist, 'Starving', COLONIST_CONFIG.starvingMoodPenalty, COLONIST_CONFIG.starvingMoodDuration, game.tick);
        }
    }
}

function eatRawFoodstuff(game) {
    for (const item of FOODSTUFFS) {
        if ((game.resources.stockpile[item] || 0) > 0) {
            game.resources.stockpile[item]--;
            return true;
        }
    }
    return false;
}

function startSleeping(colonist, game) {
    if (colonist.assignedBed) {
        const path = findPath(game.map, colonist.x, colonist.y, colonist.assignedBed.x, colonist.assignedBed.y);
        if (path && path.length > 0) {
            colonist.path = path;
            colonist.state = 'moving';
            colonist.currentTaskId = null;
            colonist._sleepAfterMove = true;
            return;
        }
    }
    colonist.state = 'sleeping';
    colonist.stateTimer = COLONIST_CONFIG.sleepDuration;
}

function updateSleeping(colonist, game) {
    colonist.stateTimer--;
    let sleepRestMult = 1;
    if (colonist.traits.includes('light_sleeper')) sleepRestMult = TRAITS.light_sleeper.sleepRestMult;
    if (colonist.traits.includes('deep_sleeper')) sleepRestMult = TRAITS.deep_sleeper.sleepRestMult;
    colonist.needs.rest = Math.min(100, colonist.needs.rest + COLONIST_CONFIG.restPerTick * sleepRestMult);
    if (game.tick % 12 === 0) {
        game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: 'Zzz', color: '#8888ff', fontSize: 10, ttl: 11, maxTtl: 11 });
    }
    if (colonist.stateTimer <= 0 || colonist.needs.rest >= 100) {
        colonist.state = 'idle';
        const inBed = colonist.assignedBed &&
            colonist.x === colonist.assignedBed.x && colonist.y === colonist.assignedBed.y;
        if (inBed) {
            const roomId = game.map[colonist.y][colonist.x].roomId;
            if (roomId !== null && game.roomQualities[roomId]) {
                const rq = game.roomQualities[roomId];
                addThought(colonist, rq.tierName, rq.moodEffect, rq.duration, game.tick);
            } else if (roomId !== null) {
                addThought(colonist, 'Slept in nice room', COLONIST_CONFIG.sleptInRoomMoodBonus, COLONIST_CONFIG.sleptInRoomMoodDuration, game.tick);
            } else {
                addThought(colonist, 'Slept in bed', COLONIST_CONFIG.sleptInBedMoodBonus, COLONIST_CONFIG.sleptInBedMoodDuration, game.tick);
            }
        } else {
            addThought(colonist, 'Slept on the ground', COLONIST_CONFIG.sleptOnGroundMoodPenalty, COLONIST_CONFIG.sleptOnGroundMoodDuration, game.tick);
        }
    }
}

function updateFighting(colonist, game) {
    const target = findNearestHostile(colonist, game);
    if (!target) {
        colonist.state = 'idle';
        return;
    }

    const dist = manhattanDist(colonist.x, colonist.y, target.x, target.y);
    const waveActive = game.waves && game.waves.active && game.waves.enemies.length > 0;
    const weaponReach = colonist.weapon && colonist.weapon.ranged ? colonist.weapon.range : 0;
    const engageDist = Math.max(COLONIST_CONFIG.fightEngageDistance, weaponReach);
    if (dist > engageDist && !waveActive) {
        colonist.state = 'idle';
        return;
    }

    const fleeThreshold = colonist.traits.includes('brave')
        ? colonist.maxHp * TRAITS.brave.fleeHpMult
        : COLONIST_CONFIG.fleeHpThreshold;
    if (colonist.hp < fleeThreshold || colonist.traits.includes('pacifist')) {
        colonist.state = 'fleeing';
        return;
    }

    const weapon = colonist.weapon;
    const isRanged = weapon && weapon.ranged;
    const weaponRange = isRanged ? weapon.range : 1;

    const baseCooldown = (weapon && weapon.attackCooldown) || COLONIST_CONFIG.baseAttackCooldown;
    let atkSpeed = 1 + getEquipmentStat(colonist, 'attackSpeed');
    if (colonist.activeEffects) {
        for (const e of colonist.activeEffects) {
            if (e.type === 'attackSpeed' && e.attackSpeedBonus) atkSpeed += e.attackSpeedBonus;
        }
    }
    const effectiveCooldown = Math.max(1, Math.round(baseCooldown / atkSpeed));

    if (isRanged && dist <= weaponRange && dist >= 2 && hasLineOfSight(game.map, colonist.x, colonist.y, target.x, target.y)) {
        if (game.tick - (colonist._lastAttackTick || 0) < effectiveCooldown) return;
        colonist._lastAttackTick = game.tick;
        let weaponDmg = weapon.damage;
        for (const item of getEquippedItems(colonist)) {
            if (item !== weapon && item.damage) weaponDmg += item.damage;
        }
        let dmg = weaponDmg + Math.floor(Math.random() * COLONIST_CONFIG.combatDamageVariance);
        if (colonist.pedestalDamageBonus > 1) dmg = Math.floor(dmg * colonist.pedestalDamageBonus);
        const critChance = getEquipmentStat(colonist, 'critChance');
        if (critChance > 0 && Math.random() < critChance) {
            dmg *= 2;
            game.combatEffects.push({ x: target.x, y: target.y, char: COMBAT_VISUALS.hitChar, color: COMBAT_VISUALS.hitColor, ttl: COMBAT_VISUALS.hitTtl });
        }
        target.hp -= dmg;
        target._dmgFlashUntil = game.tick + COMBAT_VISUALS.dmgFlashTtl;
        colonist._atkShakeUntil = game.tick + COMBAT_VISUALS.atkShakeTtl;
        const projDuration = (dist / COMBAT_VISUALS.projectileSpeed) * 1000;
        game.projectiles.push({
            fromX: colonist.x, fromY: colonist.y, toX: target.x, toY: target.y,
            char: weapon.projectileChar || '-',
            color: weapon.projectileColor || '#ffaa33',
            skinKey: weapon.skinKey || 'projectile_arrow',
            _startTime: performance.now(), _duration: projDuration,
        });
    } else if (dist > 1 && (!isRanged || dist > weaponRange)) {
        const dx = Math.sign(target.x - colonist.x);
        const dy = Math.sign(target.y - colonist.y);
        const dur = CONFIG.TICK_RATE / game.speed;
        if (dx !== 0 && isPassable(game.map, colonist.x + dx, colonist.y)) {
            moveEntity(colonist, colonist.x + dx, colonist.y, dur);
        } else if (dy !== 0 && isPassable(game.map, colonist.x, colonist.y + dy)) {
            moveEntity(colonist, colonist.x, colonist.y + dy, dur);
        }
        return;
    } else {
        if (game.tick - (colonist._lastAttackTick || 0) < effectiveCooldown) return;
        colonist._lastAttackTick = game.tick;
        let weaponDmg = weapon ? weapon.damage : WEAPONS.fists.damage;
        for (const item of getEquippedItems(colonist)) {
            if (item !== weapon && item.damage) weaponDmg += item.damage;
        }
        let dmg = weaponDmg + Math.floor(Math.random() * COLONIST_CONFIG.combatDamageVariance);
        if (colonist.pedestalDamageBonus > 1) dmg = Math.floor(dmg * colonist.pedestalDamageBonus);
        const critChance = getEquipmentStat(colonist, 'critChance');
        if (critChance > 0 && Math.random() < critChance) {
            dmg *= 2;
            game.combatEffects.push({ x: target.x, y: target.y, char: COMBAT_VISUALS.hitChar, color: COMBAT_VISUALS.hitColor, ttl: COMBAT_VISUALS.hitTtl });
        }
        target.hp -= dmg;
        target._dmgFlashUntil = game.tick + COMBAT_VISUALS.dmgFlashTtl;
        colonist._atkShakeUntil = game.tick + COMBAT_VISUALS.atkShakeTtl;
    }

    if (target.hp <= 0) {
        const hpOnKill = getEquipmentStat(colonist, 'hpOnKill');
        if (hpOnKill > 0) colonist.hp = Math.min(colonist.maxHp, colonist.hp + hpOnKill);
        addThought(colonist, 'Won a fight', COLONIST_CONFIG.victoryMoodBonus, COLONIST_CONFIG.victoryMoodDuration, game.tick);
        colonist.state = 'idle';
    }
}

function updateHunting(colonist, game) {
    const threat = findNearestHostile(colonist, game);
    if (threat && manhattanDist(colonist.x, colonist.y, threat.x, threat.y) <= COLONIST_CONFIG.fightEngageDistance) {
        colonist.state = 'fighting';
        delete colonist.huntTargetId;
        return;
    }

    const animal = game.entities.find(a => a.id === colonist.huntTargetId && a.category === 'animal');
    if (!animal || animal.hp <= 0) {
        colonist.state = 'idle';
        delete colonist.huntTargetId;
        return;
    }

    const dist = manhattanDist(colonist.x, colonist.y, animal.x, animal.y);
    const weapon = colonist.weapon;
    const isRanged = weapon && weapon.ranged;
    const attackRange = isRanged ? weapon.range : 1;

    if (dist > attackRange) {
        const dx = Math.sign(animal.x - colonist.x);
        const dy = Math.sign(animal.y - colonist.y);
        const dur = CONFIG.TICK_RATE / game.speed;
        if (dx !== 0 && isPassable(game.map, colonist.x + dx, colonist.y)) {
            moveEntity(colonist, colonist.x + dx, colonist.y, dur);
        } else if (dy !== 0 && isPassable(game.map, colonist.x, colonist.y + dy)) {
            moveEntity(colonist, colonist.x, colonist.y + dy, dur);
        }
        return;
    }

    const baseCooldown = (weapon && weapon.attackCooldown) || COLONIST_CONFIG.baseAttackCooldown;
    let atkSpeed = 1 + getEquipmentStat(colonist, 'attackSpeed');
    if (colonist.activeEffects) {
        for (const e of colonist.activeEffects) {
            if (e.type === 'attackSpeed' && e.attackSpeedBonus) atkSpeed += e.attackSpeedBonus;
        }
    }
    const effectiveCooldown = Math.max(1, Math.round(baseCooldown / atkSpeed));

    if (game.tick - (colonist._lastAttackTick || 0) < effectiveCooldown) return;
    colonist._lastAttackTick = game.tick;

    let huntDmg = weapon ? weapon.damage : WEAPONS.fists.damage;
    for (const item of getEquippedItems(colonist)) {
        if (item !== weapon && item.damage) huntDmg += item.damage;
    }
    huntDmg += Math.floor(Math.random() * COLONIST_CONFIG.combatDamageVariance);
    if (colonist.pedestalDamageBonus > 1) huntDmg = Math.floor(huntDmg * colonist.pedestalDamageBonus);

    animal.hp -= huntDmg;
    animal._dmgFlashUntil = game.tick + COMBAT_VISUALS.dmgFlashTtl;
    colonist._atkShakeUntil = game.tick + COMBAT_VISUALS.atkShakeTtl;

    if (isRanged && dist >= 2) {
        const projDuration = (dist / COMBAT_VISUALS.projectileSpeed) * 1000;
        game.projectiles.push({
            fromX: colonist.x, fromY: colonist.y, toX: animal.x, toY: animal.y,
            char: weapon.projectileChar || '-',
            color: weapon.projectileColor || '#ffaa33',
            skinKey: weapon.skinKey || 'projectile_arrow',
            _startTime: performance.now(), _duration: projDuration,
        });
    }

    if (animal.hp <= 0) {
        colonist.state = 'idle';
        delete colonist.huntTargetId;
    }
}

function updateFleeing(colonist, game) {
    const threat = findNearestHostile(colonist, game);
    if (!threat || manhattanDist(colonist.x, colonist.y, threat.x, threat.y) > COLONIST_CONFIG.fleeDisengageDistance) {
        colonist.state = 'idle';
        return;
    }

    const dx = Math.sign(colonist.x - threat.x);
    const dy = Math.sign(colonist.y - threat.y);
    const nx = colonist.x + dx;
    const ny = colonist.y + dy;
    if (isPassable(game.map, nx, ny)) {
        moveEntity(colonist, nx, ny, CONFIG.TICK_RATE / game.speed);
    }
}

function updateDrafted(colonist, game) {
    if (!colonist.drafted) {
        colonist.state = 'idle';
        return;
    }
    const threat = findNearestHostile(colonist, game);
    if (threat) {
        const dist = manhattanDist(colonist.x, colonist.y, threat.x, threat.y);
        const wpnRange = colonist.weapon && colonist.weapon.ranged ? colonist.weapon.range : 0;
        const autoEngageDist = Math.max(COLONIST_CONFIG.fightEngageDistance, wpnRange);
        if (dist <= autoEngageDist) {
            colonist.state = 'fighting';
            return;
        }
    }
    if (colonist.moveCooldown > 0) {
        colonist.moveCooldown--;
        return;
    }
    if (colonist.draftTarget) {
        if (colonist.path.length === 0) {
            const path = findPath(game.map, colonist.x, colonist.y, colonist.draftTarget.x, colonist.draftTarget.y);
            if (path) colonist.path = path;
        }
        if (colonist.path.length > 0) {
            const next = colonist.path[0];
            if (isPassable(game.map, next.x, next.y)) {
                if (game.isTileOccupied(next.x, next.y) && colonist.path.length > 1) {
                    colonist._occupiedWait = (colonist._occupiedWait || 0) + 1;
                    if (colonist._occupiedWait < 3) {
                        colonist.moveCooldown = 1;
                        return;
                    }
                }
                colonist._occupiedWait = 0;
                colonist.path.shift();
                const cost = getMoveCost(game.map, next.x, next.y);
                const moveBonus = getMoveSpeedBonus(colonist);
                const dur = computeMoveDuration(cost, moveBonus, game.speed);
                moveEntity(colonist, next.x, next.y, dur);
                colonist.moveCooldown = computeMoveCooldown(cost, moveBonus);
            } else {
                colonist.path.shift();
            }
        }
        if (colonist.x === colonist.draftTarget.x && colonist.y === colonist.draftTarget.y) {
            colonist.draftTarget = null;
        }
    }
}

function updateWandering(colonist, game) {
    colonist.stateTimer--;
    if (colonist.stateTimer <= 0) {
        colonist.state = 'idle';
        return;
    }
    if (Math.random() < COLONIST_CONFIG.wanderChance) wander(colonist, game);
}

function findNearestHostile(colonist, game) {
    if (game.spatial) {
        return game.spatial.hostiles.findNearest(colonist.x, colonist.y, COLONIST_CONFIG.hostileSearchRadius, null);
    }
    let nearest = null;
    let minDist = Infinity;
    const waveEnemies = game.waves ? game.waves.enemies : [];
    const hostileWild = game.entities.filter(w => w.category === 'animal' && !w.tamed && w.hostile);
    for (const entity of [...hostileWild, ...game.raiders, ...waveEnemies]) {
        if (entity.hp <= 0) continue;
        if (!entity.hostile && !waveEnemies.includes(entity)) continue;
        const dist = manhattanDist(colonist.x, colonist.y, entity.x, entity.y);
        if (dist < minDist) {
            minDist = dist;
            nearest = entity;
        }
    }
    return nearest;
}

function isIndoors(colonist, map) {
    const tile = map[colonist.y]?.[colonist.x];
    return tile && tile.roomId !== null;
}

export function colonistTakeDamage(colonist, damage, game, attacker) {
    const dodgeChance = getEquipmentStat(colonist, 'dodgeChance');
    if (dodgeChance > 0 && Math.random() < dodgeChance) {
        game.combatEffects.push({ x: colonist.x, y: colonist.y, char: '~', color: '#88ccff', ttl: 4 });
        game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: 'Block!', color: '#4488ff', fontSize: 11, ttl: 12, maxTtl: 12 });
        window.soundManager?.playSFX('shield_block');
        return;
    }
    let mult = 1;
    if (colonist.traits.includes('tough')) mult *= TRAITS.tough.damageTakenMult;
    if (colonist.traits.includes('sturdy')) mult *= TRAITS.sturdy.damageTakenMult;
    mult *= getEquipmentDamageReduction(colonist);
    let shieldAbsorbed = false;
    if (colonist.activeEffects) {
        for (const e of colonist.activeEffects) {
            if (e.type === 'shield' && e.damageReduction) { mult *= (1 - e.damageReduction); shieldAbsorbed = true; }
        }
    }
    if (shieldAbsorbed) {
        game.combatEffects.push({ x: colonist.x, y: colonist.y, char: COMBAT_VISUALS.shieldBlockChar, color: COMBAT_VISUALS.shieldBlockColor, ttl: COMBAT_VISUALS.shieldBlockTtl });
        window.soundManager?.playSFX('shield_block');
    }
    const actualDmg = Math.floor(damage * mult);
    colonist.hp -= actualDmg;
    colonist._dmgFlashUntil = game.tick + COMBAT_VISUALS.dmgFlashTtl;
    if (actualDmg >= 5) {
        game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: `-${actualDmg}`, color: '#ff4444', fontSize: 12, ttl: 15, maxTtl: 15 });
    }
    window.soundManager?.playSFX('colonist_damaged');

    const thornsDamage = getEquipmentStat(colonist, 'thornsDamage');
    if (thornsDamage > 0 && attacker && attacker.hp > 0) {
        attacker.hp -= thornsDamage;
        game.combatEffects.push({ x: attacker.x, y: attacker.y, char: '*', color: '#ff6644', ttl: 3 });
        game.overlays.push({ type: 'floating_text', x: attacker.x, y: attacker.y, text: `-${thornsDamage}`, color: '#44ff44', fontSize: 11, ttl: 12, maxTtl: 12 });
    }

    if (colonist.state !== 'fighting' && colonist.state !== 'fleeing' && colonist.hp > 0) {
        game.eventLog.add(game, `${colonist.name} is under attack!`, 'danger', { type: 'colonist', id: colonist.id });
    }

    if (colonist.hp <= 0) {
        const art = colonist.artifact;
        if (art?.combat?.autoReviveHp && !colonist.artifactBroken) {
            colonist.hp = Math.floor(colonist.maxHp * art.combat.autoReviveHp);
            colonist.artifactBroken = true;
            game.eventLog.add(game, `${colonist.name}'s ${art.name} shatters, reviving them!`, 'success', { type: 'colonist', id: colonist.id });
            game.combatEffects.push({ x: colonist.x, y: colonist.y, char: '✦', color: '#ffdd44', ttl: 8 });
        } else {
            colonist.hp = 0;
            colonist.state = 'dead';
            game.combatEffects.push({ x: colonist.x, y: colonist.y, char: COMBAT_VISUALS.deathChar, color: COMBAT_VISUALS.deathColor, ttl: COMBAT_VISUALS.deathTtl });
            window.soundManager?.playSFX('colonist_death');
            game.eventLog.add(game, `${colonist.name} has died!`, 'danger', { type: 'colonist', id: colonist.id });
            game.story.checkMilestone('first_colonist_death', game);
            if (game.settings.pauseOnDeath && !game.paused) {
                game.paused = true;
                game.notifications.push({ text: `${colonist.name} has died! (auto-paused)`, tick: game.tick, type: 'danger' });
            }
            for (const other of game.colonists) {
                if (other.id !== colonist.id && other.hp > 0) {
                    const opinion = other.opinions?.[colonist.id] ?? 0;
                    const tier = getRelationshipTier(opinion).key;
                    if (tier === 'lovers') {
                        addThought(other, THOUGHTS.lover_died.text, THOUGHTS.lover_died.moodEffect, THOUGHTS.lover_died.duration, game.tick);
                    } else if (tier === 'close_friend') {
                        addThought(other, THOUGHTS.close_friend_died.text, THOUGHTS.close_friend_died.moodEffect, THOUGHTS.close_friend_died.duration, game.tick);
                    } else if (tier === 'friend') {
                        addThought(other, THOUGHTS.friend_died.text, THOUGHTS.friend_died.moodEffect, THOUGHTS.friend_died.duration, game.tick);
                    } else if (tier === 'acquaintance') {
                        addThought(other, THOUGHTS.acquaintance_died.text, THOUGHTS.acquaintance_died.moodEffect, THOUGHTS.acquaintance_died.duration, game.tick);
                    } else if (tier === 'rival') {
                        addThought(other, THOUGHTS.rival_died.text, THOUGHTS.rival_died.moodEffect, THOUGHTS.rival_died.duration, game.tick);
                    } else {
                        addThought(other, `${colonist.name} died`, COLONIST_CONFIG.deathMoodPenalty, COLONIST_CONFIG.deathMoodDuration, game.tick);
                    }
                }
            }
        }
    } else if (colonist.state !== 'fighting' && colonist.state !== 'fleeing') {
        colonist.state = 'fighting';
    }
}
