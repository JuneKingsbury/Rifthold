import { COLONIST_CONFIG, THOUGHTS, BUILDINGS, RESOURCES, IMPASSABLE_STRUCTURES, WORK_CONFIG, QUALITY_TIERS, TAMED_ANIMALS, MAGIC_STUDY_CONFIG, SPELL_TOMES, SPELLS, MAGIC_SKILLS, COMBAT_VISUALS, RESEARCH, ALL_ITEMS, TRAITS, POTIONS, WEAPON_ENCHANTMENT_EFFECTS, ARMOR_ENCHANTMENT_EFFECTS, HELMET_ENCHANTMENT_EFFECTS, TOOL_ENCHANTMENT_EFFECTS } from '../core/config.js';
import { completeTame, attemptDangerousTame } from './taming.js';
import { getPedestalEffect } from '../systems/artifacts.js';
import { getEquippedItems, getEquipmentStat, addThought, recalcMaxMana } from './colonist.js';
import { getHarvestYield } from '../systems/farming.js';
import { manhattanDist } from '../world/pathfinding.js';

function applyQuality(item, colonist, game, ...statKeys) {
    let skill = colonist.skills.crafting || 1;
    if (game && game.workshopQualities) {
        const roomId = game.map[colonist.y]?.[colonist.x]?.roomId;
        if (roomId !== null && roomId !== undefined && game.workshopQualities[roomId]) {
            skill += game.workshopQualities[roomId].qualityBonus;
        }
    }
    if (colonist.traits.includes('creative')) skill += TRAITS.creative.qualityBonus;
    if (colonist.traits.includes('lucky')) skill += TRAITS.lucky.qualityBonus;
    const chances = QUALITY_TIERS.map(t => Math.max(0, t.baseChance + t.perSkill * skill));
    const total = chances.reduce((s, c) => s + c, 0);
    let roll = Math.random() * total;
    let tier = QUALITY_TIERS[1];
    for (let i = 0; i < QUALITY_TIERS.length; i++) {
        roll -= chances[i];
        if (roll <= 0) { tier = QUALITY_TIERS[i]; break; }
    }
    if (tier.key === 'normal') return;
    item.quality = tier.key;
    item.name = `${tier.prefix} ${item.name}`;
    for (const stat of statKeys) {
        if (item[stat]) item[stat] = Math.round(item[stat] * tier.multiplier * 100) / 100;
    }
    if (tier.key === 'superior' && window.game?.stats) {
        window.game.stats.superiorItemsCrafted++;
    }
}

function applySpecificQuality(item, qualityTier, ...statKeys) {
    let tier = QUALITY_TIERS.find(t => t.key === qualityTier);
    if (!tier) return;
    if (tier.key === 'normal') return;
    item.quality = tier.key;
    item.name = `${tier.prefix} ${item.name}`;
    for (const stat of statKeys) {
        if (item[stat]) item[stat] = Math.round(item[stat] * tier.multiplier * 100) / 100;
    }
}

