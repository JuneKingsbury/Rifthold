import { CONFIG, HUMAN_NAMES, NYMPH_NAMES, FERIN_NAMES, KOBALOS_NAMES, BUFOS_NAMES, RACES, COLONIST_APPEARANCE, COLONIST_CONFIG, TRAITS, TRAIT_EXCLUSIONS, NEED_DECAY, MOOD_THRESHOLDS, MOOD_SPEED_MULT, WEAPONS, POTIONS, SKILLS, MAGIC_SKILLS, MANA_CONFIG, MAGIC_STUDY_CONFIG, SPELLS, THOUGHTS, COMBAT_VISUALS, WORK_CONFIG, TASK_CONFIG, GOLEM_TYPES, SUMMON_TYPES, TASK_SPEED_STATS, DAY_NIGHT, SOCIAL_CONFIG } from '../core/config.js';
import { spawnParticle } from '../ui/overlay-renderer.js';
import { getRelationshipTier } from '../systems/social-utils.js';
import { findPath, findPathAdjacent, manhattanDist } from '../world/pathfinding.js';
import { isPassable, getMoveCost, hasLineOfSight, findLineOfSightTile, isWalkableFurniture } from '../world/map.js';
import { moveEntity, computeMoveDuration, computeMoveCooldown } from '../systems/movement-lerp.js';
import { FOODSTUFFS } from '../systems/resources.js';
import { spawnSummon } from './summons.js';
import { getNextId } from './entity-factory.js';
import { completeTask } from './task-executor.js';
import { getCraftSpeedBonus, getSpellCooldownMult } from '../systems/complexBuildings.js';

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

    // Randomly roll for colonist race.
    const raceKeys = Object.keys(RACES);
    const race = raceKeys[Math.floor(Math.random() * raceKeys.length)];

    let available;
    if (race === 'nymph') {
        available = NYMPH_NAMES.filter(n => !usedNames.has(n));
    }
    else if (race === 'ferin') {
        available = FERIN_NAMES.filter(n => !usedNames.has(n));
    }
    else if (race === 'kobalos') {
        available = KOBALOS_NAMES.filter(n => !usedNames.has(n));
    }
    else if (race === 'bufos') {
        available = BUFOS_NAMES.filter(n => !usedNames.has(n));
    }
    else {
        available = HUMAN_NAMES.filter(n => !usedNames.has(n));
    }

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
    // Add race-specific trait to colonist at the start of the array.
    traits.unshift(race);
    game.story.checkMilestone(`first_${race}_colonist_arrived`, game);

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
    if (traits.includes('magically_gifted')) {
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
    // Bufos can't use most hair styles, so default to bald for them.
    const bodyVariant = Math.floor(Math.random() * 1000) + 1;
    const hairVariant = race === 'bufos' ? 1 : Math.floor(Math.random() * 1000) + 1;
    const shirtVariant = Math.floor(Math.random() * 1000) + 1;

    // Random vibrant color: full hue wheel, stored as hex for use in canvas/input[type=color].
    const hue = Math.floor(Math.random() * 360);
    const nameColor = hslToHex(hue, 90, 65);

    return {
        id, name, x, y, skills, skillXp: {}, magicSkills, magicBias, traits,
        nameColor,
        race,
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
        attunedSchools: magicBias ? [magicBias] : [],
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
        clothes: null,
        tool: null,
        trinket: null,
        boots: null,
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

export function refreshCustomColonist(colonist) {
    const magicSkills = {};
    for (const [key, def] of Object.entries(MAGIC_SKILLS)) {
        const [min, max] = def.baseLevel;
        magicSkills[key] = min + Math.floor(Math.random() * (max - min + 1));
    }
    const magicKeys = Object.keys(MAGIC_SKILLS);
    let magicBias = null;
    if (colonist.traits.includes('magically_gifted')) {
        magicBias = magicKeys[Math.floor(Math.random() * magicKeys.length)];
        magicSkills[magicBias] = Math.min(10, magicSkills[magicBias] + (MAGIC_SKILLS[magicBias].biasBonus || 2));
    }

    // Magically Gifted colonists start knowing the level-0 spell for their magic school.
    const starterSpell = (colonist.traits.includes('magically_gifted') && magicBias)
        ? Object.entries(SPELLS).find(([, s]) => s.school === magicBias && s.minLevel === 0)?.[0] ?? null
        : null;

    const combinedMagicLevel = Object.values(magicSkills).reduce((sum, lvl) => sum + lvl, 0);
    const maxMana = MANA_CONFIG.baseMana + combinedMagicLevel * MANA_CONFIG.manaPerMagicLevel;

    // Ensure custom colonist starts with their spells and magic levels correctly.
    colonist.magicSkills = magicSkills;
    colonist.mana = maxMana;
    colonist.maxMana = maxMana;
    colonist.knownSpells = starterSpell ? [starterSpell] : [];
    colonist.disabledSpells = [];
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
        weapon: null, armor: null, helmet: null, clothes: null, tool: null, trinket: null, boots: null,
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
        if (colonist.needs.hunger < COLONIST_CONFIG.hungerMoodThreshold ) {
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
    if (colonist.traits.includes('comfort_eater')) hungerMult *= TRAITS.comfort_eater.hungerDecayMult;
    const hungerReduction = getEquipmentStat(colonist, 'hungerReduction');
    if (hungerReduction > 0) hungerMult *= (1 - hungerReduction);
    colonist.needs.hunger = Math.max(0, colonist.needs.hunger - NEED_DECAY.hunger * hungerMult);

    let restDecayMult = 1;
    if (colonist.traits.includes('light_sleeper')) restDecayMult = TRAITS.light_sleeper.restDecayMult;
    if (colonist.traits.includes('deep_sleeper')) restDecayMult = TRAITS.deep_sleeper.restDecayMult;
    restDecayMult *= getRaceModifier(colonist, 'restDecayMult', 1);
    // Tireless (enchantment) slows fatigue via an active 'rest' effect.
    if (colonist.activeEffects) {
        for (const e of colonist.activeEffects) {
            if (e.type === 'rest' && e.restDecayMult) restDecayMult *= e.restDecayMult;
        }
    }
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

    if (game.weather.currentWeather === 'heatwave' && !isIndoors(colonist, game.map)) {
        const heatRes = getEquipmentStat(colonist, 'heatResistance');
        if (heatRes <= 0 || Math.random() >= heatRes) {
            applyThought(colonist, 'overheating', game.tick);
        }
    }
}

function updateHealth(colonist) {
    if (colonist.hp >= colonist.maxHp) return;
    let regen = COLONIST_CONFIG.baseHealthRegen;
    regen += getEquipmentStat(colonist, 'healthRegen');
    regen += (colonist.pedestalHealthRegen || 0);
    regen *= (1 + getEquipmentStat(colonist, 'healthRegenBonus'));
    if (colonist.state === 'sleeping') regen *= COLONIST_CONFIG.healthRegenWhileSleeping;
    else if (colonist.state === 'idle') regen *= COLONIST_CONFIG.healthRegenWhileIdle;
    colonist.hp = Math.min(colonist.maxHp, colonist.hp + regen);
}

function updateMana(colonist) {
    if (colonist.mana >= colonist.maxMana) return;
    const combinedLevel = colonist._combinedMagicLevel || 0;
    let regen = MANA_CONFIG.baseRegen + combinedLevel * MANA_CONFIG.regenPerMagicLevel;
    regen += getEquipmentStat(colonist, 'manaRegen');
    let manaBonus = getEquipmentStat(colonist, 'manaRegenBonus');
    if (colonist.traits.includes('attuned')) manaBonus += TRAITS.attuned.manaRegenBonus;
    regen *= (1 + manaBonus);
    if (colonist.state === 'sleeping') regen *= MANA_CONFIG.regenWhileSleeping;
    else if (colonist.state === 'idle') regen *= MANA_CONFIG.regenWhileIdle;
    colonist.mana = Math.min(colonist.maxMana, colonist.mana + regen);
}

// Picks a colonist's default attuned schools: the highest-level schools up to the
// slot count. Used for save migration and as a fallback when none are set. Ties are
// broken by MAGIC_SKILLS declaration order. Returns [] when the colonist has no magic.
export function defaultAttunedSchools(colonist) {
    const skills = colonist.magicSkills || {};
    const ranked = Object.keys(skills)
        .filter(s => (skills[s] || 0) > 0)
        .sort((a, b) => (skills[b] || 0) - (skills[a] || 0));
    return ranked.slice(0, MAGIC_STUDY_CONFIG.attunementSlots);
}

// Whether a spell may autocast for this colonist. Unattuned schools are silent, so a
// colonist only actively channels magic from the (up to 2) schools the player assigns.
export function isSpellAttuned(colonist, spell) {
    if (!spell || !spell.school) return true;
    const attuned = colonist.attunedSchools;
    // No attunement set yet → allow everything (a not-yet-configured caster still works).
    if (!Array.isArray(attuned) || attuned.length === 0) return true;
    return attuned.includes(spell.school);
}

// Effect-magnitude multiplier from school mastery: each school level above a spell's
// minLevel makes that spell stronger, rewarding deep single-school investment. Stacks
// with equipment bonuses. Divination effects opt out (binary world-state changes).
export function getSpellPower(colonist, spell) {
    if (!spell || !spell.school) return 1;
    if (spell.powerScale === 0 || spell.effect === 'divination_modifier') return 1;
    const level = (colonist.magicSkills?.[spell.school]) || 0;
    const over = Math.max(0, level - (spell.minLevel || 0));
    const scale = spell.powerScale !== undefined ? spell.powerScale : MAGIC_STUDY_CONFIG.spellPowerPerLevel;
    return 1 + over * scale;
}

// Per-school equipment bonus (e.g. an item with `evocationBonus`) plus the generic
// `spellDamageBonus`, both additive. Lets gear commit a colonist to one school.
function getEquipmentSchoolBonus(colonist, spell) {
    let bonus = getEquipmentSpellBonus(colonist);
    if (spell.school) bonus += getEquipmentStat(colonist, `${spell.school}Bonus`);
    return bonus;
}

// Damage multiplier: school mastery (getSpellPower) times equipment bonuses.
export function getSpellDamageMult(colonist, spell) {
    return getSpellPower(colonist, spell) * (1 + getEquipmentSchoolBonus(colonist, spell));
}

// Duration multiplier for buffs/growth: school mastery times gear spellDurationBonus.
export function getSpellDurationMult(colonist, spell) {
    return getSpellPower(colonist, spell) * (1 + getEquipmentStat(colonist, 'spellDurationBonus'));
}

// School levels above minLevel make casting cheaper (mastery breeds efficiency).
// Stacks with equipment spellCostReduction. Floors at 1 mana.
export function getEffectiveManaCost(colonist, spell) {
    const level = (colonist.magicSkills?.[spell.school]) || 0;
    const over = Math.max(0, level - (spell.minLevel || 0));
    const levelReduction = Math.min(
        MAGIC_STUDY_CONFIG.manaCostReductionCap,
        over * MAGIC_STUDY_CONFIG.manaCostReductionPerLevel,
    );
    const gearReduction = getEquipmentStat(colonist, 'spellCostReduction');
    const mult = Math.max(0, (1 - levelReduction) * (1 - gearReduction));
    return Math.max(1, Math.floor(spell.manaCost * mult));
}

// School levels above minLevel shorten cooldowns, so a specialist recasts faster.
// Returns a multiplier applied on top of the global getSpellCooldownMult.
export function getSpellCooldownFactor(colonist, spell) {
    const level = (colonist.magicSkills?.[spell.school]) || 0;
    const over = Math.max(0, level - (spell.minLevel || 0));
    const reduction = Math.min(
        MAGIC_STUDY_CONFIG.cooldownReductionCap,
        over * MAGIC_STUDY_CONFIG.cooldownReductionPerLevel,
    );
    const gearReduction = getEquipmentStat(colonist, 'spellCooldownReduction');
    return Math.max(0.1, (1 - reduction) * (1 - gearReduction));
}

export function recalcMaxMana(colonist) {
    const levels = Object.values(colonist.magicSkills);
    const combinedLevel = levels.reduce((sum, lvl) => sum + lvl, 0);
    const maxLevel = levels.length ? Math.max(...levels) : 0;
    colonist._combinedMagicLevel = combinedLevel;
    // Focus-weighted pool: the highest school pays full rate, the rest pay only
    // manaFocusFactor. Deep single-school investment grows mana faster than breadth.
    const focusedLevels = maxLevel + (combinedLevel - maxLevel) * MANA_CONFIG.manaFocusFactor;
    colonist.maxMana = MANA_CONFIG.baseMana + focusedLevels * MANA_CONFIG.manaPerMagicLevel;
    if (colonist.traits.includes('attuned')) colonist.maxMana = Math.round(colonist.maxMana * TRAITS.attuned.maxManaMult);
    colonist.maxMana = Math.round(colonist.maxMana);
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
    if (colonist.traits.includes('workaholic') && colonist.state === 'idle') {
        addThought(colonist, 'Restless with nothing to do', TRAITS.workaholic.idleMoodPenalty, 30, game.tick);
    }
    if (colonist.traits.includes('menagerist')) {
        const nearTamed = game.entities.some(e => e.category === 'animal' && e.tamed && e.hp > 0 &&
            manhattanDist(colonist.x, colonist.y, e.x, e.y) <= COLONIST_CONFIG.socialRange);
        if (nearTamed) addThought(colonist, 'Comforted by animals', TRAITS.menagerist.tamedAnimalMoodAura, 20, game.tick);
    }

    const indoorPenalty = getRaceModifier(colonist, 'indoorMoodPenalty', 0);
    if (indoorPenalty < 0) {
        if (isIndoors(colonist, game.map)) {
            addThought(colonist, 'Restless indoors', indoorPenalty, 20, game.tick);
        } else {
            addThought(colonist, 'At home outdoors', 3, 20, game.tick);
        }
    }

    const isoPenalty = getRaceModifier(colonist, 'isolatedMoodPenalty', 0);
    if (isoPenalty < 0) {
        const nearOthers = game.colonists.some(c => c.id !== colonist.id && c.hp > 0 &&
            manhattanDist(colonist.x, colonist.y, c.x, c.y) <= COLONIST_CONFIG.socialRange);
        if (!nearOthers) addThought(colonist, 'Rattled alone', isoPenalty, 20, game.tick);
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
        window.soundManager?.playSFX('freezing');
    } else if (!freezing) {
        flags.freezing = false;
    }

    const overheating = colonist.thoughts.some(t => t.text === 'Overheating outside');
    if (overheating && !flags.overheating) {
        flags.overheating = true;
        game.notifications.push({ text: `${colonist.name} is overheating!`, tick: game.tick, type: 'warning' });
        game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: 'Overheating!', color: '#ff8844', fontSize: 11, ttl: 12, maxTtl: 12 });
    } else if (!overheating) {
        flags.overheating = false;
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
    if (colonist.traits.includes('volatile')) {
        if (effect > 0) effect *= TRAITS.volatile.positiveThoughtMult;
        else if (effect < 0) effect *= TRAITS.volatile.negativeThoughtMult;
    }

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

// Whether a colonist should enter a mental break. Steadfast lowers the effective
// breaking threshold, so it takes a deeper mood dip to trigger a break.
function isBreaking(colonist) {
    let threshold = MOOD_THRESHOLDS.stressed;
    if (colonist.traits.includes('steadfast')) threshold *= TRAITS.steadfast.breakThresholdMult;
    return colonist.mood < threshold;
}

// True if a friend, close friend, or lover is within social range. Backs the
// Loyal trait's proximity work buff. Relationship tiers are stored per-colonist
// in `relationships` (see social.js), keyed by the other colonist's id.
function isNearFriend(colonist, game) {
    const rels = colonist.relationships;
    if (!rels) return false;
    const friendTiers = ['friend', 'close_friend', 'lovers'];
    return (game.colonists || []).some(other =>
        other.id !== colonist.id && other.hp > 0 && !other.onExpedition &&
        friendTiers.includes(rels[other.id]) &&
        manhattanDist(colonist.x, colonist.y, other.x, other.y) <= COLONIST_CONFIG.socialRange);
}

function getWorkSpeed(colonist, game) {
    let speed = 1.0;
    const moodLevel = getMoodLevel(colonist.mood);
    speed *= MOOD_SPEED_MULT[moodLevel];

    if (colonist.traits.includes('hard_worker')) speed *= (1 + TRAITS.hard_worker.workSpeedBonus);
    if (colonist.traits.includes('lazy')) speed *= (1 + TRAITS.lazy.workSpeedBonus);
    if (colonist.traits.includes('sturdy')) speed *= (1 + TRAITS.sturdy.workSpeedBonus);
    if (colonist.traits.includes('workaholic')) speed *= (1 + TRAITS.workaholic.workSpeedBonus);
    if (colonist.traits.includes('insomniac')) speed *= (1 + TRAITS.insomniac.workSpeedBonus);
    if (colonist.traits.includes('loyal') && isNearFriend(colonist, game)) speed *= TRAITS.loyal.loyalWorkMult;
    speed *= (1 + getRaceModifier(colonist, 'workSpeedBonus', 0));

    const t = game.timeOfDay / CONFIG.TICKS_PER_DAY;
    const isNight = t > DAY_NIGHT.nightStart || t < DAY_NIGHT.dayStart;
    if (colonist.traits.includes('night_owl')) {
        speed *= isNight ? TRAITS.night_owl.nightSpeedMult : TRAITS.night_owl.daySpeedMult;
    }
    if (colonist.traits.includes('early_bird')) {
        speed *= isNight ? TRAITS.early_bird.nightSpeedMult : TRAITS.early_bird.daySpeedMult;
    }
    speed *= isNight ? getRaceModifier(colonist, 'nightSpeedMult', 1) : getRaceModifier(colonist, 'daySpeedMult', 1);

    return speed;
}

export function getEquippedItems(colonist) {
    const items = [];
    if (colonist.weapon) items.push(colonist.weapon);
    if (colonist.armor) items.push(colonist.armor);
    if (colonist.helmet) items.push(colonist.helmet);
    if (colonist.clothes) items.push(colonist.clothes);
    if (colonist.tool) items.push(colonist.tool);
    if (colonist.boots) items.push(colonist.boots);
    if (colonist.trinket && !colonist.trinketBroken) items.push(colonist.trinket);
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
    bonus += getRaceModifier(colonist, 'moveSpeedBonus', 0);
    return Math.min(bonus, 0.8);
}

// Reads a numeric modifier field off the colonist's race entry in TRAITS.
// Returns `def` when absent so callers can multiply/add unconditionally.
// Anything without a `.race` (e.g. golems) falls through to the default.
export function getRaceModifier(colonist, field, def) {
    const raceDef = colonist.race ? TRAITS[colonist.race] : null;
    const v = raceDef?.[field];
    return typeof v === 'number' ? v : def;
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

function getRangedWeaponRange(colonist, game) {
    if (!colonist.weapon || !colonist.weapon.ranged) return 0;
    let range = colonist.weapon.range;
    if (game && game.research.isResearched('marksmanship')) range += 1;
    return range;
}

function getEquipmentDamageReduction(colonist) {
    let mult = 1;
    for (const item of getEquippedItems(colonist)) {
        if (item.damageReduction) mult *= (1 - item.damageReduction);
    }
    return mult;
}

function getEquipmentSpellBonus(colonist) {
    let bonus = 0;
    for (const item of getEquippedItems(colonist)) {
        if (item.spellDamageBonus) bonus += item.spellDamageBonus;
    }
    if (colonist.traits.includes('spellsword')) bonus += TRAITS.spellsword.spellDamageBonus;
    return bonus;
}

// Total crit chance from equipment plus the Deadeye trait.
function getCritChance(colonist) {
    let crit = getEquipmentStat(colonist, 'critChance');
    if (colonist.traits.includes('deadeye')) crit += TRAITS.deadeye.critChance;
    return crit;
}

// Trait-based multiplier on outgoing melee/ranged damage. Berserker ramps up
// once the colonist drops below its HP threshold.
function getTraitDamageMult(colonist) {
    let mult = 1;
    if (colonist.traits.includes('berserker') &&
        colonist.hp < colonist.maxHp * TRAITS.berserker.lowHpThreshold) {
        mult *= TRAITS.berserker.lowHpDamageMult;
    }
    return mult;
}

export function getEquipmentStat(colonist, stat) {
    if (!colonist._equipStatCache) {
        const cache = {};
        for (const item of getEquippedItems(colonist)) {
            for (const key in item) {
                if (typeof item[key] === 'number' && key !== 'tier' && key !== 'level') {
                    cache[key] = (cache[key] || 0) + item[key];
                }
            }
        }
        colonist._equipStatCache = cache;
    }
    return colonist._equipStatCache[stat] || 0;
}

export function invalidateEquipStatCache(colonist) {
    colonist._equipStatCache = null;
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
    if (colonist.traits.includes('magically_inept')) castXpGain *= TRAITS.magically_inept.magicXpMult;
    castXpGain *= getRaceModifier(colonist, 'magicXpMult', 1);
    colonist._magicXpAccumulator[school] += castXpGain;
    let magicXpNeeded = MAGIC_STUDY_CONFIG.magicXpToLevel + colonist.magicSkills[school] * MAGIC_STUDY_CONFIG.magicXpScalePerLevel;
    while (colonist._magicXpAccumulator[school] >= magicXpNeeded && colonist.magicSkills[school] < 10) {
        colonist._magicXpAccumulator[school] -= magicXpNeeded;
        colonist.magicSkills[school] = Math.min(10, colonist.magicSkills[school] + 1);
        recalcMaxMana(colonist);
        game.notifications.push({ text: `${colonist.name}'s ${MAGIC_SKILLS[school].name} increased to ${colonist.magicSkills[school]}`, tick: game.tick, type: 'success' });
        game.eventLog.add(game, `${colonist.name}'s ${MAGIC_SKILLS[school].name} increased to ${colonist.magicSkills[school]}!`, 'success', { type: 'colonist', id: colonist.id });
        game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: `${MAGIC_SKILLS[school].name} lvl ${colonist.magicSkills[school]}`, color: '#aa66ff', fontSize: 11, ttl: 20, maxTtl: 20 });
        // Level-up starburst particles
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            spawnParticle(game, {
                x: colonist.x + 0.5, y: colonist.y + 0.5,
                vx: Math.cos(angle) * 0.5, vy: Math.sin(angle) * 0.5,
                decay: 0.04,
                color: i % 2 === 0 ? '#aa66ff' : '#ffdd44',
                size: 3,
                alpha: 1,
                shape: 'square',
            });
        }
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
        // Only autocast from schools the colonist is attuned to (up to attunementSlots).
        if (!isSpellAttuned(colonist, spell)) continue;
        const effectiveCooldown = spell.cooldown * getSpellCooldownMult(game) * getSpellCooldownFactor(colonist, spell);
        if (colonist._spellCooldowns[spellKey] && game.tick - colonist._spellCooldowns[spellKey] < effectiveCooldown) continue;
        const effectiveCost = getEffectiveManaCost(colonist, spell);
        if (colonist.mana < effectiveCost) {
            game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: 'No mana', color: '#6688cc', fontSize: 10, ttl: 10, maxTtl: 10 });
            continue;
        }

        if (!shouldCastSpell(colonist, spell, game)) continue;

        colonist.mana -= effectiveCost;
        colonist._spellCooldowns[spellKey] = game.tick;
        // Render latch for the per-school cast animation (js/ui/entity-animation.js).
        colonist._lastCastTick = game.tick;
        colonist._lastCastSchool = spell.school;
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
            if (dist > (spell.range || COLONIST_CONFIG.fightEngageDistance)) return false;
            // Damage spells need a clear shot. Buffs, teleports and summons may still
            // trigger with an enemy behind cover.
            const needsLos = spell.effect === 'ranged_damage' || spell.effect === 'ranged_damage_aoe';
            if (needsLos && !hasLineOfSight(game.map, colonist.x, colonist.y, hostile.x, hostile.y)) return false;
            return true;
        }
        case 'lowHealth':
            return colonist.hp < colonist.maxHp * (spell.hpThreshold || 0.5);
        case 'woundedNearby': {
            // Fires when the caster, or any living ally within range, is below the
            // heal threshold. The cast itself (see 'heal' effect) then mends whoever
            // is most wounded among that set. One abjurer covers both self and their team.
            const threshold = spell.hpThreshold || 0.5;
            if (colonist.hp < colonist.maxHp * threshold) return true;
            const range = spell.range || COLONIST_CONFIG.hostileSearchRadius;
            return game.colonists.some(c => c.id !== colonist.id && c.hp > 0 &&
                c.hp < c.maxHp * threshold &&
                manhattanDist(colonist.x, colonist.y, c.x, c.y) <= range);
        }
        case 'hasTask':
            if (spell.idleExclude && colonist.state === 'idle') return false;
            return colonist.currentTaskId !== null && (colonist.state === 'moving' || colonist.state === 'working');
        case 'always':
            if (spell.idleExclude && colonist.state === 'idle') return false;
            return true;
        case 'cropsNearby':
            return findNearestGrowingCrop(colonist, game, spell.range || 5) !== null;
        case 'debuffNearby': {
            // Fires when the caster or a living ally in range carries a harmful active
            // effect (bleed/poison/burn DoT, or a slow). Used by Cleanse.
            const range = spell.range || 6;
            return getBuffTargets(colonist, game, range).some(hasHarmfulEffect);
        }
        case 'canTransmute':
            // Fires when the transmutation's input is affordable. A spell with no
            // `fromResource` (e.g. Transmute Stone, conjured from raw earth) is always
            // castable. Otherwise the stockpile must hold `inputAmount` of the input.
            if (!spell.fromResource) return true;
            return (game.resources.stockpile[spell.fromResource] || 0) >= (spell.inputAmount || 1);
        default:
            return false;
    }
}

