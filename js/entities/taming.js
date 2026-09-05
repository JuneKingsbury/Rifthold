import { ANIMALS, TAMED_ANIMALS, WORK_CONFIG, THOUGHTS, TRAITS } from '../core/config.js';
import { colonistTakeDamage, addThought } from './colonist.js';
import { createTamedEntity } from './entity-factory.js';
import { updateEntityRoles, updateEntityEffects } from './roles.js';

export function updateTamedAnimals(game) {
    if (!game.research.isResearched('beast_binding')) return;

    for (let i = game.entities.length - 1; i >= 0; i--) {
        const animal = game.entities[i];
        if (!animal.tamed) continue;

        if (animal.hp <= 0) {
            _handleTamedDeath(animal, game);
            game.entities.splice(i, 1);
            continue;
        }

        if (animal.onExpedition || animal.pendingTame) continue;

        _updateHunger(animal, game);
        updateEntityRoles(animal, game);
        updateEntityEffects(animal, game);
    }
}

function _handleTamedDeath(animal, game) {
    const typeName = animal.type.charAt(0).toUpperCase() + animal.type.slice(1);
    game.notifications.push({ text: `${typeName} has died!`, tick: game.tick, type: 'danger' });
    game.eventLog.add(game, `Tamed ${animal.type} died`, 'danger', { type: 'position', x: animal.x, y: animal.y });
    if (animal.bondedColonistId) {
        const bonded = game.colonists.find(c => c.id === animal.bondedColonistId);
        if (bonded) {
            const thoughtKey = animal.isPet ? 'pet_died' : 'animal_died';
            const t = THOUGHTS[thoughtKey];
            if (t) addThought(bonded, t.text, t.moodEffect, t.duration, game.tick);
        }
    }
}

function _updateHunger(animal, game) {
    const tamedDef = TAMED_ANIMALS[animal.type];
    if (!tamedDef?.hungerRate) return;

    animal.hungerTimer = (animal.hungerTimer || 0) + 1;
    if (animal.hungerTimer >= tamedDef.hungerRate) {
        animal.hungerTimer = 0;
        animal.hunger = (animal.hunger || 0) + 1;

        const threshold = tamedDef.hungerThreshold || 3;
        if (animal.hunger >= threshold && !animal._feedTaskQueued) {
            animal._feedTaskQueued = true;
            game.taskQueue.add({
                type: 'feed_animal',
                skillRequired: 'animals',
                x: animal.penX ?? animal.x,
                y: animal.penY ?? animal.y,
                workAmount: 10,
                targetAnimalId: animal.id,
            });
        }

        if (animal.hunger >= threshold + 1 && Math.random() < 0.005) {
            _escapeAnimal(animal, game);
        }
    }
}

function _escapeAnimal(animal, game) {
    const typeName = animal.type.charAt(0).toUpperCase() + animal.type.slice(1);
    game.notifications.push({ text: `${typeName} escaped! (starved)`, tick: game.tick, type: 'danger' });
    game.eventLog.add(game, `${animal.type} escaped the colony`, 'danger', { type: 'position', x: animal.x, y: animal.y });
    if (animal.bondedColonistId) {
        const bonded = game.colonists.find(c => c.id === animal.bondedColonistId);
        if (bonded) {
            const t = THOUGHTS.animal_escaped;
            if (t) addThought(bonded, t.text, t.moodEffect, t.duration, game.tick);
        }
    }
    animal.tamed = false;
    animal.fleeing = true;
    animal.penX = undefined;
    animal.penY = undefined;
    animal.bondedColonistId = null;
    animal.isPet = false;
    animal.bondLevel = 0;
    animal._feedTaskQueued = false;
    animal.hunger = 0;
    animal.roles = [];
    animal.roleState = {};
    animal.effects = [];
}


export function designateTame(game, wildAnimalId) {
    if (!game.research.isResearched('beast_binding')) return false;

    const wildAnimal = game.entities.find(a => a.id === wildAnimalId && a.category === 'animal' && !a.tamed);
    if (!wildAnimal || wildAnimal.hp <= 0) return false;

    const animalDef = ANIMALS[wildAnimal.type];
    if (!animalDef || !animalDef.tameable) return false;

    const tamedDef = TAMED_ANIMALS[wildAnimal.type];
    if (!tamedDef) return false;

    if (!game.resources.has({ food: tamedDef.foodToTame })) return false;
    if (!tamedDef.guardAnimal && !findAnyPen(game)) return false;

    game.resources.deduct({ food: tamedDef.foodToTame });

    const workAmount = tamedDef.dangerousTame ? WORK_CONFIG.dangerousTameWork : WORK_CONFIG.tameWork;

    game.taskQueue.add({
        type: 'tame',
        skillRequired: 'animals',
        x: wildAnimal.x,
        y: wildAnimal.y,
        workAmount,
        targetAnimalId: wildAnimalId,
    });

    game.notifications.push({ text: `Taming ${wildAnimal.type}...`, tick: game.tick, type: 'success' });
    return true;
}