function applyEnchantment(item, colonist, game, type) {
    // Roll for enchantment tier based on colonist's enchantment skill and room quality.
    let skill = colonist.magicSkills.enchantment || 1;
    if (game && game.workshopQualities) {
        const roomId = game.map[colonist.y]?.[colonist.x]?.roomId;
        if (roomId !== null && roomId !== undefined && game.workshopQualities[roomId]) {
            skill += game.workshopQualities[roomId].qualityBonus;
        }
    }

    // Roll for a random enchantment of the given tier for the given item type.
    let enchantmentEffect;
    /*const chances = ENCHANTMENT_EFFECTS.map(t => Math.max(0, t.baseChance + t.perSkill * skill));
    const total = chances.reduce((s, c) => s + c, 0);
    let roll = Math.random() * total;
    let enchantmentEffect = ENCHANTMENT_EFFECTS[1];
    for (let i = 0; i < ENCHANTMENT_EFFECTS.length; i++) {
        roll -= chances[i];
        if (roll <= 0) { enchantmentEffect = ENCHANTMENT_EFFECTS[i]; break; }
    }*/
    if (type === 'weapons') enchantmentEffect = WEAPON_ENCHANTMENT_EFFECTS['sharpness'];
    else if (type === 'armors') enchantmentEffect = ARMOR_ENCHANTMENT_EFFECTS['protection'];
    else if (type === 'helmets') enchantmentEffect = HELMET_ENCHANTMENT_EFFECTS['wisdom'];
    else if (type === 'tools') enchantmentEffect = TOOL_ENCHANTMENT_EFFECTS['efficiency'];

    // Apply the enchantment
    item.enchantment = enchantmentEffect.key;
    item.description = `${item.description} ${enchantmentEffect.description}`;
    item.name = `${item.name} ${enchantmentEffect.suffix}`;
    if (enchantmentEffect.damageMultiplier) {
        item.damage = Math.round(item.damage * enchantmentEffect.damageMultiplier * 100) / 100;
    }
    else if (enchantmentEffect.defenseMultiplier) {
        item.defense = Math.round(item.defense * enchantmentEffect.defenseMultiplier * 100) / 100;
    }
    else if (enchantmentEffect.manaRegenMultiplier) {
        if (item.manaRegenMultiplier === undefined) {
            item.manaRegenMultiplier = 2;
        }
        else {
            item.manaRegenMultiplier = Math.round(item.manaRegenMultiplier * enchantmentEffect.manaRegenMultiplier * 100) / 100;
        }
    }
    else if (enchantmentEffect.workSpeedMultiplier) {
        if (item.workSpeed) {
            item.workSpeed = Math.round(item.workSpeed * enchantmentEffect.workSpeedMultiplier * 100) / 100;
        }
        if (item.miningSpeed) {
            item.miningSpeed = Math.round(item.miningSpeed * enchantmentEffect.workSpeedMultiplier * 100) / 100;
        }
        if (item.choppingSpeed) {
            item.choppingSpeed = Math.round(item.choppingSpeed * enchantmentEffect.workSpeedMultiplier * 100) / 100;
        }
        if (item.farmingSpeed) {
            item.farmingSpeed = Math.round(item.farmingSpeed * enchantmentEffect.workSpeedMultiplier * 100) / 100;
        }
        if (item.craftingSpeed) {
            item.craftingSpeed = Math.round(item.craftingSpeed * enchantmentEffect.workSpeedMultiplier * 100) / 100;
        }
    }
}

function applyThought(colonist, thoughtKey, tick) {
    const t = THOUGHTS[thoughtKey];
    if (t) addThought(colonist, t.text, t.moodEffect, t.duration, tick);
}

function autoAssignNewBed(game, x, y) {
    let nearest = null, bestDist = Infinity;
    for (const c of game.colonists) {
        if (c.hp <= 0 || c.golem || c.assignedBed) continue;
        const d = manhattanDist(c.x, c.y, x, y);
        if (d < bestDist) { bestDist = d; nearest = c; }
    }
    if (nearest) nearest.assignedBed = { x, y };
}

