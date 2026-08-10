export const GLOSSARY = [
    {
        title: 'Colonists',
        entries: [
            ['Priorities', 'Each colonist has skill priorities (1-5, 0=disabled). Lower number = higher priority. Colonists pick tasks based on their priority settings.'],
            ['Needs', 'Hunger and Rest decay over time. When critical (<20), colonists interrupt work to eat or sleep.'],
            ['Mood', 'Base 50 + sum of active thoughts. Affects work speed:\n\n  Inspired  75+     1.2x work speed\n  Content   40-74   1.0x work speed\n  Stressed  20-39   0.7x work speed\n  Breaking  <20     Refuses work'],
            ['Thoughts', 'Temporary mood modifiers from events (good meals, nice rooms, deaths, etc.). Each has a duration before it fades.'],
            ['Traits', 'Permanent modifiers assigned at spawn: Hard Worker, Lazy, Night Owl, Early Bird, Green Thumb, Iron Stomach, Socialite, Loner, Optimist, Pessimist, Tough, Pyromaniac, Gourmand.'],
            ['Drafting', 'Manually control colonists. Drafted colonists ignore AI and move where you right-click. Select multiple with click-drag, then Draft All.'],
            ['Skills', 'Building, Farming, Crafting, Cooking, Animals, Research, and six Magic schools (Evocation, Enchantment, Abjuration, Conjuration, Transmutation, Divination). Higher skill = faster work completion (+12% per level). Skills level up by completing tasks (1 XP per task, scaling cost per level). Magic skills increase by studying tomes and casting spells.'],
            ['Equipment Slots', 'Weapon, Armor, Helmet, Tool, and Artifact. Displayed in a person-shaped grid. Use "Auto-equip Best" to quickly gear up a colonist with the best available items. Salvage unwanted equipment (♻) to recover 50% of crafting materials.'],
            ['Helmet Slot', 'Separate from body armor. Helmet DR stacks multiplicatively with armor DR.\n\n  Leather Cap     5% DR   (2 leather)\n  Iron Helmet     8% DR   (3 iron)\n  Runic Helm     14% DR   (2 runite, 1 iron, needs Runeforging)\n  Void Crown     18% DR + 15% spell dmg (4 void essence, 1 runite, needs Void Forging)'],
            ['Critical Alerts', 'Automatic warnings when colonists are near starvation (hunger < 30), mental break (mood 20-30), or freezing. Each alert fires once per episode — recovers at 40 before re-triggering.'],
            ['Auto-Assign Beds', 'Newly built beds auto-assign to the nearest homeless colonist. New colonists also claim the nearest free bed on arrival.'],
            ['Active Effects', 'Temporary buffs from potions (speed, healing) and magic spells (heal, haste, defense). Shown in colonist info with remaining duration. Colonists with active spell buffs pulse cyan on the map.'],
        ]
    },
    {
        title: 'Resources & Economy',
        subsections: [
            {
                subtitle: 'Resources',
                entries: [
                    ['Wood', 'Chop trees (T on map). Used in most buildings.'],
                    ['Stone', 'Mine stone deposits (o on map). Used in structures and crafting.'],
                    ['Iron Ore', 'Mine iron deposits (o, brown on map). Smelt into iron at the anvil. Found alongside stone in rock formations (~30% of deposits).'],
                    ['Iron', 'Smelted from iron ore. Mid-tier material for weapons, armor, and tools between stone and runite.'],
                    ['Runite', 'Rare magical ore found in rock clusters. Used for runic weapons and late-game equipment.'],
                    ['Hides', 'Dropped by medium+ animals when hunted (deer, wolf, cow, okapi, tapir). Tan into leather at the workbench.'],
                    ['Leather', 'Tanned from hides. Used for early/mid armor crafting (Leather Vest, Iron Chainmail lining).'],
                    ['Food', 'Consumed by colonists when hungry. Produced by cooking.'],
                    ['Meat', 'Dropped by hunted animals. Must be cooked.'],
                    ['Void Essence', 'Dropped by wave enemies. Used for void-tier crafting and buildings.'],
                    ['Global Stockpile', 'All resources are colony-wide. No physical hauling required.'],
                ]
            },
            {
                subtitle: 'Farming',
                entries: [
                    ['Farm Zone', 'Designate with Z mode. Select a crop type, drag an area on grass/dirt. Colonists auto-plant and harvest.'],
                    ['Crops', 'Plant in Farm Zone mode (Z). Growth affected by season and weather.\n\n  Crop       Seasons              Time  Yield  Research\n  Wheat      Spring/Summer/Autumn  200   3      —\n  Berries    Spring/Summer/Autumn  150   2      —\n  Corn       Summer only           250   4      Druidcraft\n  Potatoes   Spring/Autumn/Winter  180   3      Druidcraft\n  Moonbloom  All seasons           220   2      Herbalism\n\nRain = 1.3x growth. Summer = 1.5x. No outdoor growth in winter (except potatoes and moonbloom). Irrigation research allows all crops at 0.5x in winter.'],
                ]
            },
            {
                subtitle: 'Crafting & Cooking',
                entries: [
                    ['Planks', '2 wood → 3 planks. Used in beds, advanced buildings.'],
                    ['Bricks', '2 stone → 3 bricks.'],
                    ['Weapons', 'Melee: Stone Spear (8) → Wooden Club (10) → Iron Sword (14) → Etched Axe (15) → Etched Mace (17) → Enchanted Glaive (18, +25% spell) → Void Dagger (16 fast, +40% spell) → Runic Blade (22) → Runic Greatsword (45 slow) → Void Blade (52 slow).\n\nRanged: Short Bow (7, r5) → Hunting Bow (10, r6) → Iron Crossbow (22, r7 slow) → Runic Crossbow (30, r8 slow) → Void Longbow (24, r10).\n\nMagic: Wooden Wand (+20%) → Crystal Staff (+35%) → Runic Wand (+50%) → Void Staff (+65%). Equip from info panel.'],
                    ['Tools', '5 categories × 3 tiers (Stone → Iron → Runic):\n\n  Category   Bonus          Stone  Iron   Runic\n  Pickaxe    Mining speed   1.25x  1.45x  1.70x\n  Axe        Chopping speed 1.25x  1.45x  1.70x\n  Sickle     Farming speed  1.25x  1.45x  1.70x\n  Hammer     Crafting speed 1.25x  1.45x  1.70x\n  Mattock    Mine + Chop    1.15x  1.30x  1.50x\n\nMattocks are multi-purpose but weaker than specialists.'],
                    ['Crafting Quality', 'Equipment quality is rolled on crafting based on the crafter\'s skill level. Higher skill = better odds of Fine/Superior results.\n\n  Quality    Stat Mult  Chance (base → high skill)\n  Crude      0.85x      20% → rare\n  Normal     1.00x      60% (default)\n  Fine       1.10x      15% → common\n  Superior   1.20x      5% → possible'],
                    ['Salvage', 'Click ♻ on equipment in inventory to salvage it. Returns 50% of the recipe\'s input cost (rounded down, min 1 per resource). Items without a recipe return 1 plank.'],
                    ['Spell Tomes', 'Craft tomes at the scriptorium to teach colonists spells. Each school has multiple tomes at different skill levels.'],
                    ['Armor', 'Progression: Iron Brigandine (8% DR) → Leather Vest (10%) → Enchanted Tunic (12%, +10% spell) → Iron Chainmail (16%) → Mana-Weave Robe (18%, +20% spell) → Runic Plate (24%) → Void Armor (30%). Leather requires hides from hunting; iron armor needs smelted iron ore.'],
                    ['Potions', 'Brewed at the alchemy table. Health Potion (3 berries + 1 wheat), Speed Potion (2 corn + 2 potatoes + 1 berries), Mana Potion (3 moonbloom + 1 runite, needs Herbalism), Resistance Potion (2 moonbloom + 2 stone + 1 iron, needs Herbalism). Auto-consumed when trigger conditions are met.'],
                    ['Cooking', 'Converts raw crops/meat into food at the cauldron. Cooked meals give mood bonus. Raw food gives mood penalty.'],
                    ['Auto-Cook', 'Set a food target in the Food & Potions craft tab using +/- buttons. Automatically queues cooking when food drops below target.'],
                    ['Auto-Craft', 'Toggle the ⟳ repeat button on any recipe to keep it auto-queued. Or set a stock target number — crafting stops when you have enough of the output.'],
                ]
            },
            {
                subtitle: 'Trading',
                entries: [
                    ['Barter System', 'When a caravan arrives, open the trade panel to barter any resources. Your offer value must meet or exceed request value.'],
                    ['Trade Values', 'Each resource has a base value. You sell at 80% (discount) and buy at 120% (markup) of base value.'],
                    ['Exclusive Items', 'Traders occasionally carry rare items unavailable through crafting: Amulet of Fortune, Enchanted Blade, Wanderer\'s Cloak, Merchant\'s Ring, Crystal Capacitor.'],
                    ['Crystal Capacitor', 'Consumable item from trades or rare expedition drops. Use from inventory to permanently increase mana crystal limit by 1.'],
                ]
            },
        ]
    },
    {
        title: 'Building & Structures',
        subsections: [
            {
                subtitle: 'Buildings',
                entries: [
                    ['Wall', '(█) Blocks movement. Forms rooms when enclosing an area with doors.'],
                    ['Floor', '(·) Cosmetic. Makes rooms nicer.'],
                    ['Door', '(+) Allows passage through walls. Counts as room boundary.'],
                    ['Bed', '(B) Colonists sleep here. Assign beds for mood bonus ("slept in bed").'],
                    ['Workbench', '(C) Required for crafting recipes (planks, weapons, bricks).'],
                    ['Cauldron', '(F) Required for brewing recipes (meals from raw food/crops).'],
                    ['Food Chest', '(S) Preserves food. Each reduces spoilage by 15% (stacks up to 60%).'],
                    ['Torch', '(i) Light source. Provides warmth in winter.'],
                    ['Fence', '(|) Blocks movement like a wall but lighter to build.'],
                    ['Arcanum', '(R) Required for researching new magic. Colonists study here to unlock the tech tree and progress spell tomes.'],
                    ['Beast Circle', '(A) Required for binding creatures. Needs research: Beast Binding.'],
                    ['Mana Crystal', '(W) Generates 8 mana. Limit 4 (upgradeable with Crystal Capacitor). Needs research: Ley Channeling.'],
                    ['Glowstone', '(L) Mana-powered light, radius 5. Consumes 2 mana.'],
                    ['Enchanting Table', '(P) 1.5x crafting speed. Consumes 4 mana.'],
                    ['Ember Ward', '(H) Warms nearby tiles (radius 4) in winter. Consumes 3 mana.'],
                    ['Arcane Sentinel', '(X) Auto-attacks hostile enemies in range 4. Consumes 3 mana.'],
                    ['Ice Box', '(I) Magical preservation. Reduces food spoilage by 40%. Consumes 1 mana.'],
                    ['Rift Gate', '(Ω) Opens portals to other realms for exploration. Consumes 6 mana. Requires Planar Rift research.'],
                    ['Void Nexus', '(V) Click to start wave defense. Needs research: Void Summoning.'],
                    ['Reinforced Door', '(╬) Mid-tier reinforced door (50 HP). Needs research: Fortification.'],
                    ['Void Wall', '(▓) Reinforced wall (120 HP). Needs research: Void Architecture.'],
                    ['Void Door', '(▒) Reinforced door (80 HP). Colonists pass, enemies must break. Needs research: Void Architecture.'],
                    ['Void Turret', '(Y) Stronger sentinel, range 5, 20 dmg. Consumes 5 mana. Needs research: Void Forging.'],
                    ['Inferno Ward', '(Ħ) Incinerates nearby enemies (radius 4, 8 dmg/tick). Also warms. Consumes 5 mana. Needs research: Pyroclasm.'],
                    ['Mana Relay', '(⊛) Mana buildings within 3 tiles consume 1 less mana (min 1). Consumes 1 mana. Needs research: Arcane Conduits.'],
                    ['Beacon', '(☀) Radiant beacon with massive light radius 15. Consumes 4 mana. Needs research: Brilliance.'],
                ]
            },
            {
                subtitle: 'Complex Structures',
                entries: [
                    ['Pattern Activation', 'Build the core piece, then surround it with the required pattern. Activation is automatic when the pattern is complete. Destroying any piece deactivates the bonus.'],
                    ['Great Forge Layout', '3×3 room. Effect: 2.5x equipment crafting speed within 3 tiles. Requires: Masterwork research.\n\n  ███\n  █⚒█    █ = Wall (any material)\n  █+█    ⚒ = Forge Core (center)\n            + = Door (any side)\n\nWalls on all sides except one door.'],
                    ['Ritual Circle Layout', '5×5 diamond. Effect: -30% spell cooldowns within radius 6. Requires: Advanced Arcana research.\n\n    █\n   █ █\n  █ ◎ █   █ = Wall (any material)\n   █ █    ◎ = Ritual Core (center)\n    █\n\nWalls at 4 cardinal (dist 2) + 4 diagonal (dist 1) positions.'],
                ]
            },
        ]
    },
    {
        title: 'Magic & Mana',
        subsections: [
            {
                subtitle: 'Magic System',
                entries: [
                    ['Spell Tomes', 'Colonists learn spells by studying Spell Tomes at the Arcanum. Each tome teaches one spell from a specific school. Progress is per-colonist per-tome and persists across unequip/re-equip. Completing a tome consumes it and permanently grants the spell.'],
                    ['Colonist Mana', 'Each colonist has a personal mana pool (base 20 + bonuses from magic skill levels). Spells consume mana and go on cooldown. Mana regenerates over time.'],
                    ['Auto-Cast', 'Colonists auto-cast known spells when conditions are met (heal when ally is hurt, buff speed when working, etc.). Use the disable checkbox next to each spell to prevent auto-casting for mana conservation.'],
                    ['Casting XP', 'Casting spells grants XP in that spell\'s school, in addition to studying tomes.'],
                    ['Evocation', 'Combat spells (Spark, Magic Missile, Fireball, Smite). Damage enemies at range or in melee.'],
                    ['Enchantment', 'Buffs for everyday tasks (Quicken, Haste). Speed up colonist work.'],
                    ['Abjuration', 'Defensive/healing spells (Mend, Heal, Shield). Keep colonists alive.'],
                    ['Conjuration', 'Summoning and teleportation (Phase Step, Warp, Summon Familiar, Summon Ghost).'],
                    ['Transmutation', 'Reshape the environment (Nurture, Circle of Growth, Level Field). Boost crops and terrain.'],
                    ['Divination', 'Manipulate odds (Foresight, Fair Winds, Merchant\'s Omen, Ward of Calamity, Fortunate Discovery). Influence weather, events, and raid timing.'],
                ]
            },
            {
                subtitle: 'Mana & Leylines',
                entries: [
                    ['Net Mana', 'Generation minus consumption. If negative, all mana buildings shut off.\n\n  Building           Mana\n  Mana Crystal       +8 (generates, +9 with Mana Reservoir)\n  Mana Relay         -1\n  Ice Box            -1\n  Artifact Pedestal  -1 to -3 (varies by artifact)\n  Glowstone          -2\n  Arcane Sentinel    -3\n  Ember Ward         -3\n  Enchanting Table   -4\n  Beacon             -4\n  Inferno Ward       -5\n  Void Turret        -5\n  Rift Gate          -6'],
                    ['Mana Relay', 'Arcane Conduits research. Mana buildings within 3 tiles of a relay consume 1 less mana (min 1). Does not stack — only one relay affects each building.'],
                    ['Mana Reservoir', 'Research that increases mana crystal cap by +3 (total 7 base) and each crystal generates +1 mana (9 total).'],
                ]
            },
            {
                subtitle: 'Research',
                entries: [
                    ['How Research Works', 'Select a research topic, then colonists study at the Arcanum to progress it. Only one research can be active at a time. If no research is selected, tome study speed is doubled. The first 2 research desks contribute full output; additional desks produce at 50% efficiency.'],
                    ['Research Gates', 'Advanced technologies have additional requirements beyond prerequisites:\n\n  Building Prerequisites — Certain buildings must exist on the map\n  Milestone Gates — Achievements must be completed first\n  Tab Breadth — A minimum number of techs in the same tab must be done\n\nExamples: Ley Channeling requires an Anvil. Void tab techs require surviving a raid. Endgame techs require 3+ techs completed in their tab.'],
                    ['Research Tree', 'Research is organized into 4 tabs. Cross-tab prerequisites show as clickable badges.\n\n  Foundations & Nature    Arcane & Mana        Crafting & Lore      Void & Exploration\n  ──────────────────────  ───────────────────  ───────────────────  ──────────────────\n  Stonework              Ley Channeling       Marksmanship         Warding\n  Runecraft              Luminance            Arcane Studies       Fortification\n  Druidcraft             Brilliance           Arcane Implements    Void Summoning\n  Alchemy                Arcane Conduits      Artisan\'s Touch      Void Architecture\n  Irrigation             Ember Magic          Advanced Arcana      Void Forging\n  Beast Binding          Arcane Infusion      Void Sorcery         Planar Rift\n  Trade Routes           Mana Reservoir       Runeforging          Deep Delving\n  Husbandry              Mana Weaving         Masterwork\n  Wolf Mastery           Pyroclasm            Golem Craft\n  Herbalism\n  Verdant Growth'],
                ]
            },
        ]
    },
    {
        title: 'Combat & Defense',
        subsections: [
            {
                subtitle: 'Combat',
                entries: [
                    ['Combat', 'Melee (1-tile) or ranged (bows/crossbows/wands). Damage = base + weapon bonus. Colonists auto-defend and engage threats within weapon range.'],
                    ['Ranged Weapons', 'Bows, crossbows, and the Void Longbow fire projectiles at enemies from a distance. Colonists with ranged weapons stay back instead of closing to melee.\n\n  Short Bow          range 5,  7d (2.3 dps)\n  Hunting Bow        range 6, 10d (3.3 dps)\n  Iron Crossbow      range 7, 22d (4.4 dps) slow\n  Runic Crossbow     range 8, 30d (6.0 dps) slow\n  Void Longbow       range 10, 24d (8.0 dps)'],
                    ['Magic Weapons', 'Wands and staves provide spell damage bonus and attack at range without closing to melee. Wands are fast (2-tick), staves are normal (3-tick).\n\n  Wooden Wand        range 5, +20% spell, 3d (1.5 dps) fast\n  Crystal Staff      range 6, +35% spell, 8d (2.7 dps)\n  Runic Wand         range 7, +50% spell, 7d (3.5 dps) fast\n  Void Staff         range 8, +65% spell, 12d (4.0 dps)'],
                    ['Ranged Magic', 'Colonists with Evocation spells (Spark, Magic Missile, Fireball, Smite) attack enemies automatically. Smite is a melee-range burst for close encounters.'],
                    ['Melee Weapons', 'Fists (5d), Stone Spear (8d), Wooden Club (10d), Iron Sword (14d), Etched Axe (15d), Etched Mace (17d), Enchanted Glaive (18d +25% spell), Runic Blade (22d), Void Dagger (16d fast, 8.0 dps +40% spell), Runic Greatsword (45d slow, 9.0 dps), Void Blade (52d slow, 10.4 dps).'],
                    ['Armor', 'Damage reduction stacks multiplicatively: Iron Brigandine (8%), Leather Vest (10%), Enchanted Tunic (12% +10% spell), Iron Chainmail (16%), Mana-Weave Robe (18% +20% spell), Runic Plate (24%), Void Armor (30%).'],
                    ['Raids', 'Raiders attack periodically (disabled in Peaceful Mode). Scale with colony wealth AND time — early raids are gentle (1-2 raiders), full strength ramps over 3 in-game years. Individual raiders flee below 15% HP; the group routs when 80% are dead or fleeing.'],
                    ['Structure HP', 'Walls/doors/fences have HP. Enemies break through them. Auto-repairs when idle.'],
                    ['Peaceful Mode', 'Disables raids, wolves, and pyromaniac fires. Void Nexus still works.'],
                ]
            },
            {
                subtitle: 'Guard & Patrol',
                entries: [
                    ['Guard Mode', 'Toggle Guard on a colonist to make them patrol their current position instead of doing tasks. They engage hostiles within a wider radius than normal.'],
                    ['Guard Radius', 'Guards patrol within 6 tiles of their post and engage threats within 10 tiles.'],
                    ['Needs Priority', 'Guards still eat and sleep when needs are critical, then return to their post.'],
                ]
            },
            {
                subtitle: 'Wave Defense (Void Nexus)',
                entries: [
                    ['Void Nexus', '(V) Build after researching Void Summoning. Click to start a wave defense challenge.'],
                    ['Waves', 'Each wave is harder (more enemies, more HP/dmg). Enemies (E, purple) spawn from portals and attack the nexus.'],
                    ['Nexus HP', '200 HP. If destroyed, you must rebuild. Wave progress is kept.'],
                    ['Colony Cap', '3 + 1 per 2 waves completed, max 12. Complete waves to grow your colony. Hearth Shrine adds +2 to the base cap.'],
                    ['Void Essence', 'Dropped by wave enemies. Used for Void Blade, Void Armor, Void Wall, Void Turret, Void Door.'],
                    ['Strategy', 'Build walls/doors to funnel enemies, place turrets along path, draft colonists at chokepoints.'],
                ]
            },
        ]
    },
    {
        title: 'Creatures & Golems',
        subsections: [
            {
                subtitle: 'Wildlife & Beast Binding',
                entries: [
                    ['Deer', '(d) Passive. Flees colonists. Yields 3 meat + 2 hides when hunted.'],
                    ['Rabbit', '(r) Passive. Fast. Yields 1 meat.'],
                    ['Wolf', '(w) Hostile. Attacks colonists at night/winter. Yields 2 meat + 1 hide.'],
                    ['Okapi', '(O) Passive. Pack animal when tamed. Yields 5 meat + 3 hides when hunted.'],
                    ['Tapir', '(t) Passive. Happiness aura when tamed. Yields 4 meat + 2 hides when hunted.'],
                    ['Chicken', '(c) Passive. Produces eggs when tamed.'],
                    ['Hunting', 'Select an animal, click Hunt. Creates a task for a colonist to kill it.'],
                    ['Beast Binding', 'Requires Beast Binding research + Beast Circle. Bound creatures can have different roles: production (eggs, milk), pack animals (speed up expeditions), or aura (passive mood boost).'],
                ]
            },
            {
                subtitle: 'Wolf Taming',
                entries: [
                    ['Dangerous Tame', 'Wolves are dangerous to tame. Success chance = 40% base + 6% per Animals skill level. At skill 10, success is guaranteed.'],
                    ['Retaliation', 'On tame failure, the wolf attacks the colonist for 12 damage and flees. The colonist gets negative mood thoughts.'],
                    ['Guard Wolves', 'Once tamed, wolves become guard animals. They patrol near colonists and automatically attack raiders, wave enemies, and hostile wildlife within range 8.'],
                    ['Guard States', 'Patrolling (following colonists), Engaging (attacking threats), Retreating (low HP, returning to safety).'],
                ]
            },
            {
                subtitle: 'Golems',
                entries: [
                    ['Overview', 'Golems are animated stone workers. They never eat, sleep, or have mood swings. Each specializes in one skill.'],
                    ['Golem Forge', 'Build a Golem Forge (requires Golem Craft research) and click it to craft golems. Costs stone, runite, and void essence.'],
                    ['Types', 'Craft at the Golem Forge:\n\n  Type     Specialty  Skill  HP   Cost\n  Farmer   Farming    6      150  10 stone, 3 runite, 2 void\n  Builder  Building   6      180  12 stone, 4 runite, 2 void\n  Crafter  Crafting   6      160  11 stone, 3 runite, 2 void\n  Cook     Cooking    6      140  9 stone, 2 runite, 1 void\n  Herder   Animals    6      170  11 stone, 3 runite, 2 void\n  Scholar  Research   6      130  8 stone, 2 runite, 2 void\n  Combat   Fighting   —      250  15 stone, 5 runite, 4 void'],
                    ['Limitations', 'Cannot equip tomes or learn spells. Cannot be drafted. Do not count toward colonist cap.'],
                ]
            },
        ]
    },
    {
        title: 'Exploration & Artifacts',
        subsections: [
            {
                subtitle: 'Exploration (Rift Gate)',
                entries: [
                    ['Rift Gate', '(Ω) Build after researching Planar Rift. Click to open the expedition panel. Consumes 6 mana.'],
                    ['Expeditions', 'Select colonists (max 5) and optional pack animals (max 2), choose a difficulty level (1-5), and launch. Higher difficulty means tougher enemies and traps but significantly more loot and rare finds. Party walks to the gate, explores, and returns with loot.'],
                    ['Live Event Log', 'While an expedition is active, click the Rift Gate to see a scrolling log of events: combat rounds, trap encounters, item discoveries, and ambient observations. Each realm has unique events.'],
                    ['Pack Animals', 'Tamed okapi can join expeditions (max 2) as pack animals, reducing expedition duration by 25% each. Shown as a separate line behind the party in the expedition visualization.'],
                    ['Difficulty Levels', 'Choose 1-5 before launching:\n\n  1 Normal     Standard. No bonuses.\n  2 Dangerous  +50% loot, +50% rare. Enemies +30% HP/+20% dmg.\n  3 Perilous   +100% loot, +150% rare. Enemies +70% HP/+50% dmg.\n  4 Deadly     +200% loot, +300% rare. Enemies +120% HP/+80% dmg.\n  5 Suicidal   +300% loot, +500% rare. Enemies +200% HP/+120% dmg.'],
                    ['Realms', 'Four chains of three realms each, unlocking deeper travel:\n\n  Crystal:  Caves (1) → Mines (2) → Depths (3)\n  Verdant:  Depths (1) → Fungal Hollows (2) → Primeval Canopy (3)\n  Arcane:   Library (2) → University (3) → Laboratory (4)  [Arcane Studies]\n  Shadow:   Realm (3) → Void Abyss (4) → Oblivion Rift (5) [Deep Delving]'],
                    ['Equipment Readiness', 'Recommended minimum gear before tackling each difficulty tier:\n\n  Diff 1 (Crystal Caves, Verdant Depths)\n    Weapon: Stone Spear+ (8+ dmg)\n    Armor:  Optional\n    Party:  2-3 colonists\n\n  Diff 2 (Crystal Mines, Fungal Hollows, Arcane Library)\n    Weapon: Iron Sword+ (14+ dmg)\n    Armor:  Leather Vest (10% DR)\n    Party:  3-4 colonists\n\n  Diff 3 (Crystal Depths, Primeval Canopy, Ancient Univ., Shadow Realm)\n    Weapon: Enchanted Glaive+ (18+ dmg)\n    Armor:  Iron Chainmail (16% DR)\n    Helmet: Iron Helmet (8% DR)\n    Party:  4-5 colonists, healer recommended\n\n  Diff 4 (Abandoned Laboratory, Void Abyss)\n    Weapon: Runic Blade+ (22+ dmg)\n    Armor:  Runic Plate (24% DR)\n    Helmet: Runic Helm (14% DR)\n    Party:  5 colonists, healer + tank artifacts\n\n  Diff 5 (Oblivion Rift)\n    Weapon: Runic Greatsword / Void Blade (45-52 dmg)\n    Armor:  Void Armor (30% DR)\n    Helmet: Void Crown (18% DR)\n    Party:  5 colonists, healer, Ward of Sentinel, full buffs'],
                    ['Party Strength', 'Shown during expedition setup. Estimates party power vs. realm difficulty: Easy (green) / Fair (yellow-green) / Tough (orange) / Dangerous (red) / Suicidal (dark red). Based on party damage, HP, and armor vs. expected enemies.'],
                    ['Encounters', 'Combat encounters resolve round-by-round in real-time. Colonists attack with equipped weapons; enemies strike back. Traps deal damage to random party members. Discoveries provide bonus loot.'],
                    ['Loot on Defeat', 'Even if all party members are defeated, you keep any items found during exploration. You only lose the completion bonus for finishing the expedition.'],
                ]
            },
            {
                subtitle: 'Artifacts',
                entries: [
                    ['Overview', 'Powerful items with unique effects. Some are equipped on colonists, others placed on Artifact Pedestals for area-of-effect buffs. Found in expeditions, purchased from traders, or crafted.'],
                    ['Artifact Pedestal', '(◆) Place an artifact on a pedestal to project its effect in a radius. Mana cost varies by artifact. Build after researching Arcane Infusion. Click to place or retrieve artifacts.'],
                    ['Radius Effects', 'Pedestal artifacts affect colonists/crops within their Manhattan-distance radius. Radius is shown as a diamond highlight when selecting the pedestal. Global artifacts (radius: global) affect the entire colony.'],
                    ['Equipped Effects', 'Some artifacts provide bonuses when equipped on a colonist: move speed, work speed, combat priority, or damage reduction. Expedition effects apply when the colonist is on an expedition.'],
                    ['Durability & Repair', 'Certain powerful artifacts (Ward of the Sentinel) break after use. Broken artifacts provide no effects. Repair at an Anvil (requires Runeforging research) — costs 1 runite.'],
                    ['Artifact List', 'All artifacts and their primary effects:\n\n  Boots of Haste          +50% move speed (equipped)\n  Seedkeeper\'s Locket     Blight immunity radius 8 (pedestal)\n  Hourglass of Diligence  +25% work (equip) / +15% work radius 5 (pedestal)\n  Lodestone of Prosperity +25% wanderer/trader chance (global pedestal)\n  Cornucopia Charm        +1 bonus food per cook (global pedestal)\n  Compass of Greed        +50% loot, +20% trap dmg (expedition)\n  Voidwalker\'s Lantern    2x rare encounters (expedition) / light r6 (pedestal)\n  Map Fragment            -30% expedition duration (consumable)\n  Ward of the Sentinel    Auto-revive at 50% HP, breaks after use\n  Drum of Rallying        +15% damage radius 8 (pedestal/expedition)\n  Cloak of Shadows        Enemies avoid targeting (combat/expedition)\n  Aegis of the Vanguard   Enemies focus you, -30% damage taken (tank)\n  Haggler\'s Coin          -15% trade markup (global pedestal)\n  Tome of Shared Wisdom   +10% skill growth radius 5 (pedestal)'],
                    ['Sources', 'Expedition loot (realm-specific rares + Map Fragments everywhere), Trader exclusive items, and crafting (Ward of the Sentinel via Void Forging).'],
                ]
            },
        ]
    },
    {
        title: 'World & Events',
        subsections: [
            {
                subtitle: 'Seasons & Weather',
                entries: [
                    ['Seasons', '4 seasons per year, each 1500 ticks (~5 min at 1x speed):\n\n  Season  Temp       Growth  Special\n  Spring  10-20°     1.0x    Animals appear\n  Summer  20-35°     1.5x    Heat waves, fire risk, faster rot\n  Autumn  5-15°      0.8x    Animal migrations\n  Winter  -10 to 5°  None*   Snow, need warmth\n\n* Potatoes still grow in winter.'],
                    ['Rain', 'Boosts crop growth 1.3x. Extinguishes fires.'],
                    ['Thunderstorm', 'Can start fires via lightning.'],
                    ['Blizzard', 'Stops all crop growth. Winter only.'],
                ]
            },
            {
                subtitle: 'Events',
                entries: [
                    ['Wanderer', 'A new colonist wants to join. More likely when colony is happy. Accept or reject.'],
                    ['Trade Caravan', 'A merchant arrives with random inventory. Open barter panel to trade any resources. Trader buys at 80% value, sells at 120%. May carry exclusive items.'],
                    ['Crop Blight', 'Destroys ~40% of growing crops. Summer/autumn.'],
                    ['Mineral Windfall', 'New stone deposits appear on the map.'],
                    ['Fire', 'Spreads to adjacent flammable tiles. Colonists auto-extinguish. Rain puts fires out.'],
                    ['Cold Snap', 'All outdoor crops die. Winter only.'],
                    ['Animal Migration', 'Group of deer passes through (hunting opportunity).'],
                    ['Inspiration', 'Random colonist gets +25 mood boost.'],
                ]
            },
        ]
    },
    {
        title: 'Controls & Map',
        subsections: [
            {
                subtitle: 'Controls',
                entries: [
                    ['WASD / Arrows', 'Pan camera.'],
                    ['+/- ', 'Zoom in/out.'],
                    ['Space', 'Pause/Unpause.'],
                    ['< / >', 'Speed down/up (1x to 5x).'],
                    ['B', 'Toggle Build mode.'],
                    ['Z', 'Toggle Farm Zone mode.'],
                    ['G', 'Toggle Gather/Designate mode.'],
                    ['P', 'Toggle Priority panel.'],
                    ['C', 'Toggle Craft panel.'],
                    ['R', 'Toggle Research panel.'],
                    ['I', 'Toggle Inventory panel.'],
                    ['V', 'Toggle Arcane panel.'],
                    ['J', 'Toggle Story panel.'],
                    [',', 'Toggle Settings panel.'],
                    ['[ / ]', 'Select previous/next colonist (centers camera).'],
                    ['X (Build)', 'Toggle deconstruct mode.'],
                    ['Tab (Build)', 'Cycle build categories (Shift+Tab = reverse).'],
                    ['Tab (Designate)', 'Switch between Chop and Mine.'],
                    ['1-9/0 (Build/Zone)', 'Select item or crop type.'],
                    ['/', 'Reset minimap size.'],
                    ['Click', 'Select colonist/animal/tile. Drag to box-select.'],
                    ['Right-click', 'Move drafted colonists / rally point.'],
                    ['Escape', 'Close panel or exit mode.'],
                ]
            },
            {
                subtitle: 'Map Symbols',
                symbols: [
                    ['.', 'Grass', '#22aa22'],
                    [',', 'Dirt', '#88aa44'],
                    ['#', 'Rock (slow)', '#666666'],
                    ['▲', 'Tall Rock (impassable)', '#444444'],
                    ['~', 'Water (slow)', '#4488cc'],
                    ['T', 'Tree', '#228822'],
                    ['o', 'Stone/Iron/Runite deposit', '#aaaaaa'],
                    ['@', 'Colonist', '#00ccff'],
                    ['R', 'Raider', '#ff6600'],
                    ['E', 'Void Enemy', '#ff2222'],
                    ['V', 'Void Nexus', '#9933ff'],
                    ['▓', 'Void Wall', '#6622aa'],
                    ['Y', 'Void Turret', '#aa33ff'],
                    ['Ω', 'Rift Gate', '#66aaff'],
                    ['Ğ', 'Golem Forge', '#cc8833'],
                    ['⚒', 'Forge Core', '#ff8844'],
                    ['◎', 'Ritual Core', '#aa44ff'],
                    ['◆', 'Artifact Pedestal', '#ccaa44'],
                    ['⌂', 'Anvil', '#999999'],
                    ['Ħ', 'Inferno Ward', '#ff4400'],
                    ['⊛', 'Mana Relay', '#aa88ff'],
                    ['☀', 'Beacon', '#ffffaa'],
                    ['╬', 'Reinforced Door', '#aa8855'],
                    ['G', 'Golem', '#888888'],
                    ['*', 'Turret beam', '#ff4444'],
                ]
            },
        ]
    },
];

