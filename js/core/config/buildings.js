export const BUILD_CATEGORIES = ['Walls & Floors', 'Furniture', 'Production', 'Defense', 'Arcane'];

export const BUILDINGS = {
    // === Walls & Floors ===
    wood_wall:         { char: '█', color: '#aa7744', cost: { wood: 2 }, work: 12, hp: 50, structureType: 'wall', category: 'Walls & Floors', passable: { colonist: false, animal: false, enemy: false }, breakable: true, description: 'Blocks movement. Forms rooms when enclosing an area with doors.' },
    stone_wall:        { char: '█', color: '#666666', cost: { stone: 2 }, work: 16, hp: 70, structureType: 'wall', category: 'Walls & Floors', passable: { colonist: false, animal: false, enemy: false }, breakable: true, description: 'Blocks movement. Forms rooms when enclosing an area with doors.' },
    fence:             { char: '|', color: '#886644', cost: { wood: 1 }, work: 5, hp: 20, structureType: 'wall', category: 'Walls & Floors', passable: { colonist: false, animal: false, enemy: false }, breakable: true, description: 'Blocks movement like a wall but lighter to build.' },
    door:              { char: '+', color: '#cc9955', cost: { wood: 3 }, work: 15, hp: 30, structureType: 'door', category: 'Walls & Floors', passable: { colonist: true, animal: false, enemy: false }, breakable: true, description: 'Allows colonist passage. Blocks enemies. Room boundary.' },
    wood_floor:        { char: '·', color: '#aa7744', bg: '#3d2a14', cost: { wood: 1 }, work: 6, structureType: 'floor', category: 'Walls & Floors', description: 'Cosmetic flooring. Makes rooms nicer.' },
    stone_floor:       { char: '·', color: '#666666', bg: '#2a2a2a', cost: { stone: 1 }, work: 6, structureType: 'floor', category: 'Walls & Floors', description: 'Cosmetic flooring. Makes rooms nicer.' },
    brick_wall:        { char: '█', color: '#b2463c', cost: { bricks: 2 }, work: 20, hp: 90, structureType: 'wall', category: 'Walls & Floors', passable: { colonist: false, animal: false, enemy: false }, breakable: true, research: 'stonework', description: 'Blocks movement. Forms rooms when enclosing an area with doors.' },
    brick_floor:       { char: '·', color: '#b2463c', bg: '#3a1a18', cost: { bricks: 1 }, work: 6, structureType: 'floor', category: 'Walls & Floors', research: 'stonework', description: 'Cosmetic flooring. Makes rooms nicer.' },
    reinforced_door:   { char: '╬', color: '#aa8855', cost: { stone: 3, iron: 2, planks: 2 }, work: 22, hp: 50, structureType: 'door', category: 'Walls & Floors', passable: { colonist: true, animal: false, enemy: false }, breakable: true, research: 'fortification', description: 'Reinforced door (50 HP). Mid-tier between regular and void doors.' },
    void_wall:         { char: '▓', color: '#6622aa', cost: { stone: 3, void_essence: 3 }, work: 15, hp: 120, structureType: 'wall', category: 'Walls & Floors', passable: { colonist: false, animal: false, enemy: false }, breakable: true, research: 'void_architecture', description: 'Reinforced wall (120 HP). Blocks enemies.' },
    void_door:         { char: '▒', color: '#7733bb', cost: { stone: 3, planks: 2, void_essence: 4 }, work: 20, hp: 80, structureType: 'door', category: 'Walls & Floors', passable: { colonist: true, animal: false, enemy: false }, breakable: true, research: 'void_architecture', description: 'Reinforced door (80 HP). Colonists pass through, enemies must break it.' },

    // === Furniture ===
    torch:             { char: 'i', color: '#ffcc00', cost: { wood: 1 }, work: 4, structureType: 'furniture', category: 'Furniture', dragPlace: true, lightRadius: 5, description: 'Light source. Provides warmth in winter.' },
    bed:               { char: 'B', color: '#8855aa', cost: { wood: 5 }, work: 25, structureType: 'furniture', category: 'Furniture', description: 'Colonists sleep here. Assign for a mood bonus.' },
    food_chest:        { char: 'S', color: '#997744', cost: { planks: 4, stone: 2 }, work: 25, structureType: 'furniture', category: 'Furniture', description: 'Preserves food — reduces spoilage by 15% per chest (stacks up to 60%).' },
    ice_box:           { char: 'I', color: '#88ccff', cost: { runite: 2, stone: 4, planks: 2, void_essence: 2 }, work: 40, structureType: 'furniture', category: 'Furniture', research: 'alchemy', power: { consumes: 1 }, description: 'Magically chills food — reduces spoilage by 40%. Consumes 1 mana.' },
    glowstone:         { char: 'L', color: '#ffff88', cost: { planks: 2, stone: 1 }, work: 14, structureType: 'furniture', category: 'Furniture', lightRadius: 10, research: 'luminance', power: { consumes: 2, radius: 5 }, description: 'Mana-powered light, radius 5. Consumes 2 mana.' },
    rug:               { char: '~', color: '#cc6644', bg: '#4a2211', cost: { leather: 2 }, work: 10, structureType: 'floor', category: 'Furniture', description: 'Decorative rug. Counts as fine flooring for room quality.' },
    shelf:             { char: '=', color: '#996633', cost: { planks: 3 }, work: 12, structureType: 'furniture', category: 'Furniture', roomQuality: 5, description: 'Wall shelf. Improves room quality.' },
    chair:             { char: 'h', color: '#aa7744', cost: { planks: 2 }, work: 8, structureType: 'furniture', category: 'Furniture', roomQuality: 4, description: 'A simple chair. Improves room quality.' },
    bookcase:          { char: '║', color: '#775533', cost: { planks: 4, leather: 1 }, work: 18, structureType: 'furniture', category: 'Furniture', roomQuality: 7, research: 'stonework', description: 'A bookcase. Improves room quality.' },
    tool_rack:         { char: '╥', color: '#886644', cost: { planks: 3, iron: 1 }, work: 15, structureType: 'furniture', category: 'Furniture', workshopBonus: 10, description: 'Organized tools. Improves workshop quality.' },
    material_shelf:    { char: '╡', color: '#997755', cost: { planks: 4 }, work: 12, structureType: 'furniture', category: 'Furniture', workshopBonus: 8, description: 'Material storage. Improves workshop quality.' },

    // === Production (ordered by progression) ===
    workbench:         { char: 'C', color: '#bb8833', cost: { wood: 5, stone: 2 }, work: 30, structureType: 'furniture', category: 'Production', description: 'Basic crafting — planks, bricks, leather, simple weapons, and tools.' },
    cauldron:          { char: 'F', color: '#ff6633', cost: { stone: 3, wood: 1 }, work: 18, structureType: 'furniture', category: 'Production', description: 'Required for cooking meals from raw food and crops.' },
    research_desk:     { char: 'R', color: '#44aaff', cost: { wood: 5, stone: 3, planks: 2 }, work: 40, structureType: 'furniture', category: 'Production', description: 'Colonists study here to generate research points.' },
    anvil:             { char: '⌂', color: '#999999', cost: { stone: 6, bricks: 2, planks: 2 }, work: 30, structureType: 'furniture', category: 'Production', description: 'Required for metalworking — iron weapons, armor, tools, and artifact repair.' },
    alchemy_table:     { char: '⚗', color: '#44cc88', cost: { planks: 4, stone: 2 }, work: 25, structureType: 'furniture', category: 'Production', research: 'alchemy', description: 'Required for brewing potions.' },
    beast_circle:      { char: 'A', color: '#9cf642', cost: { wood: 6 }, work: 28, structureType: 'furniture', category: 'Production', research: 'beast_binding', description: 'Required for binding creatures. Bound animals produce resources.' },
    enchanting_table:  { char: 'P', color: '#bb88ff', cost: { planks: 4, stone: 3 }, work: 35, structureType: 'furniture', category: 'Production', research: 'arcane_infusion', power: { consumes: 4, speedMult: 1.5 }, description: '1.5x crafting speed. Consumes 4 mana.' },
    scriptorium:       { char: '𝕊', color: '#4488cc', cost: { planks: 6, stone: 3, leather: 2 }, work: 40, structureType: 'furniture', category: 'Production', research: 'arcane_studies', description: 'Required for crafting spell tomes.' },
    golem_forge:       { char: 'Ğ', color: '#cc8833', cost: { stone: 8, runite: 4, planks: 4 }, work: 50, structureType: 'furniture', category: 'Production', research: 'golem_craft', description: 'Animate stone golems. Click to craft.' },

    // === Defense (ordered by progression) ===
    arcane_sentinel:   { char: 'X', color: '#ff4444', cost: { stone: 5, planks: 3 }, work: 50, structureType: 'furniture', category: 'Defense', passable: { colonist: false, animal: false, enemy: false }, research: 'warding', power: { consumes: 3, damage: 12, range: 4, attackCooldown: 3 }, description: 'Auto-attacks enemies in range 4, 12 dmg. Consumes 3 mana.' },
    void_nexus:        { char: 'V', color: '#9933ff', cost: { runite: 5, stone: 6, planks: 4 }, work: 60, structureType: 'furniture', category: 'Defense', passable: { colonist: false, animal: false, enemy: false }, research: 'void_summoning', maxCount: 1, description: 'Start wave defense here. Defend it from enemies to earn void essence.' },
    void_turret:       { char: 'Y', color: '#aa33ff', cost: { stone: 5, planks: 3, void_essence: 6 }, work: 55, structureType: 'furniture', category: 'Defense', passable: { colonist: false, animal: false, enemy: false }, research: 'void_forging', power: { consumes: 5, damage: 20, range: 5, attackCooldown: 5 }, description: 'Auto-attacks enemies in range 5, 20 dmg. Consumes 5 mana.' },
    inferno_ward:      { char: 'Ħ', color: '#ff4400', cost: { stone: 5, runite: 3, planks: 2 }, work: 40, structureType: 'furniture', category: 'Defense', research: 'pyroclasm', power: { consumes: 5, warmRadius: 4, damage: 8, attackCooldown: 2 }, description: 'Incinerates nearby enemies (radius 4, 8 dmg/tick). Also warms. Consumes 5 mana.' },

    // === Arcane (ordered by progression) ===
    mana_crystal:      { char: 'W', color: '#aa44ff', cost: { wood: 8, stone: 4 }, work: 45, structureType: 'furniture', category: 'Arcane', passable: { colonist: false, animal: false, enemy: false }, research: 'ley_channeling', maxCount: 4, maxCountBonusKey: 'manaCrystalBonus', power: { generates: 8 }, description: 'Generates 8 mana for powering magical buildings. Limit: 4 (upgradeable).' },
    hearth_shrine:     { char: '♥', color: '#ff8866', cost: { stone: 6, planks: 4, runite: 2 }, work: 50, structureType: 'furniture', category: 'Arcane', passable: { colonist: false, animal: false, enemy: false }, research: 'ley_channeling', maxCount: 1, power: { consumes: 4 }, colonistCapBonus: 2, description: 'A warm beacon that draws settlers. +2 colonist cap. Consumes 4 mana.' },
    ember_ward:        { char: 'H', color: '#ff8844', cost: { stone: 4, planks: 2 }, work: 28, structureType: 'furniture', category: 'Arcane', research: 'ember_magic', power: { consumes: 3, warmRadius: 4 }, description: 'Warms nearby tiles (radius 4) in winter. Consumes 3 mana.' },
    mana_relay:        { char: '⊛', color: '#aa88ff', cost: { planks: 3, runite: 2 }, work: 25, structureType: 'furniture', category: 'Arcane', research: 'arcane_conduits', power: { consumes: 1, radius: 3 }, description: 'Mana buildings within 3 tiles consume 1 less mana (min 1). Does not stack. Consumes 1 mana.' },
    artifact_pedestal: { char: '◆', color: '#ccaa44', cost: { stone: 8, runite: 2 }, work: 35, structureType: 'furniture', category: 'Arcane', research: 'arcane_infusion', description: 'Place an artifact to project its effect in a radius. Mana cost varies by artifact.' },
    beacon:            { char: '☀', color: '#ffffaa', cost: { stone: 4, runite: 3, planks: 2 }, work: 35, structureType: 'furniture', category: 'Arcane', lightRadius: 15, research: 'brilliance', power: { consumes: 4, radius: 10 }, description: 'Radiant beacon. Massive light radius 15. Consumes 4 mana.' },
    ritual_core:       { char: '◎', color: '#aa44ff', cost: { runite: 5, void_essence: 3, planks: 4 }, work: 50, structureType: 'furniture', category: 'Arcane', research: 'advanced_arcana', description: 'Core of the Ritual Circle. Place altars around it to activate (-30% spell cooldowns).' },
    forge_core:        { char: '⚒', color: '#ff8844', cost: { stone: 6, runite: 3, planks: 3 }, work: 40, structureType: 'furniture', category: 'Arcane', research: 'masterwork', description: 'Core of the Great Forge. Surround with walls + door to activate (2.5x equipment crafting).' },
    rift_gate:         { char: 'Ω', color: '#33ccff', cost: { runite: 4, stone: 6, planks: 4, void_essence: 8 }, work: 60, structureType: 'furniture', category: 'Arcane', passable: { colonist: false, animal: false, enemy: false }, research: 'planar_rift', maxCount: 1, power: { consumes: 6 }, description: 'Send exploration parties to other realms. Consumes 6 mana.' },
};