export function completeTame(game, wildAnimalId, colonistId) {
    const wildIdx = game.entities.findIndex(a => a.id === wildAnimalId && a.category === 'animal' && !a.tamed);
    if (wildIdx === -1) return false;
    const wildAnimal = game.entities[wildIdx];
    if (wildAnimal.hp <= 0) return false;

    const tamedDef = TAMED_ANIMALS[wildAnimal.type];

    if (tamedDef.guardAnimal) {
        // Guard animals stay in place with no leading needed.
        return _finalizeTame(game, wildIdx, wildAnimal, wildAnimal.x, wildAnimal.y, colonistId);
    }

    const pen = findAnyPen(game);
    if (!pen) return false;

    // Mark the wild animal as pending tame so it stops fleeing and waits.
    wildAnimal.pendingTame = true;
    wildAnimal.leaderId = colonistId || null;

    return 'lead';
}

export function finalizeTame(game, wildAnimalId, colonistId, penX, penY) {
    const wildIdx = game.entities.findIndex(a => a.id === wildAnimalId && a.category === 'animal');
    if (wildIdx === -1) return false;
    const wildAnimal = game.entities[wildIdx];
    if (wildAnimal.hp <= 0) return false;

    let spawnX = penX, spawnY = penY;
    if (spawnX === undefined) {
        const pen = findAnyPen(game);
        if (!pen) return false;
        spawnX = pen.x;
        spawnY = pen.y;
    }

    return _finalizeTame(game, wildIdx, wildAnimal, spawnX, spawnY, colonistId);
}

function _finalizeTame(game, wildIdx, wildAnimal, spawnX, spawnY, colonistId) {
    game.entities.splice(wildIdx, 1);
    const tamed = createTamedEntity(wildAnimal.type, spawnX, spawnY);
    if (colonistId) tamed.bondedColonistId = colonistId;
    game.entities.push(tamed);
    game.notifications.push({ text: `Tamed a ${wildAnimal.type}!`, tick: game.tick, type: 'success' });
    game.eventLog.add(game, `Tamed a ${wildAnimal.type}`, 'success', { type: 'position', x: spawnX, y: spawnY });
    game.story.checkMilestone('first_animal_tamed', game);

    if (game.exploration) {
        const existing = game.exploration.wildlifeKills.get(wildAnimal.type);
        if (existing) {
            existing.tameCount = (existing.tameCount || 0) + 1;
        } else {
            const d = ANIMALS[wildAnimal.type];
            const drops = [];
            if (d?.meatYield) drops.push(`${d.meatYield} meat`);
            if (d?.hideYield) drops.push(`${d.hideYield} hides`);
            if (d?.woolYield) drops.push(`${d.woolYield} wool`);
            game.exploration.wildlifeKills.set(wildAnimal.type, {
                name: wildAnimal.type.charAt(0).toUpperCase() + wildAnimal.type.slice(1),
                char: d?.char || '?',
                color: d?.color || '#888888',
                sprite: wildAnimal.type,
                drops: drops.length ? drops.join(', ') : 'Nothing',
                count: 0,
                tameCount: 1
            });
        }
    }

    return true;
}

export function getTameChance(colonist, animalType, game) {
    const tamedDef = TAMED_ANIMALS[animalType];
    if (!tamedDef || !tamedDef.dangerousTame) return 1;
    let baseChance = tamedDef.baseTameChance || 0.4;
    if (animalType === 'wolf' && game?.research?.isResearched('wolf_mastery')) baseChance += 0.2;
    const skillBonus = (colonist.skills.animals || 0) * WORK_CONFIG.tameSkillChanceBonus;
    let traitBonus = 0;
    if (colonist.traits?.includes('beast_whisperer')) traitBonus += TRAITS.beast_whisperer.tameChanceBonus;
    if (colonist.traits?.includes('skittish')) traitBonus -= TRAITS.skittish.tameChancePenalty;
    return Math.max(0.05, Math.min(1, baseChance + skillBonus + traitBonus));
}

export function attemptDangerousTame(game, colonist, wildAnimalId) {
    const wildAnimal = game.entities.find(a => a.id === wildAnimalId && a.category === 'animal' && !a.tamed);
    if (!wildAnimal || wildAnimal.hp <= 0) return 'fail';

    const tamedDef = TAMED_ANIMALS[wildAnimal.type];
    const chance = getTameChance(colonist, wildAnimal.type, game);

    if (Math.random() < chance) {
        completeTame(game, wildAnimalId, colonist.id);
        return 'success';
    }

    const retDmg = tamedDef.retaliationDamage || ANIMALS[wildAnimal.type].damage;
    colonistTakeDamage(colonist, retDmg, game);
    const t = THOUGHTS.wolf_retaliated;
    addThought(colonist, t.text, t.moodEffect, t.duration, game.tick);
    game.notifications.push({ text: `Wolf attacked ${colonist.name}!`, tick: game.tick, type: 'danger' });
    game.eventLog.add(game, `Wolf retaliated against ${colonist.name} during taming`, 'danger', { type: 'colonist', id: colonist.id });
    return 'fail';
}


function findAnyPen(game) {
    if (game.mapIndex) {
        return game.mapIndex.findFirst('beast_circle');
    }
    for (let y = 0; y < game.map.length; y++) {
        for (let x = 0; x < game.map[y].length; x++) {
            if (game.map[y][x].structure === 'beast_circle') {
                return { x, y };
            }
        }
    }
    return null;
}
