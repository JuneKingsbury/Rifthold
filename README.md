# Arcanum: Rifts & Ruins
A Browser-Based Arcane Colony Management Sim

## About

Arcanum is a colony management game inspired by Rimworld and Dwarf Fortress. Manage colonists, build defenses, research arcane technologies, and defend your settlement against waves of void creatures. The game comes with a classic ASCII renderer and supports custom pixel-art skins that can be created in the built-in Skin Editor.

---

## Getting Started

When you start a new game, you'll have a handful of colonists and basic resources on a procedurally generated map. Your first priorities should be:

1. **Gather resources** - Designate trees for chopping (G mode) and rocks for mining.
2. **Build shelter** - Use Build mode (B) to create walls and doors. Enclosed rooms with beds give mood bonuses.
3. **Plant crops** - Use Farm Zone mode (Z) to designate fields. Wheat and berries are reliable starter crops.
4. **Set up cooking** - Build a Cauldron and cook raw food into meals for mood bonuses.
5. **Start production** - Build a Workbench to start crafting new materials, weapons, and tools.
6. **Research** - Build a research desk and assign colonists to study. Research unlocks the rest of the game.

Use the in-game Glossary (accessible from Settings) for quick reference. Beds auto-assign to new colonists and newly built beds find the nearest homeless colonist automatically.

---

## Your Colonists

Each colonist is an individual with skills, needs, traits, and moods that shape how they contribute to the colony.

### Skills & Priorities
Colonists have skills in Building, Farming, Crafting, Cooking, Animals, Research, and six Magic schools. Set task priorities (1-5, 0 = disabled) to control what each colonist works on. Lower numbers mean higher priority. Use "Copy Priorities From..." to quickly replicate setups.

### Needs & Mood
Hunger and Rest decay over time. When critical (<20), colonists interrupt work to eat or sleep. Mood is calculated as Base 50 + active thoughts, and it directly affects productivity:

| Mood Level | Range | Work Speed |
|---|---|---|
| Inspired | 75+ | 1.2x |
| Content | 40-74 | 1.0x |
| Stressed | 20-39 | 0.7x |
| Breaking | <20 | Refuses work |

Thoughts are temporary modifiers from events - good meals, nice rooms, and deaths all leave impressions that fade over time.

### Traits
Each colonist spawns with permanent traits: Hard Worker, Lazy, Night Owl, Early Bird, Green Thumb, Iron Stomach, Socialite, Loner, Optimist, Pessimist, Tough, Sturdy, Brave, Quick, Light Sleeper, Deep Sleeper, Creative, Scholar, Gluttonous, Gourmand, Lucky, Pyromaniac, Pacifist, Prodigy, or Magically Gifted. These subtly alter behavior and mood.

### Controlling Colonists
- **Drafting** - Take direct control. Drafted colonists move where you right-click. Select multiple with click-drag and use Draft All for quick combat response. They pulse red on the map.
- **Rally Point** - Right-click with multiple drafted colonists to send them in spread formation. A red flag (⚑) marks the spot.
- **Guard Mode** - A middle ground between full automation and drafting. Toggle the Guard button to make a colonist patrol their current position and proactively engage threats within 10 tiles. They still eat and sleep when critical, but skip all work tasks. No ongoing player input needed.
- **Fleeing** - Colonists automatically disengage from combat when HP drops below 20, retreating until the threat is 8+ tiles away.

### Equipment
Colonists have 5 gear slots, displayed in a person-shaped grid:

- **Melee Weapon** - Determines melee damage. Progression: Stone Spear (8) → Wooden Club (10) → Iron Sword (14) → Etched Axe (15) → Etched Mace (17) → Enchanted Glaive (18, +25% spell dmg) → Void Dagger (16 fast, +40% spell dmg) → Runic Blade (22) → Runic Greatsword (45 slow) → Void Blade (52 slow).
- **Ranged Weapon** - Bows and crossbows fire projectiles at enemies from a distance. Colonists stay at range instead of closing to melee. Short Bow (7 dmg, range 5) → Hunting Bow (10, range 6) → Iron Crossbow (22, range 7 slow) → Runic Crossbow (30, range 8 slow) → Void Longbow (24, range 10).
- **Magic Weapon** - Wands and staves provide spell amplification and attack at range. Wooden Wand (range 5, +20% spell dmg), Crystal Staff (range 6, +35%), Runic Wand (range 7, +50%), Void Staff (range 8, +65%). Best for dedicated spellcasters.
- **Armor** - Reduces incoming damage. Progression: Iron Brigandine (8% DR) → Leather Vest (10%) → Enchanted Tunic (12%, +10% spell) → Iron Chainmail (16%) → Mana-Weave Robe (18%, +20% spell dmg) → Runic Plate (24%) → Void Armor (30%).
- **Helmet** - Separate headgear slot. DR stacks multiplicatively with body armor. Progression: Leather Cap (5%) → Iron Helmet (8%) → Runic Helm (14%) → Void Crown (18%, +15% spell dmg).
- **Tool** - Boosts work speed. 5 categories across 3 material tiers (Stone → Iron → Runic):
  - **Pickaxe** - Mining speed (1.25x / 1.45x / 1.7x)
  - **Axe** - Chopping speed (1.25x / 1.45x / 1.7x)
  - **Sickle** - Farming speed (1.25x / 1.45x / 1.7x)
  - **Hammer** - Crafting speed (1.25x / 1.45x / 1.7x)
  - **Mattock** - Mining + Chopping (1.15x / 1.3x / 1.5x) - multi-purpose but weaker than specialists