const BASE_TILE_CHARS = {
    farm_empty: '=', farm_growing: '%', farm_ready: '*',
    snow: '*',
};

const BASE_TILE_COLORS = {
    farm_empty: '#664400', farm_growing: '#55aa22', farm_ready: '#ffdd00',
    colonist: '#ffff00', raider: '#ff3333', deer: '#bb8855', rabbit: '#ccaa88', wolf: '#666666',
    snow: '#ffffff', snowBg: '#888888', cursor: '#ffffff',
    designation_chop: '#ff8800', designation_mine: '#ff8800', designation_build: '#88dbff', designation_deconstruct: '#ff4444',
};

export const TILE_CHARS = { ...BASE_TILE_CHARS, ...Object.fromEntries(Object.entries(BUILDINGS).map(([k, v]) => [k, v.char])) };
export const TILE_COLORS = { ...BASE_TILE_COLORS, ...Object.fromEntries(Object.entries(BUILDINGS).map(([k, v]) => [k, v.color])) };

export const IMPASSABLE_STRUCTURES = new Set(
    Object.entries(BUILDINGS).filter(([, b]) => b.passable && !b.passable.colonist).map(([k]) => k)
);
export const ENEMY_BLOCKED_STRUCTURES = new Set(
    Object.entries(BUILDINGS).filter(([, b]) => b.passable && !b.passable.enemy).map(([k]) => k)
);
export const BREAKABLE_STRUCTURES = new Set(
    Object.entries(BUILDINGS).filter(([, b]) => b.breakable).map(([k]) => k)
);
export const WALL_STRUCTURES = new Set(
    Object.entries(BUILDINGS).filter(([, b]) => b.structureType === 'wall').map(([k]) => k)
);
export const DOOR_STRUCTURES = new Set(
    Object.entries(BUILDINGS).filter(([, b]) => b.structureType === 'door').map(([k]) => k)
);
export const DRAG_BUILD_TYPES = new Set(
    Object.entries(BUILDINGS).filter(([, b]) => b.structureType === 'wall' || b.structureType === 'floor' || b.structureType === 'door' || b.dragPlace).map(([k]) => k)
);