function advanceTomeStudy(colonist, game, rate) {
    if (!colonist.equippedTome) return;
    const tomeKey = colonist.equippedTome;
    const tomeDef = SPELL_TOMES[tomeKey];
    if (!tomeDef) return;
    const spellDef = SPELLS[tomeDef.spell];
    if (!spellDef) return;
    if (colonist.knownSpells.includes(tomeDef.spell)) return;

    const school = spellDef.school;
    const currentLevel = colonist.magicSkills[school] || 0;
    if (currentLevel < tomeDef.minSchoolLevel) return;

    if (!colonist.tomeProgress) colonist.tomeProgress = {};
    if (!colonist.tomeProgress[tomeKey]) colonist.tomeProgress[tomeKey] = 0;
    const progressAmount = rate !== undefined ? rate : MAGIC_STUDY_CONFIG.studyTicksPerProgress;
    colonist.tomeProgress[tomeKey] += progressAmount;

    if (!colonist._magicXpAccumulator) colonist._magicXpAccumulator = {};
    if (!colonist._magicXpAccumulator[school]) colonist._magicXpAccumulator[school] = 0;
    let studyXpGain = MAGIC_STUDY_CONFIG.xpPerStudyTick;
    if (colonist.traits.includes('scholar')) studyXpGain *= TRAITS.scholar.magicXpMult;
    if (colonist.traits.includes('prodigy')) studyXpGain *= TRAITS.prodigy.magicXpMult;
    colonist._magicXpAccumulator[school] += studyXpGain;
    if (game.tick % 10 === 0) {
        game.combatEffects.push({ x: colonist.x, y: colonist.y, char: COMBAT_VISUALS.xpGainChar, color: COMBAT_VISUALS.xpGainColor, ttl: COMBAT_VISUALS.xpGainTtl });
    }
    let magicXpNeeded = MAGIC_STUDY_CONFIG.magicXpToLevel + colonist.magicSkills[school] * MAGIC_STUDY_CONFIG.magicXpScalePerLevel;
    while (colonist._magicXpAccumulator[school] >= magicXpNeeded && colonist.magicSkills[school] < 10) {
        colonist._magicXpAccumulator[school] -= magicXpNeeded;
        colonist.magicSkills[school] = Math.min(10, colonist.magicSkills[school] + 1);
        recalcMaxMana(colonist);
        game.notifications.push({ text: `${colonist.name}'s ${MAGIC_SKILLS[school].name} increased to ${colonist.magicSkills[school]}`, tick: game.tick, type: 'success' });
        game.eventLog.add(game, `${colonist.name}'s ${MAGIC_SKILLS[school].name} increased to ${colonist.magicSkills[school]}!`, 'success', { type: 'colonist', id: colonist.id });
        game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: `${MAGIC_SKILLS[school].name} lvl ${colonist.magicSkills[school]}`, color: '#aa66ff', fontSize: 11, ttl: 20, maxTtl: 20 });
        magicXpNeeded = MAGIC_STUDY_CONFIG.magicXpToLevel + colonist.magicSkills[school] * MAGIC_STUDY_CONFIG.magicXpScalePerLevel;
    }

    if (colonist.tomeProgress[tomeKey] >= tomeDef.learningWork) {
        colonist.knownSpells.push(tomeDef.spell);
        colonist.equippedTome = null;
        delete colonist.tomeProgress[tomeKey];
        applyThought(colonist, 'learned_spell', game.tick);
        game.notifications.push({ text: `${colonist.name} learned ${spellDef.name}!`, tick: game.tick, type: 'success' });
        game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: `Learned ${spellDef.name}!`, color: '#aa66ff', fontSize: 13, ttl: 25, maxTtl: 25 });
    }
}