- **Artifact** - Special items with unique effects. Can be equipped for personal bonuses or placed on Artifact Pedestals for area-of-effect colony buffs. See the Artifacts section below.

### Equipment Stat Reference

Any of these stats can be placed on any equipment item in `config.js`. The runtime reads them generically from all equipped slots (weapon, armor, helmet, tool, artifact).

#### Combat Stats

| Stat | Type | Effect |
|---|---|---|
| `damage` | flat number | Melee attack damage. Weapon slot is base; other slots add bonus. |
| `damageReduction` | 0-1 fraction | Reduces incoming damage (multiplicative across all slots). |
| `critChance` | 0-1 fraction | Chance to deal double damage on hit. |
| `dodgeChance` | 0-1 fraction | Chance to completely avoid incoming damage. |
| `hpOnKill` | flat number | HP healed when killing an enemy. |
| `thornsDamage` | flat number | Flat damage reflected back to attacker when hit. |
| `spellDamageBonus` | 0-1 fraction | Additive bonus to spell damage multiplier (sums across all slots). |

#### Magic Stats

| Stat | Type | Effect |
|---|---|---|
| `manaRegen` | flat per-tick | Extra passive mana regeneration (added before state multipliers). |
| `spellCostReduction` | 0-1 fraction | % reduction in spell mana costs (min cost 1). |
| `tomeStudySpeed` | multiplier | Multiplier on tome learning progress per study cycle. |
| `researchSpeed` | multiplier | Multiplier on research points contributed per study cycle. |

#### Survival Stats

| Stat | Type | Effect |
|---|---|---|
| `maxHpBonus` | flat number | Extra max HP (recalculated on equip/unequip). |
| `moodBonus` | flat number | Passive mood boost (added to mood calculation). |
| `hungerReduction` | 0-1 fraction | Fraction slower hunger decay (0.3 = 30% slower). |
| `coldResistance` | 0-1 fraction | Chance to avoid the "freezing" thought in winter outdoors. |
| `moveSpeedBonus` | 0-1 fraction | Fraction faster movement (capped at 0.8 total). |
| `workSpeedBonus` | 0-1 fraction | Flat addition to work speed multiplier. |

#### Work Speed Stats

| Stat | Type | Effect |
|---|---|---|
| `miningSpeed` | multiplier | Mining task speed multiplier. |
| `choppingSpeed` | multiplier | Chopping task speed multiplier. |
| `farmingSpeed` | multiplier | Farming (plant/harvest) task speed multiplier. |
| `craftingSpeed` | multiplier | Crafting task speed multiplier. |
| `cookingSpeed` | multiplier | Cooking task speed multiplier. |
| `buildSpeed` | multiplier | Building/construction task speed multiplier. |

#### Artifact-Only Stats

These are specific to the artifact slot and use nested objects:

| Stat | Type | Effect |
|---|---|---|
| `pedestal: { radius, manaCost, ...effects }` | object | Area-of-effect when placed on a pedestal. |
| `combat: { targetPriority, autoReviveHp, damageReduction }` | object | Combat-specific effects (raids + waves). |
| `expedition: { lootMult, trapDamageMult, ... }` | object | Expedition-specific modifiers. |
| `durability: { max, breakOnUse }` | object | Item breaks after N triggers, needs anvil repair. |
| `consumable: true` | boolean | Destroyed after one use. |

#### Example: Adding a New Item

```javascript
// In ARMORS:
enchanted_cloak: { name: 'Enchanted Cloak', damageReduction: 0.12, spellDamageBonus: 0.1, coldResistance: 0.5 },

// In WEAPONS:
vampiric_blade: { name: 'Vampiric Blade', damage: 16, hpOnKill: 10, critChance: 0.15 },

// In TOOLS:
scholars_quill: { name: "Scholar's Quill", researchSpeed: 1.5, tomeStudySpeed: 1.3 },
```

#### Example: Adding a New Pedestal Effect (Area-of-Effect)

Pedestal effects apply when an artifact is placed on a mana pedestal. They affect colonists or tiles within their radius each tick. Here's how to add a hypothetical `cropGrowthMult` effect that speeds up crop growth for nearby farm tiles:

**Step 1: Define the artifact in `config.js`**

```javascript
// In ARTIFACTS:
verdant_heart: {
    name: 'Verdant Heart',
    farmingSpeed: 1.2,  // carried bonus (generic stat)
    pedestal: { radius: 4, manaCost: 1, cropGrowthMult: 1.5 },
    expedition: { lootMult: 1.1 },
},
```

The `pedestal` object defines the effect: `radius` (Manhattan distance), `manaCost` (per-tick mana drain), and any custom effect keys. Existing effects include `workSpeedBonus` (applied to colonists in range), `blightImmunity` (applied to crop tiles in range), and `wandererChanceMult` (global, `radius: 'global'`).

**Step 2: Handle the effect in `js/core/main.js` (pedestal update loop)**