function renderSubsectionContent(sub) {
    let html = '';
    if (sub.symbols) {
        html += '<div style="font-family:monospace; color:#aaa; line-height:2;">';
        for (const [char, label, color] of sub.symbols) {
            html += `<span class="glossary-entry"><span style="color:${color}; font-size:14px;">${char}</span> ${label} &nbsp;&nbsp;</span>`;
        }
        html += '</div>';
    } else if (sub.entries) {
        for (const [term, desc] of sub.entries) {
            if (desc.includes('\n')) {
                const parts = desc.split('\n');
                html += `<div class="glossary-entry" style="margin:4px 0;"><b style="color:#fff">${term}</b> — ${parts[0]}</div>`;
                html += `<pre style="margin:2px 0 8px 12px; color:#aaa; font-size:11px; line-height:1.4;">${parts.slice(1).join('\n')}</pre>`;
            } else {
                html += `<div class="glossary-entry" style="margin:4px 0;"><b style="color:#fff">${term}</b> — ${desc}</div>`;
            }
        }
    }
    return html;
}

export function renderGlossaryHTML() {
    let html = '';
    html += `<input type="text" id="glossary-search" placeholder="Search glossary..." style="width:100%; padding:6px 10px; margin-bottom:10px; background:#2a2a4a; border:1px solid #555; border-radius:4px; color:#eee; font-size:12px; font-family:inherit; outline:none;">`;

    html += `<div id="glossary-tabs" style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:10px;">`;
    for (let i = 0; i < GLOSSARY.length; i++) {
        html += `<button class="glossary-tab-btn" data-tab="${i}" style="padding:3px 8px; background:${i === 0 ? '#446' : '#2a2a4a'}; border:1px solid #555; border-radius:3px; color:${i === 0 ? '#88ccff' : '#888'}; font-size:11px; cursor:pointer; font-family:inherit;">${GLOSSARY[i].title}</button>`;
    }
    html += `</div>`;

    html += `<div id="glossary-content">`;
    for (let i = 0; i < GLOSSARY.length; i++) {
        const section = GLOSSARY[i];
        html += `<div class="glossary-section" data-section="${i}" style="display:${i === 0 ? 'block' : 'none'}">`;
        if (section.subsections) {
            for (const sub of section.subsections) {
                html += `<div style="color:#88ccff; font-weight:bold; margin:12px 0 6px 0; font-size:12px; border-bottom:1px solid #333; padding-bottom:3px;">${sub.subtitle}</div>`;
                html += renderSubsectionContent(sub);
            }
        } else if (section.symbols) {
            html += renderSubsectionContent(section);
        } else {
            html += renderSubsectionContent(section);
        }
        html += `</div>`;
    }
    html += `</div>`;

    html += `<div id="glossary-search-results" style="display:none;"></div>`;

    return html;
}