export function completeTask(colonist, task, game) {
    switch (task.type) {
        case 'build': {
            const tile = game.map[task.y][task.x];
            const bDef = BUILDINGS[task.buildType];
            if (bDef && bDef.structureType === 'floor') {
                tile.floor = task.buildType;
            } else {
                tile.structure = task.buildType;
                tile.passable = !IMPASSABLE_STRUCTURES.has(task.buildType);
            }
            tile.designation = null;
            if (game.mapIndex) game.mapIndex.addStructure(task.x, task.y, task.buildType);
            if (task.buildType === 'bed') autoAssignNewBed(game, task.x, task.y);
            game.roomsDirty = true;
            if (game.waves && game.waves.active) game.waves.invalidatePathPreview();
            applyThought(colonist, 'built_something', game.tick);
            game.story.checkMilestone('first_building_placed', game);
            game.combatEffects.push({ x: task.x, y: task.y, char: COMBAT_VISUALS.buildCompleteChar, color: COMBAT_VISUALS.buildCompleteColor, ttl: COMBAT_VISUALS.buildCompleteTtl });
            window.soundManager?.playSFX('build_complete');
            break;
        }
        case 'chop':
        case 'mine': {
            const tile = game.map[task.y][task.x];
            if (tile.resource) {
                const rDef = RESOURCES[tile.resource.type];
                if (rDef) {
                    const output = {};
                    for (const [res, amt] of Object.entries(rDef.yield)) {
                        output[res] = rDef.perAmount ? tile.resource.amount * amt : amt;
                    }
                    game.resources.add(output);
                }
                tile.resource = null;
                if (task.type === 'mine') {
                    tile.terrain = 'dirt';
                    tile.passable = true;
                    game.combatEffects.push({ x: task.x, y: task.y, char: COMBAT_VISUALS.mineDustChar, color: COMBAT_VISUALS.mineDustColor, ttl: COMBAT_VISUALS.mineDustTtl });
                    window.soundManager?.playSFX('mine_hit');
                }
            }
            tile.designation = null;
            applyThought(colonist, 'good_work', game.tick);
            if (game.tutorial) game.tutorial.flags.gathered = true;
            break;
        }
        case 'plant': {
            const tile = game.map[task.y][task.x];
            if (tile.zone) {
                tile.zone.state = 'growing';
                tile.zone.growth = 0;
            }
            break;
        }
        case 'harvest': {
            const tile = game.map[task.y][task.x];
            if (tile.zone) {
                const crop = tile.zone.crop;
                const yields = {};
                yields[crop] = getHarvestYield(game, crop);
                game.resources.add(yields);
                tile.zone.state = 'empty';
                tile.zone.growth = 0;
                applyThought(colonist, 'harvested', game.tick);
                game.combatEffects.push({ x: task.x, y: task.y, char: COMBAT_VISUALS.harvestChar, color: COMBAT_VISUALS.harvestColor, ttl: COMBAT_VISUALS.harvestTtl });
                window.soundManager?.playSFX('harvest');
            }
            break;
        }
        case 'enchant': {
            if (task.itemKey) {
                const def = ALL_ITEMS[task.itemKey]
                if (def) {
                    const item = { ...def, key: task.itemKey };
                    // Re-apply original item quality
                    if (def.type === 'weapon') applySpecificQuality(item, task.itemQuality, 'damage'); // TODO: Re-apply original item quality
                    else if (def.type === 'armor' || def.type === 'helmet') applySpecificQuality(item, task.itemQuality, 'damageReduction');
                    else if (def.type === 'tool') applySpecificQuality(item, task.itemQuality, 'miningSpeed', 'choppingSpeed', 'farmingSpeed', 'craftingSpeed');
                    // Apply enchantment based on item type
                    applyEnchantment(item, colonist, game, task.itemType);
                    // Add item to inventory. TODO: Make sure we also remove the original item or replace it in-place.
                    game.resources.addItem(item);
                    applyThought(colonist, 'enchanted an item', game.tick);
                    game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: `Enchanted ${item.name}`, color: '#ff00f7', fontSize: 10, ttl: 20, maxTtl: 20 });
                    window.soundManager?.playSFX('enchant_complete');
                }
                const tile = game.map[colonist.y]?.[colonist.x];
                if (tile?.structure === 'enchanting_table' && game.stats) {
                    game.stats.itemsEnchanted++;
                }
            }
            break;
        }
        case 'craft': {
            if (task.recipe) {
                const output = task.recipe.output;
                let handled = false;
                for (const key of Object.keys(output)) {
                    const def = ALL_ITEMS[key];
                    if (def && def.type !== 'material') {
                        const item = { ...def, key };
                        if (def.type === 'weapon') applyQuality(item, colonist, game, 'damage');
                        else if (def.type === 'armor' || def.type === 'helmet') applyQuality(item, colonist, game, 'damageReduction');
                        else if (def.type === 'tool') applyQuality(item, colonist, game, 'miningSpeed', 'choppingSpeed', 'farmingSpeed', 'craftingSpeed');
                        game.resources.addItem(item);
                        handled = true;
                    }
                }
                if (!handled) {
                    game.resources.add(output);
                }
                const tile = game.map[colonist.y]?.[colonist.x];
                if (tile?.structure === 'enchanting_table' && game.stats) {
                    game.stats.itemsEnchanted++;
                }
                applyThought(colonist, 'crafted', game.tick);
                const craftedName = Object.keys(task.recipe.output)[0]?.replace(/_/g, ' ') || 'item';
                game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: `Crafted ${craftedName}`, color: '#ffcc00', fontSize: 10, ttl: 20, maxTtl: 20 });
                window.soundManager?.playSFX('craft_complete');
                if (game.tutorial && output.planks) game.tutorial.flags.craftedPlanks = true;
            }
            break;
        }
        case 'cook': {
            if (task.recipe) {
                const output = { ...task.recipe.output };
                let handled = false;
                for (const key of Object.keys(output)) {
                    if (POTIONS[key]) {
                        game.resources.addPotion({ ...POTIONS[key], type: key });
                        handled = true;
                    }
                }
                if (!handled) {
                    if (output.food && game.research.isResearched('alchemy')) {
                        output.food += WORK_CONFIG.alchemyFoodBonus;
                    }
                    const cookBonus = getPedestalEffect(game, 'cookingBonusFood');
                    if (output.food && cookBonus > 0) output.food += cookBonus;
                    game.resources.add(output);
                }
                applyThought(colonist, 'cooked', game.tick);
                if (game.tutorial) game.tutorial.flags.cookedMeal = true;
            }
            break;
        }
        case 'hunt': {
            if (task.targetAnimalId) {
                const animal = game.entities.find(a => a.id === task.targetAnimalId && a.category === 'animal' && !a.tamed);
                if (animal && animal.hp > 0) {
                    colonist.huntTargetId = task.targetAnimalId;
                    colonist.state = 'hunting';
                    colonist.currentTaskId = null;
                    colonist.workProgress = 0;
                    game.taskQueue.complete(task.id);
                    return;
                }
            }
            break;
        }
        case 'extinguish': {
            const tile = game.map[task.y][task.x];
            tile.onFire = false;
            tile.fireTimer = 0;
            if (game.mapIndex) game.mapIndex.removeFire(task.x, task.y);
            applyThought(colonist, 'put_out_fire', game.tick);
            break;
        }
        case 'research': {
            let researchPts = Math.ceil((colonist.skills.research + 2) * 0.6);
            const researchMult = getEquipmentStat(colonist, 'researchSpeed');
            if (researchMult > 0) researchPts = Math.floor(researchPts * researchMult);
            if (task.diminished) researchPts = Math.max(1, Math.floor(researchPts * 0.5));
            const completedKey = game.research.addProgress(researchPts);
            if (completedKey) {
                const tech = RESEARCH[completedKey];
                const name = tech?.name || completedKey.replace(/_/g, ' ');
                const desc = tech?.description || '';
                game.notifications.push({ text: `Research complete: ${name}!`, tick: game.tick, type: 'success' });
                game.eventLog.add(game, `Research unlocked: ${name}`, 'success', null);
                game.story.checkMilestone(`research_${completedKey}`, game);
                game.combatEffects.push({ x: colonist.x, y: colonist.y, char: COMBAT_VISUALS.researchCompleteChar, color: COMBAT_VISUALS.researchCompleteColor, ttl: COMBAT_VISUALS.researchCompleteTtl });
                window.soundManager?.playSFX('research_complete');
                if (!game.events.pendingEvent) {
                    game.events.pendingEvent = {
                        type: 'research_complete',
                        text: `Research Complete: ${name}!${desc ? ' — ' + desc : ''}`,
                        choices: ['Dismiss', 'Go to Research'],
                    };
                    if (game.settings.pauseOnResearch && !game.paused) {
                        game.togglePause();
                        game._eventPaused = true;
                    }
                }
            }
            let tomeRate = game.research.activeResearch
                ? MAGIC_STUDY_CONFIG.studyTicksPerProgress
                : MAGIC_STUDY_CONFIG.tomeStudyBonus;
            const tomeSpeedMult = getEquipmentStat(colonist, 'tomeStudySpeed');
            if (tomeSpeedMult > 0) tomeRate *= tomeSpeedMult;
            advanceTomeStudy(colonist, game, tomeRate);
            break;
        }
        case 'tame': {
            if (task.targetAnimalId) {
                const wildAnimal = game.entities.find(a => a.id === task.targetAnimalId && a.category === 'animal' && !a.tamed);
                const tamedDef = wildAnimal ? TAMED_ANIMALS[wildAnimal.type] : null;
                if (tamedDef && tamedDef.dangerousTame) {
                    const result = attemptDangerousTame(game, colonist, task.targetAnimalId);
                    if (result === 'success') {
                        applyThought(colonist, 'tamed_animal', game.tick);
                        game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: 'Tamed!', color: '#44ff44', fontSize: 11, ttl: 12, maxTtl: 12 });
                    }
                } else {
                    if (completeTame(game, task.targetAnimalId)) {
                        applyThought(colonist, 'tamed_animal', game.tick);
                        game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: 'Tamed!', color: '#44ff44', fontSize: 11, ttl: 12, maxTtl: 12 });
                    }
                }
            }
            break;
        }
        case 'repair': {
            const tile = game.map[task.y][task.x];
            if (tile.structure && tile.structureHp !== undefined) {
                tile.structureHp = undefined;
                game.combatEffects.push({ x: task.x, y: task.y, char: COMBAT_VISUALS.buildCompleteChar, color: COMBAT_VISUALS.buildCompleteColor, ttl: COMBAT_VISUALS.buildCompleteTtl });
                applyThought(colonist, 'repaired', game.tick);
            }
            break;
        }
        case 'repair_artifact': {
            if (task.colonistId) {
                const target = game.getColonist(task.colonistId);
                if (target && target.artifactBroken) {
                    target.artifactBroken = false;
                    target._repairQueued = false;
                    const artName = target.artifact?.name || 'artifact';
                    game.eventLog.add(game, `${artName} repaired at the anvil`, 'success', null);
                }
            }
            if (game.resources.stockpile.runite >= 1) {
                game.resources.stockpile.runite -= 1;
            }
            applyThought(colonist, 'crafted', game.tick);
            break;
        }
        case 'deconstruct': {
            const tile = game.map[task.y][task.x];
            const target = tile.structure || tile.floor;
            if (target) {
                const def = BUILDINGS[target];
                if (def) {
                    const partial = {};
                    for (const [res, amt] of Object.entries(def.cost)) {
                        partial[res] = Math.ceil(amt * COLONIST_CONFIG.deconstructRecovery);
                    }
                    game.resources.add(partial);
                }
                if (tile.structure) {
                    if (tile.structure === 'bed') {
                        for (const c of game.colonists) {
                            if (c.assignedBed && c.assignedBed.x === task.x && c.assignedBed.y === task.y) {
                                c.assignedBed = null;
                            }
                        }
                    }
                    if (game.mapIndex) game.mapIndex.removeStructure(task.x, task.y, tile.structure);
                    tile.structure = null;
                    tile.passable = true;
                } else {
                    if (game.mapIndex) game.mapIndex.removeStructure(task.x, task.y, tile.floor);
                    tile.floor = null;
                }
                tile.designation = null;
                game.roomsDirty = true;
                applyThought(colonist, 'deconstructed', game.tick);
                game.combatEffects.push({ x: task.x, y: task.y, char: COMBAT_VISUALS.mineDustChar, color: COMBAT_VISUALS.mineDustColor, ttl: COMBAT_VISUALS.mineDustTtl });
            }
            break;
        }
    }

    if (task.skillRequired && colonist.skills[task.skillRequired] !== undefined) {
        const maxLevel = COLONIST_CONFIG.skillMaxLevel;
        if (colonist.skills[task.skillRequired] < maxLevel) {
            if (!colonist.skillXp) colonist.skillXp = {};
            if (!colonist.skillXp[task.skillRequired]) colonist.skillXp[task.skillRequired] = 0;
            let xpGain = COLONIST_CONFIG.skillXpPerTask;
            if (colonist.pedestalSkillBonus) xpGain *= (1 + colonist.pedestalSkillBonus);
            if (colonist.traits.includes('prodigy')) xpGain *= TRAITS.prodigy.allSkillXpMult;
            colonist.skillXp[task.skillRequired] += xpGain;
            let xpNeeded = COLONIST_CONFIG.skillXpToLevel + colonist.skills[task.skillRequired] * COLONIST_CONFIG.skillXpScalePerLevel;
            while (colonist.skillXp[task.skillRequired] >= xpNeeded && colonist.skills[task.skillRequired] < maxLevel) {
                colonist.skillXp[task.skillRequired] -= xpNeeded;
                colonist.skills[task.skillRequired]++;
                game.eventLog.add(game, `${colonist.name}'s ${task.skillRequired} skill increased to ${colonist.skills[task.skillRequired]}!`, 'success', { type: 'colonist', id: colonist.id });
                game.overlays.push({ type: 'floating_text', x: colonist.x, y: colonist.y, text: `${task.skillRequired} lvl ${colonist.skills[task.skillRequired]}`, color: '#44ff44', fontSize: 11, ttl: 20, maxTtl: 20 });
                xpNeeded = COLONIST_CONFIG.skillXpToLevel + colonist.skills[task.skillRequired] * COLONIST_CONFIG.skillXpScalePerLevel;
            }
        }
    }

    game.taskQueue.complete(task.id);
    colonist.currentTaskId = null;
    colonist.state = 'idle';
    colonist.workProgress = 0;
}