// True when a colonist carries at least one harmful active effect (a DoT such as
// bleed/poison/burn, or a movement/work slow). Beneficial effects (speed, shield,
// absorb, quality, rest) are ignored. Used by Cleanse's trigger and effect.
function hasHarmfulEffect(c) {
    if (!c.activeEffects) return false;
    return c.activeEffects.some(e => e.type === 'dot' || e.type === 'slow' || e.harmful);
}

// Returns the colonist plus any allied colonists within `radius` (Manhattan), the
// recipients of an area buff. When radius is falsy the buff is self-only, preserving
// single-target behavior for spells that don't opt into an AoE. This is what lets one
// enchanter/abjurer support squadmates who aren't attuned to that school themselves.
function getBuffTargets(colonist, game, radius) {
    if (!radius) return [colonist];
    const targets = [colonist];
    for (const c of game.colonists) {
        if (c.id === colonist.id || c.hp <= 0) continue;
        if (manhattanDist(colonist.x, colonist.y, c.x, c.y) <= radius) targets.push(c);
    }
    return targets;
}

// Picks the most wounded heal target (lowest HP fraction) among the caster and any
// living ally within `range` that is below full HP. The caster is always a candidate
// regardless of distance. Returns null only when nobody is wounded. Used by heals.
function findMostWoundedTarget(colonist, game, range) {
    let best = colonist.hp < colonist.maxHp ? colonist : null;
    let bestFrac = best ? best.hp / best.maxHp : Infinity;
    for (const c of game.colonists) {
        if (c.id === colonist.id || c.hp <= 0 || c.hp >= c.maxHp) continue;
        if (manhattanDist(colonist.x, colonist.y, c.x, c.y) > range) continue;
        const frac = c.hp / c.maxHp;
        if (frac < bestFrac) { bestFrac = frac; best = c; }
    }
    return best;
}