export const COMPLEX_STRUCTURES = {
    great_forge: {
        name: 'Great Forge',
        research: 'masterwork',
        coreBuild: 'forge_core',
        layout: [
            { dx: -1, dy: -1, req: 'wall' }, { dx: 0, dy: -1, req: 'wall' }, { dx: 1, dy: -1, req: 'wall' },
            { dx: -1, dy: 0, req: 'wall' },  { dx: 1, dy: 0, req: 'wall' },
            { dx: -1, dy: 1, req: 'wall' },  { dx: 0, dy: 1, req: 'door' },  { dx: 1, dy: 1, req: 'wall' },
        ],
        effect: { craftSpeedMult: 2.5, craftCategories: ['Weapons', 'Armor', 'Tools'] },
        description: '3x3 enclosed room with Forge Core at center. Walls on all sides, door on one. 2.5x equipment crafting speed.',
    },
    ritual_circle: {
        name: 'Ritual Circle',
        research: 'advanced_arcana',
        coreBuild: 'ritual_core',
        layout: [
            { dx: 0, dy: -2, req: 'wall' },
            { dx: -1, dy: -1, req: 'wall' }, { dx: 1, dy: -1, req: 'wall' },
            { dx: -2, dy: 0, req: 'wall' }, { dx: 2, dy: 0, req: 'wall' },
            { dx: -1, dy: 1, req: 'wall' }, { dx: 1, dy: 1, req: 'wall' },
            { dx: 0, dy: 2, req: 'wall' },
        ],
        effect: { spellCooldownMult: 0.7, radius: 6 },
        description: 'Diamond pattern (5x5) with Ritual Core at center. Walls at cardinal + diagonal positions. Reduces spell cooldowns by 30% in radius 6.',
    },
};