export function initGlossaryInteraction() {
    const search = document.getElementById('glossary-search');
    const tabs = document.getElementById('glossary-tabs');
    const content = document.getElementById('glossary-content');
    const results = document.getElementById('glossary-search-results');
    if (!search || !tabs || !content || !results) return;

    const tabBtns = tabs.querySelectorAll('.glossary-tab-btn');
    const sections = content.querySelectorAll('.glossary-section');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (search.value.trim()) return;
            const idx = btn.dataset.tab;
            tabBtns.forEach(b => { b.style.background = '#2a2a4a'; b.style.color = '#888'; });
            btn.style.background = '#446';
            btn.style.color = '#88ccff';
            sections.forEach(s => { s.style.display = s.dataset.section === idx ? 'block' : 'none'; });
        });
    });

    search.addEventListener('input', () => {
        const query = search.value.trim().toLowerCase();
        if (!query) {
            results.style.display = 'none';
            content.style.display = 'block';
            tabs.style.display = 'flex';
            return;
        }

        content.style.display = 'none';
        tabs.style.display = 'none';
        results.style.display = 'block';

        let html = '';
        for (const section of GLOSSARY) {
            const sources = section.subsections || [section];
            for (const sub of sources) {
                const matches = [];
                const label = sub.subtitle || section.title;
                if (sub.symbols) {
                    for (const [char, lbl, color] of sub.symbols) {
                        if (`${char} ${lbl}`.toLowerCase().includes(query)) {
                            matches.push(`<span style="color:${color}; font-size:14px;">${char}</span> ${lbl}`);
                        }
                    }
                } else if (sub.entries) {
                    for (const [term, desc] of sub.entries) {
                        if (`${term} ${desc}`.toLowerCase().includes(query)) {
                            if (desc.includes('\n')) {
                                const parts = desc.split('\n');
                                matches.push(`<b style="color:#fff">${term}</b> — ${parts[0]}<pre style="margin:2px 0 4px 12px; color:#aaa; font-size:11px; line-height:1.4;">${parts.slice(1).join('\n')}</pre>`);
                            } else {
                                matches.push(`<b style="color:#fff">${term}</b> — ${desc}`);
                            }
                        }
                    }
                }
                if (matches.length > 0) {
                    html += `<div style="color:#88ccff; font-weight:bold; margin-top:8px; margin-bottom:4px; font-size:11px;">${label}</div>`;
                    for (const m of matches) {
                        html += `<div style="margin:3px 0;">${m}</div>`;
                    }
                }
            }
        }
        results.innerHTML = html || '<div style="color:#888; margin-top:10px;">No results found.</div>';
    });
}