// Finds the nearest farm tile in the 'growing' state within `range` (Manhattan)
// of the colonist, used by crop-boost spells to decide whether to auto-cast and
// where to center the effect. Returns {x, y} or null when none is in range.
function findNearestGrowingCrop(colonist, game, range) {
    let best = null;
    let bestDist = Infinity;
    const consider = (x, y) => {
        const tile = game.map[y]?.[x];
        if (!tile || !tile.zone || tile.zone.state !== 'growing') return;
        const d = manhattanDist(colonist.x, colonist.y, x, y);
        if (d <= range && d < bestDist) { bestDist = d; best = { x, y }; }
    };
    if (game.mapIndex) {
        for (const { x, y } of game.mapIndex.getZonePositions()) consider(x, y);
    } else {
        for (let y = Math.max(0, colonist.y - range); y <= Math.min(game.map.length - 1, colonist.y + range); y++) {
            for (let x = Math.max(0, colonist.x - range); x <= Math.min(game.map[y].length - 1, colonist.x + range); x++) {
                consider(x, y);
            }
        }
    }
    return best;
}

// All living hostile entities in the colony (raiders, void-wave enemies, and
// untamed hostile wildlife). The target pool for damage/CC spells that arc or
// bounce beyond a single foe. Mirrors the inline set built in ranged_damage_aoe.
function getColonyHostiles(game) {
    return [
        ...game.raiders,
        ...(game.waves ? game.waves.enemies : []),
        ...game.entities.filter(w => w.category === 'animal' && !w.tamed && w.hostile),
    ].filter(h => h.hp > 0);
}

// Applies a movement/attack "slow" to a hostile entity for `ticks`, stored as a
// tick deadline the enemy AI (roles.js/combat.js) reads. slowMult<1 scales its
// effective speed. Extends rather than stacks: keeps the later expiry.
function applyEnemySlow(entity, ticks, slowMult, game) {
    const until = game.tick + ticks;
    if (!entity._slowUntil || until > entity._slowUntil) {
        entity._slowUntil = until;
        entity._slowMult = slowMult;
    }
}

// Stuns a hostile entity for `ticks` (a tick deadline the enemy AI reads to skip
// its attack and movement). Extends rather than stacks.
function applyEnemyStun(entity, ticks, game) {
    const until = game.tick + ticks;
    if (!entity._stunnedUntil || until > entity._stunnedUntil) entity._stunnedUntil = until;
}