Find the pedestal processing loop (search for `blightImmunity`). Add your tile-based effect alongside it:

```javascript
// After the blightImmunity block:
if (def.pedestal.cropGrowthMult) {
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (Math.abs(dx) + Math.abs(dy) > radius) continue;
            const ty = y + dy, tx = x + dx;
            if (ty < 0 || ty >= game.map.length || tx < 0 || tx >= game.map[0].length) continue;
            const cropTile = game.map[ty][tx];
            if (cropTile.crop) cropTile.cropGrowthMult = (cropTile.cropGrowthMult || 1) * def.pedestal.cropGrowthMult;
        }
    }
}
```

**Step 3: Consume the effect where relevant**

In the crop growth tick (wherever crops advance), multiply by the tile's bonus:

```javascript
const growthBonus = tile.cropGrowthMult || 1;
tile.crop.growth += baseGrowthRate * growthBonus;
```

Reset tile flags each tick (same as `blightImmune` is cleared/reapplied).

**Pattern summary:** Colonist-targeted effects (like `workSpeedBonus`) iterate colonists in radius. Tile-targeted effects (like `blightImmunity`, `cropGrowthMult`) iterate map tiles in radius. Global effects (like `wandererChanceMult`) use `radius: 'global'` and are read directly from the artifact definition without distance checks.

---

### Crafting Quality
When equipment is crafted, a quality roll occurs based on the crafter's skill level:

| Quality | Stat Multiplier | Name Prefix | Notes |
|---|---|---|---|
| Crude | 0.85x | "Crude" | More common at low skill |
| Normal | 1.00x | (none) | Default result |
| Fine | 1.10x | "Fine" | More common at high skill |
| Superior | 1.20x | "Superior" | Rare, requires high skill |

### Salvage
Click the ♻ icon on equipment in inventory to salvage it, recovering 50% of the recipe's crafting materials (rounded down, minimum 1 per resource type). Better than discarding - you always get something back.

Use "Auto-equip Best" to quickly gear up a colonist with the best available items from storage.

---

## Magic System

Magic is at the heart of Arcanum. Colonists learn spells, channel mana, and reshape the world.

### Learning Spells
Colonists learn spells by studying Spell Tomes at the research desk. Equip a tome, assign the colonist to research, and they'll make progress on it alongside generating study points. Progress persists if you unequip and re-equip the tome. Completing a tome consumes it and permanently grants that spell.

### Mana & Casting
Each colonist has a personal mana pool (base 20 + bonuses from magic skill levels across all schools). Spells consume mana and go on cooldown. Mana regenerates over time. You can disable auto-casting for specific spells to conserve mana.

