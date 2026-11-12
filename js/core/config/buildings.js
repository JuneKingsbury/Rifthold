import { stampLoc } from '../i18n.js';

export const BUILD_CATEGORIES = ['Walls & Floors', 'Furniture', 'Production', 'Defense', 'Arcane'];

export const BUILDINGS = {
    // === Walls & Floors ===
    wood_wall:         { char: '█', color: '#aa7744', cost: { wood: 2 }, work: 12, hp: 50, structureType: 'wall', category: 'Walls & Floors', passable: { colonist: false, animal: false, enemy: false }, breakable: true },
    stone_wall:        { char: '█', color: '#666666', cost: { stone: 2 }, work: 16, hp: 70, structureType: 'wall', category: 'Walls & Floors', passable: { colonist: false, animal: false, enemy: false }, breakable: true },
    fence:             { char: '|', color: '#886644', cost: { wood: 1 }, work: 5, hp: 20, structureType: 'wall', category: 'Walls & Floors', passable: { colonist: false, animal: false, enemy: false }, breakable: true, showGround: true },
    door:              { char: '+', color: '#cc9955', cost: { wood: 3 }, work: 15, hp: 30, structureType: 'door', category: 'Walls & Floors', passable: { colonist: true, animal: false, enemy: false }, breakable: true },
    fence_gate:        { char: '╪', color: '#886644', cost: { wood: 2 }, work: 10, hp: 20, structureType: 'door', category: 'Walls & Floors', passable: { colonist: true, animal: false, enemy: false }, breakable: true, showGround: true },
    wood_floor:        { char: '·', color: '#aa7744', bg: '#3d2a14', cost: { wood: 1 }, work: 6, structureType: 'floor', category: 'Walls & Floors' },
    stone_floor:       { char: '·', color: '#666666', bg: '#2a2a2a', cost: { stone: 1 }, work: 6, structureType: 'floor', category: 'Walls & Floors' },
    brick_wall:        { char: '█', color: '#b2463c', cost: { bricks: 2 }, work: 20, hp: 90, structureType: 'wall', category: 'Walls & Floors', passable: { colonist: false, animal: false, enemy: false }, breakable: true, research: 'warding' },
    brick_floor:       { char: '·', color: '#b2463c', bg: '#3a1a18', cost: { bricks: 1 }, work: 6, structureType: 'floor', category: 'Walls & Floors', research: 'warding' },
    gravel_path:       { char: '·', color: '#8a8578', cost: { stone: 1 },  moveCost: 6, work: 6, structureType: 'floor', category: 'Walls & Floors', transparentFloor: true },
    brick_path:        { char: '·', color: '#b2463c', cost: { bricks: 1 }, moveCost: 6, work: 6, structureType: 'floor', category: 'Walls & Floors', research: 'warding', transparentFloor: true },
    reinforced_door:   { char: '╬', color: '#aa8855', cost: { stone: 3, iron: 2, planks: 2 }, work: 22, hp: 50, structureType: 'door', category: 'Walls & Floors', passable: { colonist: true, animal: false, enemy: false }, breakable: true, research: 'fortification' },
    void_wall:         { char: '▓', color: '#6622aa', cost: { stone: 3, void_essence: 3 }, work: 15, hp: 120, structureType: 'wall', category: 'Walls & Floors', passable: { colonist: false, animal: false, enemy: false }, breakable: true, research: 'void_architecture' },
    void_door:         { char: '▒', color: '#7733bb', cost: { stone: 3, planks: 2, void_essence: 4 }, work: 20, hp: 80, structureType: 'door', category: 'Walls & Floors', passable: { colonist: true, animal: false, enemy: false }, breakable: true, research: 'void_architecture' },

    // === Furniture (grouped by niche) ===
    // Room essentials
    bed:               { char: 'B', color: '#8855aa', cost: { wood: 5 }, work: 25, structureType: 'furniture', category: 'Furniture' },
    town_hall_banner:  { char: 'Ξ', color: '#ddbb44', cost: { planks: 6, wood: 4 }, work: 30, structureType: 'furniture', category: 'Furniture', townHall: true, roomQuality: 6, decorRooms: ['townhall'] },
    rug:               { char: '~', color: '#cc6644', bg: '#4a2211', cost: { leather: 2 }, work: 10, structureType: 'furniture', category: 'Furniture', roomQuality: 5, noShadow: true },
    // Lighting & warmth
    candle:            { char: 'i', color: '#ffcc00', cost: { wood: 1 }, work: 4, structureType: 'furniture', category: 'Furniture', dragPlace: true, lightRadius: 5, candleEmitter: true, noShadow: true },
    campfire:          { char: '≈', color: '#ff8833', cost: { wood: 3 }, work: 10, structureType: 'furniture', category: 'Furniture', lightRadius: 3, warmRadius: 3, smokeEmitter: true, noShadow: true },
    glowstone:         { char: 'L', color: '#ffff88', cost: { planks: 2, stone: 1 }, work: 14, structureType: 'furniture', category: 'Furniture', lightRadius: 14, research: 'luminance', power: { consumes: 0.5 } },
    // Food preservation
    food_chest:        { char: 'S', color: '#997744', cost: { planks: 4, stone: 2 }, work: 25, structureType: 'furniture', category: 'Furniture', maxCount: 4 },
    ice_box:           { char: 'I', color: '#88ccff', cost: { runite: 2, stone: 4, planks: 2, void_essence: 2 }, work: 40, structureType: 'furniture', category: 'Furniture', research: 'alchemy', power: { consumes: 1 }, maxCount: 1 },
    // Seating
    chair:             { char: 'h', color: '#aa7744', cost: { planks: 2 }, work: 8, structureType: 'furniture', category: 'Furniture', roomQuality: 4, decorRooms: ['bedroom', 'townhall'], workshopBonus: 3, furnitureType: 'seating' },
    stool:             { char: 'π', color: '#b08850', cost: { planks: 1 }, work: 5, structureType: 'furniture', category: 'Furniture', roomQuality: 2, decorRooms: ['bedroom', 'townhall'], workshopBonus: 3, furnitureType: 'seating' },
    bench:             { char: '╦', color: '#9a7040', cost: { planks: 3 }, work: 12, structureType: 'furniture', category: 'Furniture', roomQuality: 4, decorRooms: ['townhall'], furnitureType: 'seating' },
    armchair:          { char: 'ĥ', color: '#b85c4a', cost: { planks: 3, leather: 2 }, work: 20, structureType: 'furniture', category: 'Furniture', roomQuality: 7, decorRooms: ['bedroom', 'townhall'], furnitureType: 'seating' },
    // Table / Desk
    table:             { char: '╤', color: '#a87840', cost: { planks: 3, wood: 3 }, work: 16, structureType: 'furniture', category: 'Furniture', roomQuality: 6, decorRooms: ['bedroom', 'townhall'], workshopBonus: 4, furnitureType: 'surface' },
    nightstand:        { char: 'n', color: '#a0784a', cost: { planks: 2 }, work: 10, structureType: 'furniture', category: 'Furniture', roomQuality: 5, decorRooms: ['bedroom'], furnitureType: 'surface' },
    desk:              { char: '╓', color: '#8f6a3c', cost: { planks: 4 }, work: 18, structureType: 'furniture', category: 'Furniture', roomQuality: 6, decorRooms: ['bedroom'], workshopBonus: 5, furnitureType: 'surface' },
    // Storage
    shelf:             { char: '=', color: '#996633', cost: { planks: 3 }, work: 12, structureType: 'furniture', category: 'Furniture', roomQuality: 5, decorRooms: ['bedroom', 'townhall'], furnitureType: 'storage' },
    bookcase:          { char: '║', color: '#775533', cost: { planks: 4, leather: 1 }, work: 18, structureType: 'furniture', category: 'Furniture', roomQuality: 7, decorRooms: ['bedroom', 'townhall'], furnitureType: 'storage' },
    wardrobe:          { char: '▯', color: '#7d5a36', cost: { planks: 5 }, work: 22, structureType: 'furniture', category: 'Furniture', roomQuality: 7, decorRooms: ['bedroom'], furnitureType: 'storage' },
    material_shelf:    { char: '╡', color: '#997755', cost: { planks: 4 }, work: 12, structureType: 'furniture', category: 'Furniture', workshopBonus: 8, furnitureType: 'storage' },
    crate:             { char: '⊠', color: '#a08050', cost: { wood: 3 }, work: 8, structureType: 'furniture', category: 'Furniture', workshopBonus: 5, furnitureType: 'storage' },
    // Tools
    tool_rack:         { char: '╥', color: '#886644', cost: { planks: 3, iron: 1 }, work: 15, structureType: 'furniture', category: 'Furniture', workshopBonus: 10, furnitureType: 'tools' },
    weapon_rack:       { char: '╫', color: '#9a9aa8', cost: { planks: 3, iron: 1 }, work: 16, structureType: 'furniture', category: 'Furniture', roomQuality: 4, decorRooms: ['townhall'], workshopBonus: 8, furnitureType: 'tools' },
    grindstone:        { char: '⊚', color: '#a8a090', cost: { stone: 4, planks: 2 }, work: 20, structureType: 'furniture', category: 'Furniture', workshopBonus: 9, furnitureType: 'tools' },
    // Centerpiece
    podium:            { char: 'Π', color: '#c9a24a', cost: { planks: 4, wood: 2 }, work: 18, structureType: 'furniture', category: 'Furniture', roomQuality: 8, decorRooms: ['townhall'], furnitureType: 'centerpiece' },
    statue:            { char: '♜', color: '#c8c8c0', cost: { stone: 8 }, work: 35, structureType: 'furniture', category: 'Furniture', roomQuality: 10, decorRooms: ['townhall'], furnitureType: 'centerpiece' },
    war_table:         { char: '╧', color: '#b89a5a', cost: { planks: 4, leather: 1 }, work: 22, structureType: 'furniture', category: 'Furniture', roomQuality: 8, decorRooms: ['townhall'], furnitureType: 'centerpiece' },
    // Misc decor
    potted_plant:      { char: '¶', color: '#5fae4a', cost: { stone: 1, wood: 1 }, work: 6, structureType: 'furniture', category: 'Furniture', roomQuality: 3, workshopBonus: 2, furnitureType: 'misc' },
    personal_chest:    { char: '▤', color: '#a87a44', cost: { planks: 3 }, work: 14, structureType: 'furniture', category: 'Furniture', roomQuality: 4, decorRooms: ['bedroom'], furnitureType: 'misc' },

    // === Production (ordered by progression) ===
    workbench:         { char: 'C', color: '#bb8833', cost: { wood: 5, stone: 2 }, work: 30, structureType: 'furniture', category: 'Production' },
    cooking_pot:       { char: 'F', color: '#ff6633', cost: { stone: 3, wood: 1 }, work: 18, structureType: 'furniture', category: 'Production', smokeEmitter: true },
    research_desk:     { char: 'R', color: '#44aaff', cost: { wood: 5, stone: 3, planks: 2 }, work: 40, structureType: 'furniture', category: 'Production' },
    anvil:             { char: '⌂', color: '#999999', cost: { stone: 6, bricks: 2, planks: 2 }, work: 30, structureType: 'furniture', category: 'Production', research: 'metalworking', smokeEmitter: true, workGlowColor: '#ff8833' },
    alchemy_table:     { char: '⚗', color: '#44cc88', cost: { planks: 4, stone: 2 }, work: 25, structureType: 'furniture', category: 'Production', research: 'alchemy' },
    beast_circle:      { char: 'A', color: '#9cf642', cost: { wood: 6 }, work: 28, structureType: 'furniture', category: 'Production', research: 'beast_binding' },
    enchanting_table:  { char: 'P', color: '#bb88ff', cost: { planks: 4, stone: 3 }, work: 35, structureType: 'furniture', category: 'Production', research: 'arcane_infusion', power: { consumes: 4, speedMult: 1.5 } },
    scriptorium:       { char: '𝕊', color: '#4488cc', cost: { planks: 6, stone: 3, leather: 2 }, work: 40, structureType: 'furniture', category: 'Production', research: 'arcane_studies' },
    loom:              { char: 'Ł', color: '#ddaa66', cost: { planks: 4, wood: 3 }, work: 30, structureType: 'furniture', category: 'Production', research: 'textiles' },
    golem_forge:       { char: 'Ğ', color: '#cc8833', cost: { stone: 8, runite: 4, planks: 4 }, work: 50, structureType: 'furniture', category: 'Production', research: 'golem_craft' },

    // === Defense (ordered by progression) ===
    arcane_sentinel:   { char: 'X', color: '#ff4444', cost: { stone: 5, planks: 3 }, work: 50, structureType: 'furniture', category: 'Defense', passable: { colonist: false, animal: false, enemy: false }, research: 'warding', power: { consumes: 3, damage: 12, range: 4, attackCooldown: 3 } },
    void_nexus:        { char: 'V', color: '#9933ff', cost: { runite: 5, stone: 6, planks: 4 }, work: 60, structureType: 'furniture', category: 'Defense', passable: { colonist: false, animal: false, enemy: false }, research: 'void_summoning', maxCount: 1 },
    void_turret:       { char: 'Y', color: '#aa33ff', cost: { stone: 5, planks: 3, void_essence: 6 }, work: 55, structureType: 'furniture', category: 'Defense', passable: { colonist: false, animal: false, enemy: false }, research: 'void_forging', power: { consumes: 5, damage: 28, range: 5, attackCooldown: 5, armorPierce: 0.15 } },
    inferno_ward:      { char: 'Ħ', color: '#ff4400', cost: { stone: 5, runite: 3, planks: 2 }, work: 40, structureType: 'furniture', category: 'Defense', research: 'pyroclasm', power: { consumes: 5, warmRadius: 4, damage: 8, attackCooldown: 2 } },

    // === Arcane (ordered by progression) ===
    mana_crystal:      { char: 'W', color: '#aa44ff', cost: { wood: 8, stone: 4 }, work: 45, structureType: 'furniture', category: 'Arcane', passable: { colonist: false, animal: false, enemy: false }, research: 'ley_channeling', maxCount: 4, maxCountBonusKey: 'manaCrystalBonus', power: { generates: 6 } },
    ember_heater:      { char: 'H', color: '#ff8844', cost: { stone: 4, planks: 2 }, work: 28, structureType: 'furniture', category: 'Arcane', research: 'ember_magic', power: { consumes: 1, warmRadius: 10, seasonalHeat: true } },
    mana_relay:        { char: '⊛', color: '#aa88ff', cost: { planks: 3, runite: 2 }, work: 25, structureType: 'furniture', category: 'Arcane', research: 'arcane_conduits', power: { consumes: 1, radius: 3 } },
    artifact_pedestal: { char: '◆', color: '#ccaa44', cost: { stone: 8, runite: 2 }, work: 35, structureType: 'furniture', category: 'Arcane', research: 'arcane_infusion' },
    trade_rift:        { char: '⇄', color: '#66ccaa', cost: { runite: 3, stone: 6, planks: 4 }, work: 45, structureType: 'furniture', category: 'Arcane', passable: { colonist: false, animal: false, enemy: false }, research: 'trade_routes', maxCount: 1, power: { consumes: 3 } },
    beacon:            { char: '☀', color: '#ffffaa', cost: { stone: 4, runite: 3, planks: 2 }, work: 35, structureType: 'furniture', category: 'Arcane', lightRadius: 24, research: 'brilliance', power: { consumes: 1 } },
    ritual_chalk:      { char: '◌', color: '#cc99ff', bg: '#2a1a3a', cost: { void_essence: 1 }, work: 8, structureType: 'furniture', category: 'Arcane', dragPlace: true, noShadow: true, research: 'ritual_magic' },
    arcane_core:       { char: '◎', color: '#aa66ff', cost: {}, work: 0, structureType: 'furniture', category: 'Arcane', noBuild: true, indestructible: true },
    ancient_chest:     { char: '▣', color: '#d4a84a', bg: '#1c1608', cost: {}, work: 0, structureType: 'furniture', category: 'Arcane', noBuild: true, indestructible: true },
    ancient_chest_open: { char: '▢', color: '#7a6a44', bg: '#1c1608', cost: {}, work: 0, structureType: 'furniture', category: 'Arcane', noBuild: true, indestructible: true },
    warded_wall:       { char: '▦', color: '#9d7fe0', bg: '#1a1428', cost: {}, work: 0, hp: 500, structureType: 'wall', category: 'Arcane', passable: { colonist: false, animal: false, enemy: false }, noBuild: true, indestructible: true },
    rift_anchor:       { char: '✧', color: '#66c8ff', bg: '#0c1822', cost: {}, work: 0, structureType: 'furniture', category: 'Arcane', noBuild: true, indestructible: true },
    rift_anchor_active: { char: '✦', color: '#aaf0ff', bg: '#0c1822', cost: {}, work: 0, structureType: 'furniture', category: 'Arcane', noBuild: true, indestructible: true },
    // === Plants (worldgen decoration) ===
    // Spawned by generatePlants, never built. Walkable, built over or deconstructed
    // like any structure. `plant.sway` picks the wind profile: 'grass' flutters,
    // 'stiff' flutters at reduced amplitude (rigid plants like cacti), 'shrub'
    // leans with gusts, 'none' stays still.
    wildflowers:       { char: '✿', color: '#e8a0d0', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['grassland'], terrain: ['grass'], density: 0.030, sway: 'grass' } },
    tall_grass:        { char: 'ʬ', color: '#8cc45a', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['grassland'], terrain: ['grass'], density: 0.035, sway: 'grass' } },
    clover_patch:      { char: '♣', color: '#5fae4a', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['grassland'], terrain: ['grass'], density: 0.020, sway: 'grass' } },
    meadow_shrub:      { char: '♠', color: '#4f8f3a', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['grassland'], terrain: ['grass', 'dirt'], density: 0.012, sway: 'shrub' } },
    fern:              { char: 'ψ', color: '#4fa84a', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['forest'], terrain: ['forest_grass'], density: 0.040, sway: 'grass' } },
    mushroom_cluster:  { char: '♦', color: '#c8885a', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['forest'], terrain: ['forest_grass', 'dirt'], density: 0.015, sway: 'grass' } },
    bramble:           { char: '♠', color: '#5a7a3a', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['forest'], terrain: ['forest_grass'], density: 0.018, sway: 'shrub' } },
    bluebells:         { char: '✿', color: '#7a8cf0', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['forest'], terrain: ['forest_grass'], density: 0.020, sway: 'grass' } },
    edelweiss:         { char: '✿', color: '#eeeedd', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['mountain'], terrain: ['gravel'], density: 0.015, sway: 'grass' } },
    thistle:           { char: 'ψ', color: '#a070c0', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['mountain'], terrain: ['gravel', 'rock'], density: 0.015, sway: 'grass' } },
    juniper_scrub:     { char: '♠', color: '#3f6a4a', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['mountain'], terrain: ['gravel'], density: 0.012, sway: 'shrub' } },
    lichen_patch:      { char: ':', color: '#b0b878', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['mountain'], terrain: ['rock', 'gravel'], density: 0.020, sway: 'none' } },
    reeds:             { char: 'ǁ', color: '#a0b060', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['swamp'], terrain: ['swamp_grass', 'mud'], density: 0.090, sway: 'grass', nearWater: true } },
    cattails:          { char: 'ǀ', color: '#8a6a3a', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['swamp'], terrain: ['swamp_grass', 'mud'], density: 0.070, sway: 'grass', nearWater: true } },
    marsh_fern:        { char: 'ψ', color: '#5a9a4a', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['swamp'], terrain: ['swamp_grass'], density: 0.030, sway: 'grass' } },
    bog_mushrooms:     { char: '♦', color: '#b0a070', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['swamp'], terrain: ['swamp_grass', 'mud'], density: 0.015, sway: 'grass' } },
    saguaro:           { char: '¥', color: '#4a9a5a', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['desert'], terrain: ['sand'], density: 0.010, sway: 'stiff' } },
    prickly_pear:      { char: '♣', color: '#6aaa5a', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['desert'], terrain: ['sand', 'gravel'], density: 0.012, sway: 'stiff' } },
    dry_shrub:         { char: '*', color: '#a08a5a', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['desert'], terrain: ['sand', 'gravel'], density: 0.015, sway: 'shrub' } },
    desert_marigold:   { char: '✿', color: '#f0c840', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['desert'], terrain: ['sand'], density: 0.010, sway: 'grass' } },
    frost_shrub:       { char: '♠', color: '#8aa8b8', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['tundra'], terrain: ['snow_ground', 'gravel'], density: 0.015, sway: 'shrub' } },
    arctic_moss:       { char: ':', color: '#7a9a8a', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['tundra'], terrain: ['snow_ground', 'rock', 'gravel'], density: 0.025, sway: 'none' } },
    snowbell:          { char: '✿', color: '#d8e8ff', cost: {}, work: 2, structureType: 'plant', category: 'Nature', noBuild: true, showGround: true, noShadow: true, plant: { biomes: ['tundra'], terrain: ['snow_ground'], density: 0.012, sway: 'grass' } },
    gathering_circle:  { char: '◎', color: '#33ccff', cost: { wood: 4, stone: 3 }, work: 30, structureType: 'furniture', category: 'Arcane', maxCount: 1 },
    rift_gate:         { legacy: true, char: 'Ω', color: '#33ccff', cost: { runite: 4, stone: 6, planks: 4, void_essence: 8 }, work: 60, structureType: 'furniture', category: 'Arcane', passable: { colonist: false, animal: false, enemy: false }, research: 'planar_rift', maxCount: 1 },
};
stampLoc(BUILDINGS, 'building');

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
// Structures the player can neither place nor remove (e.g. the Arcane Core, which only
// exists in pre-generated ruins). Guards deconstruction and replacement.
export const INDESTRUCTIBLE_STRUCTURES = new Set(
    Object.entries(BUILDINGS).filter(([, b]) => b.indestructible).map(([k]) => k)
);
export const BREAKABLE_STRUCTURES = new Set(
    Object.entries(BUILDINGS).filter(([, b]) => b.breakable).map(([k]) => k)
);
export const WALL_STRUCTURES = new Set(
    Object.entries(BUILDINGS).filter(([, b]) => b.structureType === 'wall').map(([k]) => k)
);
export const FURNITURE_STRUCTURES = new Set(
    Object.entries(BUILDINGS).filter(([, b]) => b.structureType === 'furniture').map(([k]) => k)
);
// Decorative worldgen plants: walkable, cleared by floors and farm zones, and
// excluded from the furniture path penalty.
export const PLANT_STRUCTURES = new Set(
    Object.entries(BUILDINGS).filter(([, b]) => b.structureType === 'plant').map(([k]) => k)
);
export const DOOR_STRUCTURES = new Set(
    Object.entries(BUILDINGS).filter(([, b]) => b.structureType === 'door').map(([k]) => k)
);
export const DRAG_BUILD_TYPES = new Set(
    Object.entries(BUILDINGS).filter(([, b]) => b.structureType === 'wall' || b.structureType === 'floor' || b.structureType === 'door' || b.dragPlace).map(([k]) => k)
);