function applySpellEffect(colonist, spell, game) {
    switch (spell.effect) {
        case 'ranged_damage': {
            const target = findNearestHostile(colonist, game);
            if (!target) return;
            const dist = manhattanDist(colonist.x, colonist.y, target.x, target.y);
            if (dist > spell.range) return;
            if (!hasLineOfSight(game.map, colonist.x, colonist.y, target.x, target.y)) return;
            const dmg = Math.floor(spell.damage * getSpellDamageMult(colonist, spell));
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
            if (!hasLineOfSight(game.map, colonist.x, colonist.y, target.x, target.y)) return;
            const aoeDmg = Math.floor(spell.damage * getSpellDamageMult(colonist, spell));
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
            const dmg = Math.floor(spell.damage * getSpellDamageMult(colonist, spell));
            target.hp -= dmg;
            target._dmgFlashUntil = game.tick + COMBAT_VISUALS.dmgFlashTtl;
            colonist._atkShakeUntil = game.tick + COMBAT_VISUALS.atkShakeTtl;
            game.combatEffects.push({ x: target.x, y: target.y, char: spell.projectileChar || '✝', color: spell.projectileColor || '#ffffaa', ttl: 4 });
            break;
        }
        case 'boost_crops': {
            // Center the boost box on the nearest growing crop (not the colonist)
            // so the radius lands on actual crops. shouldCastSpell's cropsNearby
            // trigger guarantees one exists, but guard anyway.
            const center = findNearestGrowingCrop(colonist, game, spell.range || 5);
            if (!center) return;
            // School mastery boosts growth strength above the baseline of 1.0.
            const cropPower = getSpellPower(colonist, spell);
            const boostedMult = 1 + (spell.growthMult - 1) * cropPower;
            const boostedDuration = Math.round(spell.duration * getSpellDurationMult(colonist, spell));
            for (let dy = -spell.radius; dy <= spell.radius; dy++) {
                for (let dx = -spell.radius; dx <= spell.radius; dx++) {
                    const tx = center.x + dx;
                    const ty = center.y + dy;
                    if (tx < 0 || ty < 0 || tx >= CONFIG.MAP_WIDTH || ty >= CONFIG.MAP_HEIGHT) continue;
                    const tile = game.map[ty][tx];
                    if (tile.zone && tile.zone.state === 'growing') {
                        if (!tile.zone._growthBoost) tile.zone._growthBoost = { mult: 1, expiresAt: 0 };
                        tile.zone._growthBoost.mult = boostedMult;
                        tile.zone._growthBoost.expiresAt = game.tick + boostedDuration;
                    }
                    game.combatEffects.push({ x: tx, y: ty, char: COMBAT_VISUALS.spellGrowthChar, color: COMBAT_VISUALS.spellGrowthColor, ttl: 4 });
                }
            }
            window.soundManager?.playSFX('spell_growth');
            break;
        }
        case 'heal': {
            // Heal amount scales with school mastery and healing gear. Mends whoever is
            // most wounded among the caster and nearby allies, so an abjurer supports
            // both itself and colonists who aren't attuned to healing.
            const healAmount = Math.round(spell.healAmount * getSpellPower(colonist, spell) * (1 + getEquipmentStat(colonist, 'spellHealBonus')));
            const healTarget = findMostWoundedTarget(colonist, game, spell.range || 6);
            if (!healTarget) return;
            healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + healAmount);
            game.combatEffects.push({ x: healTarget.x, y: healTarget.y, char: COMBAT_VISUALS.spellHealChar, color: COMBAT_VISUALS.spellHealColor, ttl: 3 });
            window.soundManager?.playSFX('spell_heal');
            break;
        }
        case 'buff_speed': {
            // Buffs the caster plus nearby allied colonists (within spell.radius, if
            // set) so a single enchanter accelerates the whole squad. Duration scales
            // with school mastery and gear.
            const duration = Math.round(spell.duration * getSpellDurationMult(colonist, spell));
            for (const ally of getBuffTargets(colonist, game, spell.radius)) {
                if (!ally.activeEffects) ally.activeEffects = [];
                ally.activeEffects.push({
                    type: 'speed',
                    source: 'spell',
                    moveSpeedBonus: spell.moveSpeedBonus || 0,
                    workSpeedBonus: spell.workSpeedBonus || 0,
                    expiresAt: game.tick + duration,
                });
                game.combatEffects.push({ x: ally.x, y: ally.y, char: COMBAT_VISUALS.spellBuffChar, color: COMBAT_VISUALS.spellBuffColor, ttl: 2 });
            }
            window.soundManager?.playSFX('spell_buff');
            break;
        }
        case 'buff_defense': {
            // Shields the caster plus nearby allied colonists (within spell.radius, if
            // set). Damage reduction scales with school mastery, capped below 100%.
            const dr = Math.min(0.75, (spell.damageReduction || 0.3) * getSpellPower(colonist, spell));
            const shieldDuration = Math.round(spell.duration * getSpellDurationMult(colonist, spell));
            for (const ally of getBuffTargets(colonist, game, spell.radius)) {
                if (!ally.activeEffects) ally.activeEffects = [];
                ally.activeEffects.push({
                    type: 'shield',
                    source: 'spell',
                    damageReduction: dr,
                    expiresAt: game.tick + shieldDuration,
                });
                game.combatEffects.push({ x: ally.x, y: ally.y, char: COMBAT_VISUALS.spellShieldChar, color: COMBAT_VISUALS.spellShieldColor, ttl: 3 });
                game.combatEffects.push({ x: ally.x, y: ally.y, char: COMBAT_VISUALS.spellBuffChar, color: COMBAT_VISUALS.spellBuffColor, ttl: 3 });
            }
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
        case 'chain_damage': {
            // Bolt hits the nearest hostile then arcs to successively nearer foes
            // within chainRange, losing chainFalloff of its damage each hop. Never
            // hits the same target twice. Damage scales with evocation mastery.
            const first = findNearestHostile(colonist, game);
            if (!first) return;
            const dist = manhattanDist(colonist.x, colonist.y, first.x, first.y);
            if (dist > spell.range) return;
            if (!hasLineOfSight(game.map, colonist.x, colonist.y, first.x, first.y)) return;
            const pool = getColonyHostiles(game);
            const baseDmg = spell.damage * getSpellDamageMult(colonist, spell);
            const hit = new Set();
            let current = first;
            let dmg = baseDmg;
            let fromX = colonist.x, fromY = colonist.y;
            for (let hop = 0; hop < (spell.chainTargets || 1) && current; hop++) {
                hit.add(current);
                const applied = Math.floor(dmg);
                current.hp -= applied;
                current._dmgFlashUntil = game.tick + COMBAT_VISUALS.dmgFlashTtl;
                const projDur = (manhattanDist(fromX, fromY, current.x, current.y) / COMBAT_VISUALS.projectileSpeed) * 1000;
                game.projectiles.push({
                    fromX, fromY, toX: current.x, toY: current.y,
                    char: spell.projectileChar || '⚡',
                    color: spell.projectileColor || '#88ddff',
                    skinKey: 'projectile_spell',
                    _startTime: performance.now(), _duration: projDur,
                });
                // Find next-nearest unhit hostile within chainRange of current node.
                fromX = current.x; fromY = current.y;
                let next = null, nextDist = Infinity;
                for (const h of pool) {
                    if (hit.has(h)) continue;
                    const d = manhattanDist(current.x, current.y, h.x, h.y);
                    if (d <= (spell.chainRange || 4) && d < nextDist) { nextDist = d; next = h; }
                }
                current = next;
                dmg *= (spell.chainFalloff || 0.6);
            }
            window.soundManager?.playSFX('spell_cast');
            break;
        }
        case 'ranged_damage_slow': {
            // Single-target damage that also slows the victim's movement/attacks.
            const target = findNearestHostile(colonist, game);
            if (!target) return;
            const dist = manhattanDist(colonist.x, colonist.y, target.x, target.y);
            if (dist > spell.range) return;
            if (!hasLineOfSight(game.map, colonist.x, colonist.y, target.x, target.y)) return;
            const dmg = Math.floor(spell.damage * getSpellDamageMult(colonist, spell));
            target.hp -= dmg;
            target._dmgFlashUntil = game.tick + COMBAT_VISUALS.dmgFlashTtl;
            applyEnemySlow(target, spell.slowDuration || 60, spell.slowMult || 0.5, game);
            const projDur = (dist / COMBAT_VISUALS.projectileSpeed) * 1000;
            game.projectiles.push({
                fromX: colonist.x, fromY: colonist.y, toX: target.x, toY: target.y,
                char: spell.projectileChar || '❄',
                color: spell.projectileColor || '#aaddff',
                skinKey: 'projectile_spell',
                _startTime: performance.now(), _duration: projDur,
            });
            game.combatEffects.push({ x: target.x, y: target.y, char: spell.projectileChar || '❄', color: spell.projectileColor || '#aaddff', ttl: 4 });
            break;
        }
        case 'chain_heal': {
            // Mirror of chain_damage on friendlies: mends the most-wounded ally in
            // range, then bounces to successively nearer wounded allies within
            // chainRange, losing chainFalloff of its potency each hop.
            const healBase = spell.healAmount * getSpellPower(colonist, spell) * (1 + getEquipmentStat(colonist, 'spellHealBonus'));
            const first = findMostWoundedTarget(colonist, game, spell.range || 6);
            if (!first) return;
            const healed = new Set();
            let current = first;
            let amount = healBase;
            for (let hop = 0; hop < (spell.chainTargets || 1) && current; hop++) {
                healed.add(current);
                current.hp = Math.min(current.maxHp, current.hp + Math.round(amount));
                game.combatEffects.push({ x: current.x, y: current.y, char: COMBAT_VISUALS.spellHealChar, color: COMBAT_VISUALS.spellHealColor, ttl: 3 });
                // Next hop: nearest wounded, un-healed ally within chainRange.
                let next = null, nextDist = Infinity;
                for (const c of game.colonists) {
                    if (healed.has(c) || c.hp <= 0 || c.hp >= c.maxHp) continue;
                    const d = manhattanDist(current.x, current.y, c.x, c.y);
                    if (d <= (spell.chainRange || 5) && d < nextDist) { nextDist = d; next = c; }
                }
                current = next;
                amount *= (spell.chainFalloff || 0.6);
            }
            window.soundManager?.playSFX('spell_heal');
            break;
        }
        case 'cleanse': {
            // Strips harmful active effects (DoTs, slows) from the most-afflicted
            // ally in range (the caster included). Also clears any slow deadline.
            const targets = getBuffTargets(colonist, game, spell.range || 6).filter(hasHarmfulEffect);
            if (targets.length === 0) return;
            // Most-afflicted = most harmful effects stacked.
            targets.sort((a, b) => countHarmful(b) - countHarmful(a));
            const cleansed = targets[0];
            cleansed.activeEffects = (cleansed.activeEffects || []).filter(e => !(e.type === 'dot' || e.type === 'slow' || e.harmful));
            cleansed._slowUntil = 0;
            game.combatEffects.push({ x: cleansed.x, y: cleansed.y, char: COMBAT_VISUALS.spellHealChar, color: '#ffffaa', ttl: 4 });
            window.soundManager?.playSFX('spell_buff');
            break;
        }
        case 'absorb_shield': {
            // Grants a flat damage-absorbing barrier (consumed before HP in
            // colonistTakeDamage) to the caster and nearby allies. Pool scales with
            // school mastery. Duration scales with mastery+gear.
            const pool = Math.round(spell.absorbAmount * getSpellPower(colonist, spell));
            const shieldDur = Math.round(spell.duration * getSpellDurationMult(colonist, spell));
            for (const ally of getBuffTargets(colonist, game, spell.radius)) {
                if (!ally.activeEffects) ally.activeEffects = [];
                ally.activeEffects.push({ type: 'absorb', source: 'spell', absorbRemaining: pool, expiresAt: game.tick + shieldDur });
                game.combatEffects.push({ x: ally.x, y: ally.y, char: COMBAT_VISUALS.spellShieldChar, color: COMBAT_VISUALS.spellShieldColor, ttl: 3 });
            }
            window.soundManager?.playSFX('spell_shield');
            break;
        }
        case 'buff_quality': {
            // Grants a work-quality bonus to the caster and nearby working allies,
            // read by task-executor's applyQuality. Duration scales with mastery.
            const qDur = Math.round(spell.duration * getSpellDurationMult(colonist, spell));
            for (const ally of getBuffTargets(colonist, game, spell.radius)) {
                if (!ally.activeEffects) ally.activeEffects = [];
                ally.activeEffects.push({ type: 'quality', source: 'spell', qualityBonus: spell.qualityBonus || 1, expiresAt: game.tick + qDur });
                game.combatEffects.push({ x: ally.x, y: ally.y, char: COMBAT_VISUALS.spellBuffChar, color: COMBAT_VISUALS.spellBuffColor, ttl: 2 });
            }
            window.soundManager?.playSFX('spell_buff');
            break;
        }
        case 'buff_rest': {
            // Slows rest decay for the caster and nearby allies (read in updateNeeds).
            const rDur = Math.round(spell.duration * getSpellDurationMult(colonist, spell));
            for (const ally of getBuffTargets(colonist, game, spell.radius)) {
                if (!ally.activeEffects) ally.activeEffects = [];
                ally.activeEffects.push({ type: 'rest', source: 'spell', restDecayMult: spell.restDecayMult || 0.5, expiresAt: game.tick + rDur });
                game.combatEffects.push({ x: ally.x, y: ally.y, char: COMBAT_VISUALS.spellBuffChar, color: COMBAT_VISUALS.spellBuffColor, ttl: 2 });
            }
            window.soundManager?.playSFX('spell_buff');
            break;
        }
        case 'stun': {
            // Briefly disables the nearest hostile (and, if chainTargets>1, up to that
            // many nearby foes). The enemy AI skips attacks/movement while stunned.
            const target = findNearestHostile(colonist, game);
            if (!target) return;
            const dist = manhattanDist(colonist.x, colonist.y, target.x, target.y);
            if (dist > spell.range) return;
            applyEnemyStun(target, spell.stunDuration || 45, game);
            const projDur = (dist / COMBAT_VISUALS.projectileSpeed) * 1000;
            game.projectiles.push({
                fromX: colonist.x, fromY: colonist.y, toX: target.x, toY: target.y,
                char: spell.projectileChar || '✦',
                color: spell.projectileColor || '#ffccff',
                skinKey: 'projectile_spell',
                _startTime: performance.now(), _duration: projDur,
            });
            game.combatEffects.push({ x: target.x, y: target.y, char: spell.projectileChar || '✦', color: spell.projectileColor || '#ffccff', ttl: 5 });
            window.soundManager?.playSFX('spell_cast');
            break;
        }
        case 'summon_swarm': {
            // Conjures a pack of short-lived skirmishers on tiles around the caster.
            const summonDef = SUMMON_TYPES[spell.summonType];
            if (!summonDef) break;
            const count = spell.swarmCount || 3;
            const ring = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
            for (let i = 0; i < count; i++) {
                const [ox, oy] = ring[i % ring.length];
                spawnSummon(spell.summonType, colonist.x + ox, colonist.y + oy, colonist.id, game);
            }
            window.soundManager?.playSFX('spell_cast');
            break;
        }
        case 'transmute': {
            // Converts a batch of stockpiled material into another. `fromResource`/
            // `inputAmount` is consumed (omitted → conjured from nothing) and
            // `outputAmount` of `toResource` is produced. The canTransmute trigger has
            // already verified affordability, but re-check so a manual/edge cast is safe.
            const from = spell.fromResource;
            const inAmt = spell.inputAmount || 0;
            const to = spell.toResource;
            const outAmt = spell.outputAmount || 1;
            if (from && (game.resources.stockpile[from] || 0) < inAmt) {
                game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: `No ${from.replace(/_/g, ' ')}`, color: '#aa8844', fontSize: 10, ttl: 10, maxTtl: 10 });
                break;
            }
            if (from) game.resources.stockpile[from] -= inAmt;
            game.resources.stockpile[to] = (game.resources.stockpile[to] || 0) + outAmt;
            game.combatEffects.push({ x: colonist.x, y: colonist.y, char: COMBAT_VISUALS.spellGrowthChar, color: '#ffdd44', ttl: 4 });
            const fromStr = from ? `${inAmt} ${from.replace(/_/g, ' ')} → ` : '';
            game.notifications.push({ text: `${colonist.name} transmuted ${fromStr}${outAmt} ${to.replace(/_/g, ' ')}`, tick: game.tick, type: 'success' });
            break;
        }
    }
}