### The Six Schools
- **Evocation** - Combat magic (Spark, Magic Missile, Fireball, Smite). Your primary offensive magic - ranged and melee burst.
- **Enchantment** - Work buffs (Quicken, Haste). Makes colonists faster and more productive.
- **Abjuration** - Defense and healing (Mend, Heal, Shield). Keeps your colony alive.
- **Conjuration** - Summoning and movement (Phase Step, Warp, Summon Familiar, Summon Ghost).
- **Transmutation** - Terrain manipulation (Nurture, Circle of Growth, Level Field). Reshape the map itself.
- **Divination** - Probability manipulation (Foresight, Fair Winds, Merchant's Omen, Ward of Calamity, Fortunate Discovery). Influence weather, events, and raid timing.

### Potions
Brewed at the Alchemy Table (requires Alchemy research) and auto-consumed by colonists:
- **Health Potion** - Auto-used when HP drops below 40%. Heals 50 HP. (3 berries + 1 wheat)
- **Speed Potion** - Auto-used when working. +50% move, +30% work for 100 ticks. (2 corn + 2 potatoes + 1 berries)

---

## Artifacts & Pedestals

Artifacts are powerful items with effects spanning combat, expeditions, and colony management. They can be used in multiple ways:

### Equipped Effects
Equip an artifact on a colonist for personal bonuses: Boots of Haste (+50% move speed), Hourglass of Diligence (+25% work speed), Cloak of Shadows (enemies avoid targeting you), or Aegis of the Vanguard (draw enemy fire + 30% damage reduction for a tank role).

### Artifact Pedestals
Build an Artifact Pedestal (requires Arcane Infusion research) and place an artifact on it to project effects in a radius. Each pedestal artifact has a mana cost (1-3) and a radius of effect displayed as a diamond highlight when selected.

| Artifact | Pedestal Effect | Radius | Mana |
|---|---|---|---|
| Seedkeeper's Locket | Crops immune to blight | 8 | 1 |
| Hourglass of Diligence | +15% work speed | 5 | 2 |
| Voidwalker's Lantern | Light source | 6 | 2 |
| Drum of Rallying | +15% damage | 8 | 3 |
| Tome of Shared Wisdom | +10% skill growth | 5 | 2 |
| Lodestone of Prosperity | +25% wanderer/trader chance | Global | 2 |
| Cornucopia Charm | +1 food per cook | Global | 1 |
| Haggler's Coin | -15% trade markup | Global | 1 |

### Combat & Expedition Effects
Some artifacts modify combat behavior (target priority, auto-revive, damage reduction) and expedition outcomes (loot multipliers, trap resistance, rare encounter chances). These apply when the artifact is equipped on a colonist.

### Durability & Repair
Certain artifacts (Ward of the Sentinel) break after triggering their effect. Broken artifacts provide no bonuses until repaired at an Anvil (requires Runeforging research, costs 1 runite). Colonists auto-queue repair tasks when broken artifacts are detected.

### Sources
- **Expeditions** - Dimension-specific rare drops (Compass of Greed from Crystal Caves, Cloak of Shadows from Shadow Realm, etc.). Map Fragments drop in all dimensions.
- **Traders** - Exclusive items like Seedkeeper's Locket, Hourglass of Diligence, Lodestone of Prosperity, and Haggler's Coin.
- **Crafting** - Ward of the Sentinel (Void Forging research).

---

## Building Your Colony

Press B to enter Build mode. Buildings are organized into 5 tabs (cycle with Tab/Shift+Tab):

### Walls & Floors
- **Wall** (█) - Blocks movement. 50-90 HP by material. Forms rooms when enclosing an area with doors.
- **Floor** (·) - Cosmetic. Wood, stone, or brick. Makes rooms nicer.
- **Door** (+) - Allows colonist passage. Blocks enemies. Room boundary.
- **Fence** (|) - Lighter wall alternative (20 HP).

### Furniture
- **Bed** (B) - Assign colonists for "slept in bed" mood bonus.
- **Torch** (i) - Light and warmth. Drag-placeable.

### Production
- **Workbench** (C) - Crafting station for weapons, tools, planks, bricks.
- **Cauldron** (F) - Cooking and potion brewing.
- **Food Chest** (S) - Each reduces food spoilage by 15% (stacks to 60%).
- **Anvil** (⌂) - Required for metalworking (iron weapons, armor, tools) and artifact repair.

### Defense
- **Void Wall** (▓) - 120 HP reinforced wall. Requires Void Architecture.
- **Void Door** (▒) - 80 HP reinforced door. Requires Void Architecture.
- **Void Turret** (Y) - 20 damage, range 5. Consumes 5 mana. Requires Void Forging.

### Arcane
- **Research Desk** (R) - Research station. Colonists study here to unlock the tech tree and progress spell tomes.
- **Beast Circle** (A) - Required for taming creatures.
- **Mana Crystal** (W) - Generates 8 mana for the leyline network. Limit 4 (increase with Crystal Capacitor).
- **Glowstone** (L) - Mana-powered light, radius 5. Consumes 2 mana.
- **Enchanting Table** (P) - 1.5x crafting speed. Consumes 4 mana.
- **Ember Ward** (H) - Warms radius 4 in winter. Consumes 3 mana.
- **Arcane Sentinel** (X) - Auto-attacks enemies in range 4. Consumes 3 mana.
- **Ice Box** (I) - Reduces food spoilage by 40% (stacks with chests, max 90%). Consumes 1 mana.
- **Rift Gate** (Ω) - Portal to alternate dimensions. Consumes 6 mana.
- **Artifact Pedestal** (◆) - Place an artifact for area-of-effect buffs. Mana cost varies (1-3).
- **Golem Forge** (Ğ) - Craft golems. Requires Golem Craft research.
- **Forge Core** (⚒) - Center of the Great Forge multi-block structure.
- **Ritual Core** (◎) - Center of the Ritual Circle multi-block structure.

### Rooms
Enclose an area with walls/fences and at least one door to form a room (max 100 tiles). Colonists sleeping in rooms get a mood bonus.

### Complex Structures (Multi-Block)
Late-game buildings that provide powerful bonuses when a specific pattern of tiles surrounds a core piece. Build the core from the Arcane tab, then assemble the pattern around it. Activation is automatic when complete - the core's info panel shows what's missing.

#### Great Forge
**Effect:** 2.5x equipment crafting speed for colonists working within 3 tiles.

```
 ███
 █⚒█    █ = Wall (any material)
 █+█    ⚒ = Forge Core (center)
            + = Door (exactly one side)
```

The Forge Core must be surrounded by walls on all sides except one, which must be a door. Any wall material works (wood, stone, brick, void). The door can be on any of the 4 sides.

#### Ritual Circle
**Effect:** Reduces spell cooldowns by 30% for all colonists within 6 tiles.

```
  █
 █ █
█ ◎ █   █ = Wall (any material)
 █ █    ◎ = Ritual Core (center)
  █
```

The Ritual Core must have walls placed in a diamond pattern at 8 positions: the 4 cardinal directions at distance 2, and the 4 diagonal directions at distance 1. The spaces between can be anything (floor, grass, empty).

---

## Farming & Food

### Setting Up Farms
Press Z to enter Farm Zone mode. Pick a crop, then drag over grass or dirt tiles. Colonists auto-plant and harvest.

| Crop | Seasons | Grow Time | Yield | Notes |
|---|---|---|---|---|
| Wheat | Spring/Summer/Autumn | 200 ticks | 3 | Reliable staple |
| Berries | Spring/Summer/Autumn | 150 ticks | 2 | Fast growing |
| Corn | Summer only | 250 ticks | 4 | High yield, seasonal |
| Potatoes | Spring/Autumn/Winter | 180 ticks | 3 | Hardy, grows in cold |
| Moonbloom | All seasons | 220 ticks | 2 | Requires Herbalism research |

Growth is boosted by rain (1.3x) and summer (1.5x). No outdoor growth in winter except potatoes and moonbloom.

### Food Preservation
All food rots over time. Faster-rotting items (milk, berries) decay first. Combat spoilage with:
- **Food Chests** - -15% each (max 60%)
- **Ice Boxes** - -40% each (max 90% combined with chests, requires mana)
- **Season** - Winter slows rot 0.5x; summer accelerates 1.5x

Use the lock icon in the Inventory to reserve specific foodstuffs from cooking (for alchemy recipes, etc.).

### Cooking
Build a Cauldron, then queue recipes in the Craft panel (C). Cooked meals give a mood bonus; raw food gives a penalty. Set an Auto-Cook target (use the +/- buttons) to keep food levels topped up automatically. Use x5 for bulk crafting, or toggle the ⟳ repeat button on any recipe to auto-queue it continuously. Set a stock target number to maintain a specific quantity - crafting stops when you have enough.

---

## Wildlife & Taming

### Wild Animals
- **Deer** (d) - Passive, flees. 3 meat + 2 hides when hunted.
- **Rabbit** (r) - Passive, fast. 1 meat.
- **Wolf** (w) - Hostile at night/winter. 2 meat + 1 hide. Tameable (dangerous).
- **Okapi** (O) - Passive. 5 meat + 3 hides when hunted. Pack animal when tamed.
- **Tapir** (t) - Passive. 4 meat + 2 hides when hunted. Happiness aura when tamed.
- **Chicken** (c) - Passive. Produces eggs when tamed.

Click an animal and press Hunt to create a hunting task. Medium and large animals drop hides, which can be tanned into leather for armor crafting.

### Beast Binding
Requires Beast Binding research + Beast Circle. Tamed animals fill different roles:
- **Production** - Chickens produce eggs over time.
- **Pack Animals** - Okapi speed up expeditions by 25% each.
- **Aura** - Tapirs boost mood for colonists within 4 tiles.
- **Guards** - Tamed wolves patrol near colonists and attack threats.

### Wolf Taming (Dangerous)
Wolves are a special case. The taming UI shows your success chance and warns about retaliation:
- **Base chance**: 40% + 6% per animal skill level (guaranteed at skill 10)
- **On failure**: The wolf bites for 12 damage and flees. Your colonist gets a mood penalty.
- **On success**: The wolf becomes a guard animal - following colonists, engaging hostiles in range, and retreating when HP is low.

---

## Combat & Defense

### How Combat Works
Combat is either melee (1-tile) or ranged (bows, crossbows, wands). Damage = base + weapon bonus. Colonists auto-defend when attacked and engage threats within their weapon's range. Ranged weapon holders fire projectiles and stay at distance; melee fighters close the gap. Colonists with Evocation spells (Spark, Magic Missile, Fireball, Smite) also attack automatically - Smite is a melee-range burst for close encounters.

### Raids
Raiders attack periodically (disabled in Peaceful Mode), scaling with both colony wealth and time elapsed. Early raids are gentle (1 raider after the first season), with full raid strength ramping up over 3 in-game years. This gives new colonies breathing room to establish defenses. Individual raiders flee when their HP drops below 15%. If 80% of the raiding party is dead or fleeing, the rest rout. A safety timeout ensures raiders eventually leave in stalemates.

### Wave Defense (Void Nexus)
Build a Void Nexus after researching Void Summoning, then click it to start a wave challenge. Each wave is harder (more enemies, more HP). Enemies pathfind to the nexus and will break through walls.

- **Nexus HP**: 200. If destroyed, rebuild it (wave progress is kept).
- **Colony Cap**: 3 + 1 per 2 waves completed (max 12). Complete waves to grow your colony. Hearth Shrine adds +2 to the base cap.
- **Strategy**: Funnel enemies with walls/doors, line the path with turrets, and station drafted colonists at chokepoints.

### Guard/Patrol Mode
For ongoing defense without micromanagement: assign colonists to Guard mode. They patrol within 6 tiles of their post and engage threats within 10 tiles, returning if they chase beyond 12 tiles. Unlike drafting, this persists across saves and requires no ongoing input.

---

## Golems

Golems are animated stone workers - tireless, moodless, and specialized. They never eat, sleep, or count against your population cap.

### Crafting Golems
Research Golem Craft, build a Golem Forge, then click it to see available types:

| Type | Specialty | Skill | HP | Cost |
|---|---|---|---|---|
| Farmer | Farming | 6 | 150 | 10 stone, 3 runite, 2 void essence |
| Builder | Building | 6 | 180 | 12 stone, 4 runite, 2 void essence |
| Crafter | Crafting | 6 | 160 | 11 stone, 3 runite, 2 void essence |
| Cook | Cooking | 6 | 140 | 9 stone, 2 runite, 1 void essence |
| Herder | Animals | 6 | 170 | 11 stone, 3 runite, 2 void essence |
| Scholar | Research | 6 | 130 | 8 stone, 2 runite, 2 void essence |
| Combat | Fighting | - | 250 | 15 stone, 5 runite, 4 void essence |

### Limitations
Golems cannot be drafted, cannot equip items or learn spells, and have fixed skills (only their specialty). They display as 'G' on the map. Combat golems auto-fight with 20 damage.

---

## Exploration (Alternate Dimensions)

Build a Rift Gate after researching Planar Rift to send expeditions to other dimensions. This is one of the richest parts of the game - you can watch your colonists' journey unfold in real-time through the expedition event log.

### Sending an Expedition
Click the Rift Gate, choose a dimension, select colonists (up to 5) and optional pack animals (up to 2), set a difficulty level, then launch. A party strength indicator (Easy/Fair/Tough/Dangerous/Suicidal) updates in real-time as you select members and adjust difficulty, helping you gauge survivability. The party walks to the gate and enters the dimension. While exploring, colonists are removed from your workforce.

### Difficulty Levels
Before launching, choose a difficulty from 1 (Normal) to 5 (Suicidal). Higher difficulty means tougher enemies, more encounters, and deadlier traps - but significantly more loot and dramatically higher chances for rare drops:

| Level | Name | Loot Bonus | Rare Finds | Enemy Scaling |
|---|---|---|---|---|
| 1 | Normal | - | - | Standard |
| 2 | Dangerous | +50% | +50% | +30% HP, +20% dmg |
| 3 | Perilous | +100% | +150% | +70% HP, +50% dmg |
| 4 | Deadly | +200% | +300% | +120% HP, +80% dmg |
| 5 | Suicidal | +300% | +500% | +200% HP, +120% dmg |

### The Live Event Log
Click the Rift Gate while an expedition is active to see a scrolling, color-coded log of everything happening to your party:
- **Blue** - Status updates (entering dimension, returning)
- **Orange** - Combat events (attacks, misses, round-by-round fighting)
- **Red** - Danger (traps triggered, colonists defeated)
- **Green** - Victories and successful returns
- **Yellow** - Loot discovered (items found, caches opened)
- **Grey** - Ambient observations (flavor text unique to each dimension)

The panel also shows each party member's current HP and enemy counts during combat.

### Combat Resolution
Unlike surface combat, expedition fights play out round-by-round over multiple ticks. Each round, your colonists swing at enemies (with a chance to miss) and enemies strike back. Equipped weapons and armor matter. You'll see individual hit messages like "Aldric strikes an enemy for 14 damage" or "An enemy lands a blow on Mira (8 dmg)."

### Between Encounters
As your party explores, small events occur randomly:
- **Traps** - Spike traps, arcane wards, poison needles. Deal damage to a random party member.
- **Discoveries** - Hidden caches, supply stashes, gems pried from walls. Bonus loot.
- **Ambient** - Flavor text specific to each dimension that brings the environment to life.
- **Rare Events** - Low-chance special encounters unique to each dimension with bonus loot rewards.

### Dimensions

| Dimension | Difficulty | Duration | Loot | Rare Encounters | Research |
|---|---|---|---|---|---|
| Crystal Caves | 1 | 220-380 | Stone, Runite | Resonating chambers, dwarven caches | - |
| Verdant Depths | 1 | 150-280 | Wood, Wheat, Berries | Fertile seed caches, druid herb stashes | - |
| Arcane Library | 2 | 180-320 | Spell Tomes, Runite | Headmaster vaults, enchanting caches | Arcane Studies |
| Shadow Realm | 3 | 400-650 | Void Essence, Runite | Collapsing void crystals, sealed reliquaries | Deep Delving |

Each dimension has unique ambient text, trap descriptions, discovery messages, and rare encounters that can only happen there.

### Pack Animals & Survival
Tamed okapi (max 2 per expedition) reduce expedition duration by 25% each (stacks, minimum 50% of base). They appear as a separate line behind the party in the expedition visualization. Defeated colonists return at 1 HP - there's no permadeath. If the entire party falls, you still keep any loot found during the exploration (random discoveries and encounters), but miss the completion bonus for finishing the expedition.

---

## Trading

When a Trade Caravan arrives, you can barter any of your resources for theirs through the trade panel.

### How Bartering Works
- The trader has a random inventory of resources and possibly a rare exclusive item.
- You sell resources at **80% of base value** (trader discount).
- You buy resources at **120% of base value** (trader markup).
- Your total offer value must meet or exceed what you're requesting.
- You can make **multiple trades** per visit - the trader stays until dismissed.

### Exclusive Items
Some items can only be obtained through trade:
- **Amulet of Fortune** - Artifact, +20% XP gain.
- **Enchanted Blade** - Weapon, 18 damage + 15% spell damage.
- **Wanderer's Cloak** - Armor, -15% damage + 20% move speed.
- **Seedkeeper's Locket** - Artifact, blight immunity radius (pedestal).
- **Hourglass of Diligence** - Artifact, work speed bonus (equipped/pedestal).
- **Lodestone of Prosperity** - Artifact, +25% wanderer/trader chance (global pedestal).
- **Haggler's Coin** - Artifact, -15% trade markup (global pedestal).
- **Crystal Capacitor** - Consumable. Permanently increases mana crystal build limit by 1. Also rarely found in Shadow Realm and Arcane Library expeditions.

---

## Research Tree

Build a Research Desk and assign colonists to study. Select one research topic at a time from the Research panel - all study points flow into it until complete, then you pick the next. You can deselect research to pause (progress is kept) and make tome study 2x faster. The Research button highlights gold when no topic is selected and techs remain available.

Research has diminishing returns from multiple desks: the first 2 desks contribute full research output, while additional desks produce at 50% efficiency.

Some advanced technologies have additional requirements beyond prerequisites:
- **Building prerequisites** - Certain buildings must exist (e.g., Ley Channeling requires an Anvil).
- **Milestone gates** - Achievements must be completed (e.g., Void tab techs require surviving a raid).
- **Tab breadth** - A minimum number of techs in the same tab must be completed before the deepest techs unlock.

| Research | Requires | Additional Gates | Unlocks |
|---|---|---|---|
| Runecraft | - | - | Etched Axe. Unlocks Runeforging & Warding |
| Stonework | - | - | Brick walls, floors |
| Druidcraft | - | - | Corn, Potatoes. Unlocks Beast Binding |
| Alchemy | Stonework | - | +2 bonus food per cooked meal |
| Ley Channeling | Runecraft + Stonework | Anvil built | Mana Crystal. Unlocks Luminance, Ember Magic, Arcane Infusion |
| Arcane Infusion | Ley Channeling + Alchemy | 2 Mana Crystals built | Enchanting Table |
| Runeforging | Runecraft | - | Runic Blade, Runic Pick, Runic Pickaxe, Runic Plate, Boots of Haste |
| Masterwork | Runeforging + Arcane Infusion + Artisan's Touch | Enchanting Table built, Superior item crafted, 3 tab techs | Runic Greatsword, Great Forge |
| Warding | Runecraft | - | Arcane Sentinel |
| Fortification | Warding + Stonework | - | Reinforced doors, faster wall repair |
| Void Summoning | Ley Channeling + Warding + Fortification | Arcane Sentinel built, raid survived | Void Nexus |
| Void Forging | Void Architecture + Runeforging | 3 tab techs | Void Blade, Void Armor, Void Turret, Void Crown |
| Golem Craft | Arcane Infusion + Void Forging + Mana Reservoir | Forge Core built, 3 items enchanted, 3 tab techs | Golem Forge, all golem types, Forge Core, Ritual Core |
| Planar Rift | Void Summoning + Arcane Infusion | Wave completed | Rift Gate |
| Deep Delving | Planar Rift | Rift Gate built, expedition completed, 3 tab techs | Shadow Realm dimension |

---

## Seasons & Weather

The year cycles through 4 seasons (2400 ticks each, about 8 minutes real-time at 1x speed).

| Season | Temperature | Crop Growth | Special |
|---|---|---|---|
| Spring | 10-20° | Normal | Animals appear |
| Summer | 20-35° | 1.5x | Heat waves, fire risk, faster rot |
| Autumn | 5-15° | 0.8x | Animal migrations |
| Winter | -10 to 5° | None (except potatoes) | Snow, need warmth |

**Weather events**: Rain (1.3x growth, extinguishes fires), Thunderstorm (can start fires), Blizzard (stops all growth, winter only).

---

## Mana & Leylines

Mana Crystals generate mana; arcane buildings consume it. If consumption exceeds generation, all mana-powered buildings shut off.

| Building | Mana Cost |
|---|---|
| Mana Crystal | +8 (generates) |
| Mana Relay | -1 |
| Ice Box | -1 |
| Artifact Pedestal | -1 to -3 (varies by artifact) |
| Glowstone | -2 |
| Arcane Sentinel | -3 |
| Ember Ward | -3 |
| Enchanting Table | -4 |
| Beacon | -4 |
| Inferno Ward | -5 |
| Void Turret | -5 |
| Rift Gate | -6 |

Plan your mana budget before expanding your arcane infrastructure.

---

## Events

Random events keep things interesting:

- **Wanderer** - A new colonist wants to join (more likely when mood is high). Accept or reject.
- **Trade Caravan** - A merchant arrives for bartering. See the Trading section above.
- **Crop Blight** - Destroys ~40% of growing crops. Summer/autumn.
- **Mineral Windfall** - New stone deposits appear at the map edge.
- **Fire** - Spreads to adjacent tiles. Colonists auto-extinguish. Rain helps.
- **Cold Snap** - All outdoor crops die instantly. Winter only.
- **Animal Migration** - Deer pass through (hunting opportunity).
- **Inspiration** - A random colonist gets +25 mood.

---

## The Map

### Terrain Types
- **.** Grass - Normal speed.
- **,** Dirt - Normal speed.
- **#** Rock - Slow (4x move cost). Can't build on it.
- **▲** Tall Rock - Impassable. Natural chokepoints.
- **~** Water - Slow (3x move cost). Can't build on it.

### Map Generation
Each map is procedurally generated with: dirt patches, rock formations (with stone/iron ore/runite deposits), mountain ranges (impassable spines), forests, a winding river, and ancient ruins (pre-built structures you can repair). Resource deposits spawn tiered: ~50% stone, ~30% iron ore, ~20% runite.

### Map Symbols Reference
```
.  Grass           ,  Dirt            #  Rock (slow)
▲  Tall Rock       ~  Water (slow)    T  Tree
o  Deposit (stone/iron/runite)  @  Colonist  G  Golem
R  Raider          E  Void Enemy      V  Void Nexus
▓  Void Wall       ▒  Void Door       Y  Void Turret
Ω  Rift Gate       S  Food Chest      I  Ice Box
◆  Artifact Pedestal  ⌂  Anvil        
Ğ  Golem Forge     ⚒  Forge Core      ◎  Ritual Core
⚑  Rally Point     *  Turret Beam
```

---

## Controls & Hotkeys

### Camera & Speed
| Key | Action |
|---|---|
| WASD / Arrows | Pan camera |
| +/= | Zoom in |
| - | Zoom out |
| Space | Pause / Unpause |
| < (Shift+,) | Speed down (min 1x) |
| > (Shift+.) | Speed up (max 5x) |

### Modes
| Key | Action |
|---|---|
| B | Build mode |
| Z | Farm Zone mode |
| G | Gather/Designate mode |
| Escape | Close panel / exit mode |

### Panels
| Key | Action |
|---|---|
| P | Priority panel |
| C | Craft panel |
| R | Research panel |
| I | Inventory panel |
| V | Arcane panel |
| J | Story panel |
| , | Settings panel |
| [ / ] | Cycle colonist selection |
| / | Reset minimap size |

### Mode-Specific
- **Build mode**: Tab/Shift+Tab to cycle categories, 1-9/0 to select items. X to toggle deconstruct mode.
- **Designate mode**: Tab to switch between Chop and Mine.
- **Zone mode**: 1-9 to select crop type.

### Mouse
- **Left-click** - Select colonist/animal/tile. Drag to box-select.
- **Right-click** - Move drafted colonists / set rally point.
- **Left-drag (build)** - Place structures in a line or area.
- **Right-drag (build)** - Deconstruct.
- **Middle-drag** - Pan camera.
- **Hover** - Tile tooltip with terrain and structure info.

---

## Interface

### Status Bar
The top bar shows colony resources and mana at a glance. Speed controls ([<] [||] [>]) and a Settings gear are always accessible on the right side.

### Inventory Panel (I)
Tabbed into four categories for easy navigation:
- **Resources** - Raw materials with quantities and food preservation info.
- **Equipment** - Weapons, armor, tools, and artifacts in storage. Each item shows an ASCII icon (or sprite if skin is active).
- **Consumables** - Potions, spell tomes, and usable items (Crystal Capacitor, etc.) with a Use button for one-time consumables.
- **Animals** - Tamed creatures and their roles.

### Glossary
Accessible from Settings during gameplay or from the start screen. Features:
- **Tabbed sections** matching this guide's topics for quick navigation.
- **Search bar** that filters across all sections - type "mana" to see every building, spell, and system that involves mana.

---

## Skins & Skin Editor

Arcanum supports visual skins that replace ASCII characters with pixel-art sprites. Switch skins at any time from the start screen settings or the in-game settings panel.

### How Skins Work
A skin is a collection of PNG sprites organized by category (buildings, terrain, resources, entities, floors, effects). The game looks for skins as `.skin.zip` files in the `skins/` folder - any ZIP placed there is automatically detected and appears in the dropdown.

When a skin is active, the renderer draws sprites instead of ASCII characters. Any object without a sprite gracefully falls back to its ASCII representation, so partial skins work fine.

### Colonist Variants
Skins can include multiple colonist sprites (`colonist_1.png`, `colonist_2.png`, etc.) for visual variety. Variants are assigned deterministically by colonist ID, so each colonist always looks the same. A small colored marker dot in the corner still distinguishes individuals sharing a variant.

### Using the Skin Editor
Launch from the start screen. The editor is a full pixel-art painting tool:

- **Canvas sizes** - 8x8 through 128x128 pixels
- **Tools** - Draw, Erase, Fill (flood-fill), Pick Color (eyedropper)
- **Transparency** - Erase to transparent; checkerboard background shows alpha. Transparent pixels let floors/terrain show through in-game.
- **Zoom/Pan** - Scroll wheel to zoom, middle-click drag to pan, +/-/0 keys
- **Undo/Redo** - Ctrl+Z / Ctrl+Y (up to 50 levels)
- **Copy/Paste** - Copy a sprite and paste it as a starting point for another object (C/V keys)
- **Object palette** - Browse all game objects by category; select one to paint its sprite
- **Colonist variants** - Add as many numbered variants as you want; remove with the ✕ button
- **Auto-save** - Work is saved to browser storage after every stroke; switching objects preserves progress

### Exporting & Importing
- **Export .zip** - Downloads your skin as a single `.skin.zip` file. Drop it in the `skins/` folder to use it.
- **Import .zip** - Load an existing `.skin.zip` into the editor to modify sprites and re-export.

### Skin File Structure
```
my_skin.skin.zip
├── manifest.json
├── buildings/
│   ├── wood_wall.png
│   ├── door.png
│   └── ...
├── terrain/
│   ├── grass.png
│   └── ...
├── entities/
│   ├── colonist.png
│   ├── colonist_1.png
│   ├── colonist_2.png
│   └── ...
├── resources/
├── floors/
└── effects/
    ├── fire.png
    ├── snow.png
    └── ...
```

The `manifest.json` lists which sprites are included so the game knows what to load.
