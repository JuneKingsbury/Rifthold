import { ANIMALS, TAMED_ANIMALS, WORK_CONFIG, THOUGHTS } from '../core/config.js';
import { colonistTakeDamage, addThought } from './colonist.js';
import { createTamedEntity } from './entity-factory.js';
import { updateEntityRoles, updateEntityEffects } from './roles.js';

export function updateTamedAnimals(game) {
    if (!game.research.isResearched('beast_binding')) return;

    const tamedAnimals = game.entities.filter(e => e.tamed);
    for (const animal of tamedAnimals) {
        if (animal.onExpedition) continue;
        updateEntityRoles(animal, game);
        updateEntityEffects(animal, game);
    }
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

export function completeTame(game, wildAnimalId) {
    const wildIdx = game.entities.findIndex(a => a.id === wildAnimalId && a.category === 'animal' && !a.tamed);
    if (wildIdx === -1) return false;
    const wildAnimal = game.entities[wildIdx];
    if (wildAnimal.hp <= 0) return false;

    const tamedDef = TAMED_ANIMALS[wildAnimal.type];
    let spawnX = wildAnimal.x, spawnY = wildAnimal.y;

    if (!tamedDef.guardAnimal) {
        const pen = findAnyPen(game);
        if (!pen) return false;
        spawnX = pen.x;
        spawnY = pen.y;
    }

    game.entities.splice(wildIdx, 1);
    const tamed = createTamedEntity(wildAnimal.type, spawnX, spawnY);
    game.entities.push(tamed);
    game.notifications.push({ text: `Tamed a ${wildAnimal.type}!`, tick: game.tick, type: 'success' });
    game.eventLog.add(game, `Tamed a ${wildAnimal.type}`, 'success', { type: 'position', x: spawnX, y: spawnY });
    game.story.checkMilestone('first_animal_tamed', game);
    return true;
}

export function getTameChance(colonist, animalType, game) {
    const tamedDef = TAMED_ANIMALS[animalType];
    if (!tamedDef || !tamedDef.dangerousTame) return 1;
    let baseChance = tamedDef.baseTameChance || 0.4;
    if (animalType === 'wolf' && game?.research?.isResearched('wolf_mastery')) baseChance += 0.2;
    const skillBonus = (colonist.skills.animals || 0) * WORK_CONFIG.tameSkillChanceBonus;
    return Math.min(1, baseChance + skillBonus);
}

export function attemptDangerousTame(game, colonist, wildAnimalId) {
    const wildAnimal = game.entities.find(a => a.id === wildAnimalId && a.category === 'animal' && !a.tamed);
    if (!wildAnimal || wildAnimal.hp <= 0) return 'fail';

    const tamedDef = TAMED_ANIMALS[wildAnimal.type];
    const chance = getTameChance(colonist, wildAnimal.type, game);

    if (Math.random() < chance) {
        completeTame(game, wildAnimalId);
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