// Number of harmful active effects on a colonist (DoTs, slows, flagged-harmful).
// Used by Cleanse to pick the most-afflicted ally.
function countHarmful(c) {
    if (!c.activeEffects) return 0;
    return c.activeEffects.reduce((n, e) => n + ((e.type === 'dot' || e.type === 'slow' || e.harmful) ? 1 : 0), 0);
}

function updateIdle(colonist, game) {
    if (colonist.expeditionPending) return;

    if (colonist.drafted) {
        colonist.state = 'drafted';
        return;
    }

    if (isBreaking(colonist)) {
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
        const wpnRange = getRangedWeaponRange(colonist, game);
        const autoEngageDist = Math.max(COLONIST_CONFIG.fightEngageDistance, wpnRange);
        if (waveActive || dist <= autoEngageDist) {
            colonist.state = 'fighting';
            return;
        }
        // Engage if a nearby friend is actively fighting. Go help even if the
        // threat itself is beyond normal auto-engage range.
        const friendFighting = game.colonists.some(c =>
            c.id !== colonist.id && c.hp > 0 && c.state === 'fighting' &&
            manhattanDist(colonist.x, colonist.y, c.x, c.y) <= COLONIST_CONFIG.fightEngageDistance
        );
        if (friendFighting) {
            colonist.state = 'fighting';
            return;
        }
    }

    // Start seeking food BEFORE the colonist encounters a mood debuff.
    if (colonist.needs.hunger < COLONIST_CONFIG.hungerMoodThreshold + 10 &&
        (game.resources.stockpile.food > 0 || game.resources.getFoodstuffTotal() > 0)) {
        colonist.state = 'eating';
        return;
    }

    if (colonist.needs.rest < COLONIST_CONFIG.restMoodThreshold) {
        startSleeping(colonist, game);
        return;
    }

    // Seek warmth when freezing and idle. Walk toward the nearest warmth source
    // within range. Interrupted immediately if work or a threat appears (guard/
    // task checks come right after).
    if (colonist.thoughts.some(t => t.text === 'Freezing outside') &&
        !game.power.isTileWarmed(game, colonist.x, colonist.y)) {
        let bestTarget = null;
        let bestDist = WARMTH_SEEK_RADIUS + 1;
        for (const type of WARMTH_SEEK_TYPES) {
            const pos = game.mapIndex.findNearest(type, colonist.x, colonist.y);
            if (pos) {
                const d = manhattanDist(colonist.x, colonist.y, pos.x, pos.y);
                if (d < bestDist) { bestDist = d; bestTarget = pos; }
            }
        }
        if (bestTarget && bestDist <= WARMTH_SEEK_RADIUS) {
            const path = findPathAdjacent(game.map, colonist.x, colonist.y, bestTarget.x, bestTarget.y, game._occupiedTiles);
            if (path && path.length > 0) {
                colonist.path = path;
                colonist.state = 'moving';
                colonist._seekingWarmth = true;
                return;
            }
        }
    }
    colonist._seekingWarmth = false;

    if (colonist.guardMode && colonist.guardPost) {
        updateGuarding(colonist, game);
        return;
    }

    const task = game.taskQueue.findBestTask(colonist, game.tick);
    if (task) {
        game.taskQueue.claim(task.id, colonist.id);
        colonist.currentTaskId = task.id;
        const path = findPathAdjacent(game.map, colonist.x, colonist.y, task.x, task.y, game._occupiedTiles);
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

    // --- Relaxation ---
    // Only reached when there is no pending work task, so a relaxing colonist
    // stays fully work-available: it re-runs this whole priority chain (including
    // findBestTask above) every tick, and only continues relaxing when no work
    // was found. Pre-emption by work/threats/needs is therefore automatic.
    if (colonist._relaxActivity) {
        updateRelaxTick(colonist, game);
        return;
    }
    // Note: _relaxCooldown is undefined until a colonist has relaxed at least
    // once. Coalesce to 0 so a fresh colonist is immediately eligible. Comparing
    // undefined against a number is always false, which would gate relaxation off
    // forever otherwise.
    if (colonist._relaxCooldown > 0) {
        colonist._relaxCooldown--;
    } else if (Math.random() < COLONIST_CONFIG.relaxChance) {
        if (tryStartRelaxing(colonist, game)) return;
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
                const path = findPathAdjacent(game.map, colonist.x, colonist.y, target.c.x, target.c.y, game._occupiedTiles);
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
    // Gather every passable, unoccupied neighbor, then prefer open ground over
    // furniture. A wandering colonist only steps onto a furniture tile when no
    // clear tile is available. This mirrors the pathfinding furniture penalty so
    // idle movement doesn't shuffle through beds, workbenches, etc.
    const open = [];
    const furniture = [];
    for (const [dx, dy] of dirs) {
        const nx = colonist.x + dx;
        const ny = colonist.y + dy;
        if (!isPassable(game.map, nx, ny) || game.isTileOccupied(nx, ny)) continue;
        (isWalkableFurniture(game.map, nx, ny) ? furniture : open).push([nx, ny]);
    }
    const choices = open.length > 0 ? open : furniture;
    if (choices.length === 0) return;
    const [nx, ny] = choices[Math.floor(Math.random() * choices.length)];
    moveEntity(colonist, nx, ny, CONFIG.TICK_RATE / game.speed);
}

// Relaxation activity metadata: the mood thought awarded on completion and the
// floating-text glyph/color shown while relaxing. 'hang_out' uses the Town Hall's
// quality tier for its thought when available (see finishRelaxing).
const RELAX_ACTIVITIES = {
    hang_out:       { label: 'Hanging out',       thought: 'hung_out',        glyph: '♪', color: '#ffdd66' },
    warm_by_fire:   { label: 'Warming by the fire', thought: 'warmed_by_fire', glyph: '≈', color: '#ff8844' },
    people_watch:   { label: 'People watching',   thought: 'people_watched',  glyph: '☺', color: '#88ccff' },
    stargaze:       { label: 'Stargazing',        thought: 'stargazed',       glyph: '✦', color: '#aaccff' },
    cloud_watch:    { label: 'Cloud watching',    thought: 'cloud_watched',   glyph: '☁', color: '#cccccc' },
    skip_stones:    { label: 'Skipping stones',   thought: 'skipped_stones',  glyph: '○', color: '#88bbcc' },
    smell_flowers:  { label: 'Smelling the flowers', thought: 'smelled_flowers', glyph: '❀', color: '#ff99cc' },
    stroll:         { label: 'Strolling',         thought: 'strolled',        glyph: '♫', color: '#aaddaa' },
};

// Friendly label for a colonist's current relaxation activity, or null if not
// relaxing. Used by the info panel to show the activity as the current "task".
export function getRelaxActivityLabel(colonist) {
    if (!colonist._relaxActivity) return null;
    const info = RELAX_ACTIVITIES[colonist._relaxActivity];
    return info ? info.label : 'Relaxing';
}

const WARMTH_SOURCES = ['campfire', 'hearth_shrine', 'ember_heater', 'inferno_ward'];
const WARMTH_SEEK_TYPES = ['campfire', 'ember_heater', 'inferno_ward', 'hearth_shrine'];
const WARMTH_SEEK_RADIUS = 20;

function randRange(range) {
    return range[0] + Math.floor(Math.random() * (range[1] - range[0]));
}

// True if any tile within `radius` (manhattan) of the colonist matches `pred`.
function nearTile(colonist, game, radius, pred) {
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (Math.abs(dx) + Math.abs(dy) > radius) continue;
            const nx = colonist.x + dx, ny = colonist.y + dy;
            const row = game.map[ny];
            if (!row || !row[nx]) continue;
            if (pred(row[nx])) return true;
        }
    }
    return false;
}

