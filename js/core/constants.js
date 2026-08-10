// Canonical string constants for colonist states and task types.
// Use these instead of raw string literals to prevent typo bugs and improve searchability.

export const STATES = Object.freeze({
    IDLE: 'idle',
    MOVING: 'moving',
    WORKING: 'working',
    SLEEPING: 'sleeping',
    EATING: 'eating',
    DRAFTED: 'drafted',
    FIGHTING: 'fighting',
    WANDERING: 'wandering',
    HUNTING: 'hunting',
});

export const TASK_TYPES = Object.freeze({
    BUILD: 'build',
    CHOP: 'chop',
    MINE: 'mine',
    GATHER: 'gather',
    REPAIR: 'repair',
    REPAIR_ARTIFACT: 'repair_artifact',
    COOK: 'cook',
    CRAFT: 'craft',
    HARVEST: 'harvest',
    PLANT: 'plant',
    HAUL: 'haul',
    TEND: 'tend',
    HUNT: 'hunt',
    TAME: 'tame',
    RESEARCH: 'research',
    EXTINGUISH: 'extinguish',
});