export const COMPLEX_STRUCTURES = {
    great_forge: {
        research: 'masterwork',
        coreBuild: 'arcane_core',
        layout: [
            { dx: -1, dy: -1, req: 'ritual_chalk' }, { dx: 0, dy: -1, req: 'ritual_chalk' }, { dx: 1, dy: -1, req: 'ritual_chalk' },
            { dx: -1, dy: 0, req: 'ritual_chalk' },  { dx: 1, dy: 0, req: 'ritual_chalk' },
            { dx: -1, dy: 1, req: 'ritual_chalk' },  { dx: 0, dy: 1, req: 'ritual_chalk' },  { dx: 1, dy: 1, req: 'ritual_chalk' },
        ],
        effect: { craftSpeedMult: 2.5, qualityBonus: 2 },
        activeLightRadius: 4,
    },
    ritual_circle: {
        research: 'advanced_arcana',
        coreBuild: 'arcane_core',
        layout: [
            { dx: 0, dy: -2, req: 'ritual_chalk' },
            { dx: -1, dy: -1, req: 'ritual_chalk' }, { dx: 1, dy: -1, req: 'ritual_chalk' },
            { dx: -2, dy: 0, req: 'ritual_chalk' }, { dx: 2, dy: 0, req: 'ritual_chalk' },
            { dx: -1, dy: 1, req: 'ritual_chalk' }, { dx: 1, dy: 1, req: 'ritual_chalk' },
            { dx: 0, dy: 2, req: 'ritual_chalk' },
        ],
        effect: { spellCooldownMult: 0.7 },
        activeLightRadius: 4,
    },
    anvil_shrine: {
        coreBuild: 'arcane_core',
        layout: [
            { dx: -1, dy: -1, req: 'ritual_chalk' }, { dx: 0, dy: -1, req: 'ritual_chalk' }, { dx: 1, dy: -1, req: 'ritual_chalk' },
            { dx: 0, dy: 1, req: 'ritual_chalk' },
        ],
        effect: { gatherSpeedMult: 1.5 },
        activeLightRadius: 3,
    },
    star_ward: {
        research: 'fortification',
        coreBuild: 'arcane_core',
        layout: [
            { dx: 0, dy: -2, req: 'ritual_chalk' },
            { dx: -2, dy: 0, req: 'ritual_chalk' }, { dx: 2, dy: 0, req: 'ritual_chalk' },
            { dx: 0, dy: 2, req: 'ritual_chalk' },
        ],
        effect: { defenseBonusMult: 1.3 },
        activeLightRadius: 3,
    },
    harvest_sigil: {
        research: 'verdant_growth',
        coreBuild: 'arcane_core',
        layout: [
            { dx: 1, dy: 0, req: 'ritual_chalk' }, { dx: 2, dy: 0, req: 'ritual_chalk' }, { dx: 3, dy: 0, req: 'ritual_chalk' },
            { dx: 3, dy: -1, req: 'ritual_chalk' },
            { dx: 3, dy: 1, req: 'ritual_chalk' },
        ],
        effect: { foodProductionMult: 1.5 },
        activeLightRadius: 3,
    },
    watchers_eye: {
        research: 'planar_rift',
        coreBuild: 'arcane_core',
        layout: [
            { dx: 0, dy: -1, req: 'ritual_chalk' },
            { dx: 0, dy: 1, req: 'ritual_chalk' },
        ],
        effect: { expeditionLuckMult: 1.4 },
        activeLightRadius: 3,
    },
    scholars_ring: {
        research: 'arcane_studies',
        coreBuild: 'arcane_core',
        layout: [
            { dx: 0, dy: -1, req: 'ritual_chalk' },
            { dx: -1, dy: 0, req: 'ritual_chalk' }, { dx: 1, dy: 0, req: 'ritual_chalk' },
            { dx: 0, dy: 1, req: 'ritual_chalk' },
        ],
        effect: { researchSpeedMult: 1.5 },
        activeLightRadius: 3,
    },
    grand_ritual: {
        research: 'advanced_arcana',
        coreBuild: 'arcane_core',
        // Diagonal X at distance 2 (the four far corners of a 5x5). Distinct from
        // every passive pattern so it can't collide with them.
        layout: [
            { dx: -2, dy: -2, req: 'ritual_chalk' }, { dx: 2, dy: -2, req: 'ritual_chalk' },
            { dx: -1, dy: -1, req: 'ritual_chalk' }, { dx: 1, dy: -1, req: 'ritual_chalk' },
            { dx: -1, dy: 1, req: 'ritual_chalk' }, { dx: 1, dy: 1, req: 'ritual_chalk' },
            { dx: -2, dy: 2, req: 'ritual_chalk' }, { dx: 2, dy: 2, req: 'ritual_chalk' },
        ],
        effect: { ritualAltar: true },
        activeLightRadius: 4,
    },
};
stampLoc(COMPLEX_STRUCTURES, 'complex_structure');