// Randomly begin a relaxation activity. Returns true if one was started this tick.
// The chosen activity is weighted. Only activities whose context gate passes are
// eligible. Hang Out (a reachable Town Hall) is the heaviest weight so it dominates
// whenever a Town Hall exists.
function tryStartRelaxing(colonist, game) {
    const t = game.timeOfDay / CONFIG.TICKS_PER_DAY;
    const isNight = t > DAY_NIGHT.nightStart || t < DAY_NIGHT.dayStart;
    const indoors = isIndoors(colonist, game.map);

    const candidates = [];

    // Hang Out: nearest Town Hall banner within range and reachable.
    let hangOutTarget = null;
    const banner = game.mapIndex.findNearest('town_hall_banner', colonist.x, colonist.y);
    if (banner && manhattanDist(colonist.x, colonist.y, banner.x, banner.y) <= COLONIST_CONFIG.hangOutSearchRadius) {
        hangOutTarget = banner;
        candidates.push({ key: 'hang_out', weight: 40 });
    }

    if (nearTile(colonist, game, 5, tile => WARMTH_SOURCES.includes(tile.structure))) {
        candidates.push({ key: 'warm_by_fire', weight: 15 });
    }
    const socialRange = SOCIAL_CONFIG.interactionRange;
    const otherNear = game.colonists.some(c =>
        c.id !== colonist.id && c.hp > 0 && !c.onExpedition &&
        manhattanDist(colonist.x, colonist.y, c.x, c.y) <= socialRange
    );
    if (otherNear) candidates.push({ key: 'people_watch', weight: 12 });

    if (!indoors && isNight) candidates.push({ key: 'stargaze', weight: 12 });
    if (!indoors && !isNight) candidates.push({ key: 'cloud_watch', weight: 12 });

    if (nearTile(colonist, game, 2, tile => tile.terrain === 'water')) {
        candidates.push({ key: 'skip_stones', weight: 10 });
    }
    if (nearTile(colonist, game, 2, tile => tile.zone)) {
        candidates.push({ key: 'smell_flowers', weight: 10 });
    }

    // Stroll is always eligible as a fallback.
    candidates.push({ key: 'stroll', weight: 8 });

    // Weighted random pick.
    let total = 0;
    for (const c of candidates) total += c.weight;
    let roll = Math.random() * total;
    let chosen = candidates[candidates.length - 1].key;
    for (const c of candidates) {
        roll -= c.weight;
        if (roll < 0) { chosen = c.key; break; }
    }

    // Hang Out walks to the Town Hall first. Everything else relaxes in place.
    if (chosen === 'hang_out' && hangOutTarget) {
        const path = findPathAdjacent(game.map, colonist.x, colonist.y, hangOutTarget.x, hangOutTarget.y, game._occupiedTiles);
        if (path && path.length > 0) {
            colonist.path = path;
            colonist.state = 'moving';
            colonist._relaxAfterMove = true;
        } else {
            // Town Hall is unreachable. Fall back to a stroll rather than
            // hanging out in place with no hall to gather in.
            chosen = 'stroll';
        }
    }

    colonist._relaxActivity = chosen;
    colonist._relaxTimer = randRange(COLONIST_CONFIG.relaxDuration);
    colonist._relaxCooldown = randRange(COLONIST_CONFIG.relaxCooldown);
    return true;
}

function updateRelaxTick(colonist, game) {
    colonist._relaxTimer--;
    const info = RELAX_ACTIVITIES[colonist._relaxActivity];
    if (info && game.tick % 12 === 0) {
        game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: info.glyph, color: info.color, fontSize: 10, ttl: 11, maxTtl: 11 });
    }
    // Strolling colonists amble about. Other activities stand in place.
    if (colonist._relaxActivity === 'stroll' && Math.random() < COLONIST_CONFIG.wanderChance) {
        wander(colonist, game);
    }
    if (colonist._relaxTimer <= 0) {
        finishRelaxing(colonist, game);
    }
}

function finishRelaxing(colonist, game) {
    const activity = colonist._relaxActivity;
    const info = RELAX_ACTIVITIES[activity];
    const roomId = game.map[colonist.y] && game.map[colonist.y][colonist.x]
        ? game.map[colonist.y][colonist.x].roomId : null;
    if (activity === 'hang_out' && roomId !== null && game.townHallQualities[roomId]) {
        const q = game.townHallQualities[roomId];
        addThought(colonist, q.tierName, q.moodEffect, q.duration, game.tick);
    } else if (info) {
        const th = THOUGHTS[info.thought];
        addThought(colonist, th.text, th.moodEffect, th.duration, game.tick);
    }
    delete colonist._relaxActivity;
    delete colonist._relaxTimer;
    delete colonist._relaxAfterMove;
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
        // Same open-ground-over-furniture preference as wander(), constrained to
        // tiles within the patrol radius so guards don't loiter on the furniture.
        const open = [];
        const furniture = [];
        for (const [dx, dy] of dirs) {
            const nx = colonist.x + dx;
            const ny = colonist.y + dy;
            if (!isPassable(game.map, nx, ny) || game.isTileOccupied(nx, ny)) continue;
            if (manhattanDist(nx, ny, post.x, post.y) > WORK_CONFIG.guardPatrolRadius) continue;
            (isWalkableFurniture(game.map, nx, ny) ? furniture : open).push([nx, ny]);
        }
        const choices = open.length > 0 ? open : furniture;
        if (choices.length > 0) {
            const [nx, ny] = choices[Math.floor(Math.random() * choices.length)];
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

// Interrupt an in-progress task to engage a threat, then return true if combat was joined.
// During an active wave any detected hostile triggers engagement regardless of distance
// (unchanged legacy behavior). During a raid (or when hostile wildlife is about) the threat
// must be within the colonist's auto-engage range, mirroring updateIdle so busy colonists
// react to approaching raiders the same way idle ones do. The task is released back to the
// queue rather than discarded, so an idle colonist (often this same one once the fight
// ends) can reclaim it via findBestTask. (release() resets workDone, so partial progress is
// lost, consistent with the wave path.)
function tryCombatInterrupt(colonist, game) {
    const waveActive = game.waves && game.waves.active && game.waves.enemies.length > 0;
    const raidersPresent = game.raiders && game.raiders.length > 0;
    if (!waveActive && !raidersPresent) return false;
    if (!colonist.currentTaskId) return false;

    const threat = findNearestHostile(colonist, game);
    if (!threat) return false;

    if (!waveActive) {
        if (colonist.traits.includes('pacifist')) return false;
        const dist = manhattanDist(colonist.x, colonist.y, threat.x, threat.y);
        const wpnRange = getRangedWeaponRange(colonist, game);
        const autoEngageDist = Math.max(COLONIST_CONFIG.fightEngageDistance, wpnRange);
        if (dist > autoEngageDist) {
            // Still interrupt if a nearby friend is already fighting.
            const friendFighting = game.colonists.some(c =>
                c.id !== colonist.id && c.hp > 0 && c.state === 'fighting' &&
                manhattanDist(colonist.x, colonist.y, c.x, c.y) <= COLONIST_CONFIG.fightEngageDistance
            );
            if (!friendFighting) return false;
        }
    }

    game.taskQueue.release(colonist.currentTaskId);
    colonist.currentTaskId = null;
    colonist.path = [];
    colonist.state = 'fighting';
    return true;
}

function updateMoving(colonist, game) {
    if (tryCombatInterrupt(colonist, game)) return;

    // If moving toward a hunt target and already within weapon range, start
    // hunting immediately instead of walking all the way to the adjacent tile.
    if (colonist.currentTaskId) {
        const huntTask = game.taskQueue.getById(colonist.currentTaskId);
        if (huntTask && huntTask.type === 'hunt' && huntTask.targetAnimalId) {
            const animal = game.entities.find(a => a.id === huntTask.targetAnimalId && a.category === 'animal');
            if (animal && animal.hp > 0) {
                const weapon = colonist.weapon;
                const attackRange = (weapon && weapon.ranged) ? getRangedWeaponRange(colonist, game) : 1;
                if (manhattanDist(colonist.x, colonist.y, animal.x, animal.y) <= attackRange) {
                    colonist.huntTargetId = huntTask.targetAnimalId;
                    colonist.currentTaskId = null;
                    colonist.path = [];
                    game.taskQueue.complete(huntTask.id);
                    colonist.state = 'hunting';
                    return;
                }
            }
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
        if (colonist._relaxAfterMove) {
            delete colonist._relaxAfterMove;
            // Back to idle so next tick re-checks for work first, then resumes
            // relaxing in place via the _relaxActivity branch in updateIdle.
            colonist.state = 'idle';
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
            const newPath = findPathAdjacent(game.map, colonist.x, colonist.y, task.x, task.y, game._occupiedTiles);
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
    if (tryCombatInterrupt(colonist, game)) return;

    const task = game.taskQueue.getById(colonist.currentTaskId);
    if (!task) {
        colonist.state = 'idle';
        colonist.currentTaskId = null;
        return;
    }

    if (isBreaking(colonist)) {
        game.taskQueue.release(colonist.currentTaskId);
        colonist.currentTaskId = null;
        colonist.state = 'idle';
        return;
    }

    let speed = getWorkSpeed(colonist, game);
    const skill = colonist.skills[task.skillRequired] || 1;
    speed *= (1 + skill * COLONIST_CONFIG.skillWorkBonus);

    if (task.type === 'mine' && game.research.isResearched('stonework')) {
        speed *= WORK_CONFIG.stoneworkMiningMult;
    }
    if (task.skillRequired === 'farming' && colonist.traits.includes('green_thumb')) {
        speed *= TRAITS.green_thumb.farmingSpeedMult;
    }
    if (task.skillRequired === 'farming') speed *= getRaceModifier(colonist, 'farmingSpeedMult', 1);
    if (task.skillRequired === 'animals') speed *= getRaceModifier(colonist, 'animalWorkMult', 1);
    if (task.skillRequired === 'animals' && colonist.traits.includes('beast_whisperer')) speed *= TRAITS.beast_whisperer.animalWorkMult;
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

    if (task.type === 'craft' || task.type === 'cook') {
        speed *= getCraftSpeedBonus(game);
    }

    if (colonist.activeEffects) {
        for (const e of colonist.activeEffects) {
            if (e.type === 'speed' && e.workSpeedBonus) speed *= (1 + e.workSpeedBonus);
        }
    }

    task.workDone += speed;
    colonist.workProgress = task.workDone / task.workAmount;

    if (task.workDone >= task.workAmount) {
        completeTask(colonist, task, game);
    }
}


function updateEating(colonist, game) {
    // On first tick: consume food immediately, then count down visible eating duration
    if (!colonist._eatTicksLeft) {
        if (game.resources.stockpile.food > 0) {
            game.resources.stockpile.food--;
            colonist.needs.hunger = COLONIST_CONFIG.cookedFoodRestore;
            let mealMood = colonist.traits.includes('gourmand')
                ? TRAITS.gourmand.cookedFoodMoodBonus
                : COLONIST_CONFIG.mealMoodBonus;
            if (colonist.traits.includes('comfort_eater')) mealMood += TRAITS.comfort_eater.mealMoodBonus;
            let mealDuration = COLONIST_CONFIG.mealMoodDuration;
            if (colonist.traits.includes('chef')) mealDuration = Math.round(mealDuration * TRAITS.chef.mealMoodDurationMult);
            addThought(colonist, colonist.traits.includes('gourmand') ? 'Delicious meal' : 'Ate a meal', mealMood, mealDuration, game.tick);
            colonist._eatTicksLeft = 30;  // ~½s at 60fps to show the animation
        } else {
            const eaten = eatRawFoodstuff(game);
            if (eaten) {
                colonist.needs.hunger = Math.min(100, colonist.needs.hunger + COLONIST_CONFIG.rawFoodRestore);
                if (colonist.traits.includes('foraging_gut')) {
                    addThought(colonist, 'Ate raw food', TRAITS.foraging_gut.rawFoodMoodPenalty, COLONIST_CONFIG.rawFoodMoodDuration, game.tick);
                } else if (colonist.traits.includes('gourmand')) {
                    addThought(colonist, 'Ate raw food', TRAITS.gourmand.rawFoodMoodPenalty, COLONIST_CONFIG.rawFoodMoodDuration, game.tick);
                } else {
                    const rawPenalty = getRaceModifier(colonist, 'rawFoodMoodPenalty', COLONIST_CONFIG.rawFoodMoodPenalty);
                    addThought(colonist, 'Ate raw food', rawPenalty, COLONIST_CONFIG.rawFoodMoodDuration, game.tick);
                }
                colonist._eatTicksLeft = 45;
            } else {
                colonist.state = 'idle';
                addThought(colonist, 'Starving', COLONIST_CONFIG.starvingMoodPenalty, COLONIST_CONFIG.starvingMoodDuration, game.tick);
            }
        }
        return;
    }
    // Count down the visible eating duration
    colonist._eatTicksLeft--;
    if (colonist._eatTicksLeft <= 0) {
        colonist._eatTicksLeft = 0;
        colonist.state = 'idle';
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
        const path = findPath(game.map, colonist.x, colonist.y, colonist.assignedBed.x, colonist.assignedBed.y, game._occupiedTiles);
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
    if (colonist.traits.includes('insomniac')) sleepRestMult *= TRAITS.insomniac.sleepRestMult;
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

// Steps one tile along a cached A* path toward `dest` (an {x,y} tile) while a
// colonist is in the fighting state. Routing (rather than the old greedy single-
// axis stepping) lets a colonist leave a building through any door to reach a
// raider, instead of only when a door happens to lie straight toward the threat.
// `adjacent` true → path to a tile beside dest (melee: stand next to the target);
// false → path onto dest itself (ranged: a specific line-of-sight tile). The path
// is cached on the colonist and recomputed only when the target shifts, the path
// runs out, or the colonist is no longer standing on it. A* isn't re-run every
// tick for every fighter during a wave.
function fightStepToward(colonist, dest, adjacent, game) {
    const targetMoved = !colonist._fightDest
        || manhattanDist(dest.x, dest.y, colonist._fightDest.x, colonist._fightDest.y) > 1;
    const path = colonist._fightPath;
    const offPath = !path || path.length === 0
        || (Math.abs(path[0].x - colonist.x) + Math.abs(path[0].y - colonist.y)) !== 1;
    if (targetMoved || offPath) {
        const fresh = adjacent
            ? findPathAdjacent(game.map, colonist.x, colonist.y, dest.x, dest.y, game._occupiedTiles)
            : findPath(game.map, colonist.x, colonist.y, dest.x, dest.y, game._occupiedTiles);
        colonist._fightPath = fresh || [];
        colonist._fightDest = { x: dest.x, y: dest.y };
    }
    if (colonist._fightPath.length === 0) return;
    const next = colonist._fightPath[0];
    if (!isPassable(game.map, next.x, next.y)) { colonist._fightPath = []; return; }
    if (game.isTileOccupied(next.x, next.y)) return; // blocked by another entity, wait a tick
    colonist._fightPath.shift();
    const dur = CONFIG.TICK_RATE / game.speed;
    moveEntity(colonist, next.x, next.y, dur);
}

function updateFighting(colonist, game) {
    const target = findNearestHostile(colonist, game);
    if (!target) {
        colonist.state = 'idle';
        return;
    }

    const dist = manhattanDist(colonist.x, colonist.y, target.x, target.y);
    const waveActive = game.waves && game.waves.active && game.waves.enemies.length > 0;
    const weaponReach = getRangedWeaponRange(colonist, game);
    const engageDist = Math.max(COLONIST_CONFIG.fightEngageDistance, weaponReach);
    if (dist > engageDist && !waveActive) {
        const friendFighting = game.colonists.some(c =>
            c.id !== colonist.id && c.hp > 0 && c.state === 'fighting' &&
            manhattanDist(colonist.x, colonist.y, c.x, c.y) <= COLONIST_CONFIG.fightEngageDistance
        );
        if (!friendFighting) {
            colonist.state = 'idle';
            return;
        }
    }

    let fleeThreshold = COLONIST_CONFIG.fleeHpThreshold;
    if (colonist.traits.includes('brave')) fleeThreshold = colonist.maxHp * TRAITS.brave.fleeHpMult;
    else if (colonist.traits.includes('coward')) fleeThreshold = colonist.maxHp * TRAITS.coward.fleeHpMult;
    if (colonist.hp < fleeThreshold || colonist.traits.includes('pacifist')) {
        colonist.state = 'fleeing';
        return;
    }

    const weapon = colonist.weapon;
    const isRanged = weapon && weapon.ranged;
    const weaponRange = isRanged ? getRangedWeaponRange(colonist, game) : 1;

    const baseCooldown = (weapon && weapon.attackCooldown) || COLONIST_CONFIG.baseAttackCooldown;
    let atkSpeed = 1 + getEquipmentStat(colonist, 'attackSpeed');
    if (colonist.activeEffects) {
        for (const e of colonist.activeEffects) {
            if (e.type === 'attackSpeed' && e.attackSpeed) atkSpeed += e.attackSpeed;
        }
    }
    const effectiveCooldown = Math.max(1, Math.round(baseCooldown / atkSpeed));

    if (isRanged && dist <= weaponRange && dist >= 2 && hasLineOfSight(game.map, colonist.x, colonist.y, target.x, target.y)) {
        if (game.tick - (colonist._lastAttackTick || 0) < effectiveCooldown) return;
        colonist._lastAttackTick = game.tick;
        // Render latch for the attack animation (entity-animation.js). Motion class
        // comes from the weapon's `attackAnim`; a ranged weapon defaults to DrawAndShoot.
        colonist._lastAttackKind = (weapon && weapon.attackAnim) || 'DrawAndShoot';
        colonist._lastAttackDir = { dx: Math.sign(target.x - colonist.x), dy: Math.sign(target.y - colonist.y) };
        let weaponDmg = weapon.damage;
        for (const item of getEquippedItems(colonist)) {
            if (item !== weapon && item.damage) weaponDmg += item.damage;
        }
        let dmg = weaponDmg + Math.floor(Math.random() * COLONIST_CONFIG.combatDamageVariance);
        if (colonist.pedestalDamageBonus > 1) dmg = Math.floor(dmg * colonist.pedestalDamageBonus);
        dmg = Math.floor(dmg * getTraitDamageMult(colonist));
        const critChance = getCritChance(colonist);
        if (critChance > 0 && Math.random() < critChance) {
            dmg *= 2;
            game.combatEffects.push({ x: target.x, y: target.y, char: COMBAT_VISUALS.hitChar, color: COMBAT_VISUALS.hitColor, ttl: COMBAT_VISUALS.hitTtl });
            window.soundManager?.playSFX('critical_hit');
        }
        target.hp -= dmg;
        if (getEquipmentStat(colonist, 'lifeSteal')) colonist.hp = Math.min(colonist.maxHp, colonist.hp + Math.round(dmg * getEquipmentStat(colonist, 'lifeSteal')));
        target._dmgFlashUntil = game.tick + COMBAT_VISUALS.dmgFlashTtl;
        colonist._atkShakeUntil = game.tick + COMBAT_VISUALS.atkShakeTtl;
        const sfxName = (weapon.skinKey === 'projectile_bolt') ? 'bolt_fire' : 'arrow_fire';
        window.soundManager?.playSFX(sfxName);
        const projDuration = (dist / COMBAT_VISUALS.projectileSpeed) * 1000;
        game.projectiles.push({
            fromX: colonist.x, fromY: colonist.y, toX: target.x, toY: target.y,
            char: weapon.projectileChar || '-',
            color: weapon.projectileColor || '#ffaa33',
            skinKey: weapon.skinKey || 'projectile_arrow',
            _startTime: performance.now(), _duration: projDuration,
        });
    } else if (isRanged && dist <= weaponRange && dist >= 2) {
        // In range but the shot is blocked (the fire branch above requires LOS):
        // route toward the nearest tile that can see the target instead of standing
        // still and falling through to a melee swing. If no shootable tile exists
        // within range, close on the target (path adjacent) to round the obstruction.
        const losTile = findLineOfSightTile(game.map, colonist.x, colonist.y, target.x, target.y, weaponRange, isPassable);
        if (losTile) {
            fightStepToward(colonist, losTile, false, game);
        } else {
            fightStepToward(colonist, target, true, game);
        }
        return;
    } else if (dist > 1 && (!isRanged || dist > weaponRange)) {
        // Route to a tile adjacent to the target so the colonist walks out through
        // any door and around walls, rather than greedily stepping into a wall when
        // the raider approaches from a side the door doesn't face.
        fightStepToward(colonist, target, true, game);
        return;
    } else {
        if (game.tick - (colonist._lastAttackTick || 0) < effectiveCooldown) return;
        colonist._lastAttackTick = game.tick;
        // Render latch for the attack animation (entity-animation.js). Motion class
        // comes from the weapon's `attackAnim`; unarmed/melee defaults to Swing.
        colonist._lastAttackKind = (weapon && weapon.attackAnim) || 'Swing';
        colonist._lastAttackDir = { dx: Math.sign(target.x - colonist.x), dy: Math.sign(target.y - colonist.y) };
        let weaponDmg = weapon ? weapon.damage : WEAPONS.fists.damage;
        for (const item of getEquippedItems(colonist)) {
            if (item !== weapon && item.damage) weaponDmg += item.damage;
        }
        let dmg = weaponDmg + Math.floor(Math.random() * COLONIST_CONFIG.combatDamageVariance);
        if (colonist.pedestalDamageBonus > 1) dmg = Math.floor(dmg * colonist.pedestalDamageBonus);
        dmg = Math.floor(dmg * getTraitDamageMult(colonist));
        const critChance = getCritChance(colonist);
        if (critChance > 0 && Math.random() < critChance) {
            dmg *= 2;
            game.combatEffects.push({ x: target.x, y: target.y, char: COMBAT_VISUALS.hitChar, color: COMBAT_VISUALS.hitColor, ttl: COMBAT_VISUALS.hitTtl });
            window.soundManager?.playSFX('critical_hit');
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
    const attackRange = isRanged ? getRangedWeaponRange(colonist, game) : 1;

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
            if (e.type === 'attackSpeed' && e.attackSpeed) atkSpeed += e.attackSpeed;
        }
    }
    const effectiveCooldown = Math.max(1, Math.round(baseCooldown / atkSpeed));

    if (game.tick - (colonist._lastAttackTick || 0) < effectiveCooldown) return;
    colonist._lastAttackTick = game.tick;
    // Render latch for the attack animation (entity-animation.js). Use the weapon's
    // `attackAnim` when firing from range. A ranged weapon used point-blank swings.
    colonist._lastAttackKind = (isRanged && dist >= 2)
        ? ((weapon && weapon.attackAnim) || 'DrawAndShoot')
        : ((weapon && !weapon.ranged && weapon.attackAnim) || 'Swing');
    colonist._lastAttackDir = { dx: Math.sign(animal.x - colonist.x), dy: Math.sign(animal.y - colonist.y) };

    let huntDmg = weapon ? weapon.damage : WEAPONS.fists.damage;
    for (const item of getEquippedItems(colonist)) {
        if (item !== weapon && item.damage) huntDmg += item.damage;
    }
    huntDmg += Math.floor(Math.random() * COLONIST_CONFIG.combatDamageVariance);
    if (colonist.pedestalDamageBonus > 1) huntDmg = Math.floor(huntDmg * colonist.pedestalDamageBonus);
    huntDmg = Math.floor(huntDmg * getTraitDamageMult(colonist));
    const critChance = getCritChance(colonist);
    if (critChance > 0 && Math.random() < critChance) {
        huntDmg *= 2;
        game.combatEffects.push({ x: animal.x, y: animal.y, char: COMBAT_VISUALS.hitChar, color: COMBAT_VISUALS.hitColor, ttl: COMBAT_VISUALS.hitTtl });
        window.soundManager?.playSFX('critical_hit');
    }

    animal.hp -= huntDmg;
    animal._dmgFlashUntil = game.tick + COMBAT_VISUALS.dmgFlashTtl;
    colonist._atkShakeUntil = game.tick + COMBAT_VISUALS.atkShakeTtl;

    if (isRanged && dist >= 2) {
        const huntSfxName = (weapon && weapon.skinKey === 'projectile_bolt') ? 'bolt_fire' : 'arrow_fire';
        window.soundManager?.playSFX(huntSfxName);
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
        const wpnRange = getRangedWeaponRange(colonist, game);
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
            const path = findPath(game.map, colonist.x, colonist.y, colonist.draftTarget.x, colonist.draftTarget.y, game._occupiedTiles);
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
    let dodgeChance = getEquipmentStat(colonist, 'dodgeChance');
    if (colonist.traits.includes('duelist')) dodgeChance += TRAITS.duelist.dodgeChance;
    if (dodgeChance > 0 && Math.random() < dodgeChance) {
        game.combatEffects.push({ x: colonist.x, y: colonist.y, char: '~', color: '#88ccff', ttl: 4 });
        game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: 'Block!', color: '#4488ff', fontSize: 11, ttl: 12, maxTtl: 12 });
        window.soundManager?.playSFX('shield_block');
        return;
    }
    let mult = 1;
    if (colonist.traits.includes('tough')) mult *= (1 - TRAITS.tough.damageReduction);
    if (colonist.traits.includes('sturdy')) mult *= (1 - TRAITS.sturdy.damageReduction);
    if (colonist.traits.includes('berserker')) mult *= (1 - TRAITS.berserker.damageReduction);
    const perAlly = getRaceModifier(colonist, 'allyDamageReduction', 0);
    if (perAlly > 0) {
        const cap = getRaceModifier(colonist, 'allyDamageReductionCap', 0.2);
        const inRange = c => c.hp > 0 &&
            manhattanDist(colonist.x, colonist.y, c.x, c.y) <= COLONIST_CONFIG.socialRange;
        // Allies = other colonists (incl. golems, which live in game.colonists) plus
        // friendly entities: tamed animals and summons.
        let nearAllies = game.colonists.reduce((n, c) =>
            (c.id !== colonist.id && inRange(c)) ? n + 1 : n, 0);
        nearAllies += game.entities.reduce((n, e) =>
            ((e.category === 'summon' || (e.category === 'animal' && e.tamed)) && inRange(e)) ? n + 1 : n, 0);
        mult *= (1 - Math.min(cap, perAlly * nearAllies));
    }
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
    let actualDmg = Math.floor(damage * mult);
    // Guardian Ward: flat absorb barriers soak damage before HP, oldest first,
    // and expire when drained. Distinct from % 'shield' reduction applied above.
    if (colonist.activeEffects && actualDmg > 0) {
        let absorbed = false;
        for (const e of colonist.activeEffects) {
            if (actualDmg <= 0) break;
            if (e.type === 'absorb' && e.absorbRemaining > 0) {
                const soak = Math.min(e.absorbRemaining, actualDmg);
                e.absorbRemaining -= soak;
                actualDmg -= soak;
                absorbed = true;
            }
        }
        if (absorbed) {
            colonist.activeEffects = colonist.activeEffects.filter(e => e.type !== 'absorb' || e.absorbRemaining > 0);
            game.combatEffects.push({ x: colonist.x, y: colonist.y, char: COMBAT_VISUALS.shieldBlockChar, color: COMBAT_VISUALS.shieldBlockColor, ttl: COMBAT_VISUALS.shieldBlockTtl });
        }
    }
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
        let revived = false;
        const reviveSlots = ['weapon', 'armor', 'helmet', 'clothes', 'boots', 'tool', 'trinket'];
        for (const slot of reviveSlots) {
            const item = colonist[slot];
            if (!item?.autoReviveHp) continue;
            if (slot === 'trinket' && colonist.trinketBroken) continue;
            colonist.hp = Math.floor(colonist.maxHp * item.autoReviveHp);
            if (slot === 'trinket') {
                colonist.trinketBroken = true;
            } else {
                colonist[slot] = null;
            }
            invalidateEquipStatCache(colonist);
            game.eventLog.add(game, `${colonist.name}'s ${item.name} shatters, reviving them!`, 'success', { type: 'colonist', id: colonist.id });
            game.combatEffects.push({ x: colonist.x, y: colonist.y, char: '✦', color: '#ffdd44', ttl: 8 });
            revived = true;
            break;
        }
        if (!revived) {
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
