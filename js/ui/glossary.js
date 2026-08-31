export const GLOSSARY = [
    {
        title: 'Colonists & Needs',
        subsections: [
            {
                subtitle: 'Races',
                entries: [
                    ['Races Overview', 'Five playable races, each with a unique racial trait that provides passive bonuses. Colonists of all races work together and can fill any role.'],
                    ['Human', 'Versatile generalists who gain non-magic skill experience faster than other races.'],
                    ['Nymph', 'Magically attuned beings who gain magic skill experience faster and need slightly less sleep.'],
                    ['Ferin', 'Joyful farmers with a bonus to farming speed and amplified positive thoughts.'],
                    ['Kobalos', 'Energetic workers with faster movement, faster work speed, and no mood penalty from eating raw food.'],
                    ['Bufos', 'Daylight-adapted creatures with modified rest patterns.'],
                ]
            },
            {
                subtitle: 'Needs & Mood',
                entries: [
                    ['Hunger', 'Decays over time. Colonists interrupt work to eat when critically hungry. Cooked food fully restores hunger; raw food only partially restores it.'],
                    ['Rest', 'Decays over time. Colonists seek sleep when exhausted. Sleeping in an assigned bed gives a mood bonus; sleeping on the ground does not.'],
                    ['Mood', 'A colonist\'s mood is their base value modified by active thoughts. Mood level directly determines work speed and willingness to work.'],
                    ['Mood Levels', 'Four tiers from best to worst: Inspired (fastest work), Content (normal speed), Stressed (slow), and Breaking (refuses all work). Keep colonists above the stress threshold for productive labor.'],
                    ['Thoughts', 'Temporary mood modifiers gained from events, meal quality, weather, social interactions, achievements, and room quality. Each thought fades after a duration.'],
                    ['Mental Breaks', 'When mood drops critically low, colonists enter a breaking state. While in this state the colonist will wander aimlessly and refuse tasks until their mood recovers.'],
                    ['Critical Alerts', 'Automatic warnings appear when colonists are near starvation, approaching a mental break, or freezing in cold weather.'],
                ]
            },
            {
                subtitle: 'Traits',
                entries: [
                    ['Traits Overview', 'Permanent modifiers assigned when a colonist is created. Each colonist gets one to three traits. Some trait pairs are mutually exclusive.'],
                    ['Work Traits', 'Hard Worker, Lazy, Night Owl, Early Bird, Creative, Scholar, Prodigy. These affect work speed, skill growth rate, or time-of-day performance.'],
                    ['Survival Traits', 'Iron Stomach, Gluttonous, Tough, Brave, Quick, Sturdy, Light Sleeper, Deep Sleeper. These modify hunger/rest decay, damage resistance, movement speed, or combat behavior.'],
                    ['Social Traits', 'Socialite, Loner, Optimist, Pessimist, Gourmand. These affect mood from social interactions, thought intensity, or meal satisfaction.'],
                    ['Rare Traits', 'Lucky (better crafting quality), Pyromaniac (may start fires), Pacifist (refuses combat), Magically Gifted (starts with a magic school level and starter spell).'],
                ]
            },
            {
                subtitle: 'Skills & Health',
                entries: [
                    ['Skills', 'Six work skills (Building, Farming, Crafting, Cooking, Animals, Research) plus six magic schools. Higher skill levels mean faster task completion and better outcomes.'],
                    ['Skill Leveling', 'Skills improve through use, with completing related tasks granting experience. Each level requires progressively more experience than the last.'],
                    ['Health', 'Colonists have hit points that regenerate slowly when idle and faster when sleeping. If a colonist dies, surviving colonists suffer severe mood penalties based on their relationship.'],
                    ['Equipment Slots', 'Each colonist has Weapon, Armor, Helmet, Boots, Tool, and Trinket slots. Use Auto-equip to quickly assign the best available gear, or manually equip from the inventory.'],
                    ['Active Effects', 'Temporary buffs from potions and spells appear in the colonist info panel with remaining duration. Effects include speed boosts, damage shields, and healing. Buffed colonists pulse on the map.'],
                ]
            },
        ]
    },
    {
        title: 'Relationships & Social',
        subsections: [
            {
                subtitle: 'Social System',
                entries: [
                    ['Socializing', 'Colonists near each other periodically interact. Each interaction shifts their opinion of each other, determining their shared relationship tier.'],
                    ['Opinion', 'A hidden score between any two colonists ranging from very negative to very positive. This score shifts from social interactions and slowly decays toward neutral over time.'],
                    ['Relationship Tiers', 'Progresses from Stranger through Acquaintance, Friend, and Close Friend, up to Lovers. Can also go negative to Rival and Adversary. Higher tiers provide stronger mood effects.'],
                    ['Interactions', 'Random social events occur when colonists work or idle nearby: pleasant chats, shared meals, disagreements, and arguments. Generally the more time colonists spend with each other, the more they will enjoy each other\'s company.'],
                    ['Thoughts & Mood', 'Making friends, falling in love, or losing loved ones to death all cause powerful mood effects. Relationship-based thoughts are among the strongest in the game.'],
                    ['Trait Influence', 'Socialite colonists interact more often and gain mood from company. Loners prefer solitude and get stressed when crowded. Optimists amplify positive social thoughts. Pessimists amplify negative ones.'],
                ]
            },
        ]
    },
    {
        title: 'Work & Tasks',
        subsections: [
            {
                subtitle: 'Task System',
                entries: [
                    ['How Tasks Work', 'When you designate work (building, gathering, farming, etc.), tasks enter a queue. Colonists pick tasks based on their priority settings for the relevant skill.'],
                    ['Priorities', 'Set each skill from 1 (highest priority) to 5 (lowest), or disable it entirely. Colonists always attempt the lowest-numbered available task they have skill for.'],
                    ['Work Speed', 'How fast a colonist completes tasks is determined by their skill level, mood, traits, equipped tool, active spell or trinket effects, and workshop quality. All bonuses multiply together.'],
                    ['Tool Bonuses', 'Equipping the right tool type (Pickaxe, Axe, Sickle, Hammer, Mattock) speeds up matching tasks. Higher-tier tools provide bigger bonuses. Mattocks cover multiple tasks but are weaker than specialists.'],
                    ['Mood & Work Speed', 'Inspired colonists work noticeably faster. Stressed colonists work significantly slower. Breaking colonists stop working entirely until their mood recovers.'],
                    ['Idle Behavior', 'Colonists with no tasks may wander, stargaze, skip stones, or socialize. If a Town Hall exists, idle colonists will gather there for mood-boosting relaxation activities.'],
                ]
            },
            {
                subtitle: 'Room & Workshop Quality',
                entries: [
                    ['Bedrooms', 'Enclosed bedrooms (walls + door + floor + bed) have a quality score based on furnishings and decorations inside. Better bedrooms give a bigger mood bonus when colonists sleep there.'],
                    ['Workshops', 'Crafting stations in furnished rooms gain speed and quality bonuses. Nearby tool racks, chairs, tables, and material shelves all improve workshop effectiveness.'],
                    ['Town Hall', 'Place a Town Hall Banner in a furnished room to designate it as a gathering space. Idle colonists spend time here to socialize and get mood boosts. Better decorations improve the effect.'],
                ]
            },
        ]
    },
    {
        title: 'Building & Resources',
        subsections: [
            {
                subtitle: 'Construction',
                entries: [
                    ['Placing Buildings', 'Press B to enter Build mode, select a building, and place it on valid terrain. Colonists with building priority will construct it using resources from the stockpile.'],
                    ['Resource Costs', 'Each building requires specific resources. Costs are shown in the build menu before placement and are taken from the stockpile automatically when queued. Ensure you have enough materials before queuing large projects.'],
                    ['Structure HP', 'Walls, doors, and fences have health points. Enemies with no clear path to their target must break through these buildings by attacking them. Damaged structures automatically queue repair tasks when threats are gone.'],
                    ['Rooms', 'Place floors inside walled areas to create rooms. A room needs walls on all sides, at least one door, and floor tiles inside. Rooms provide quality-based bonuses to sleeping, crafting, or socializing based on the room\'s furnishings.'],
                    ['Deconstruction', 'While in Build mode you can right-click in the game world to deconstruct buildings and recover a portion of their materials. You can also press X from Build mode to turn toggle Destruction mode. This is useful for reorganizing your colony layout as you expand. Colonists with Building skill handle destruction tasks.'],
                    ['Research-Gated Buildings', 'Many advanced buildings require specific research to unlock. Hover over locked buildings in the build menu to see their prerequisites, or browse the research tree to plan ahead.'],
                ]
            },
            {
                subtitle: 'Resources',
                entries: [
                    ['Global Stockpile', 'All resources are colony-wide and instantly accessible. There is no hauling, colonists use materials directly from the shared stockpile when working.'],
                    ['Gathering Resources', 'Press G to designate trees for chopping (yields wood) and rock deposits for mining (yields stone, iron ore, or runite). Colonists with Building skill handle gathering tasks.'],
                    ['Processed Materials', 'Raw materials can be refined into advanced forms: wood into planks, stone into bricks, hides into leather, iron ore into iron. These are often needed for mid-to-late-game recipes, so be sure to keep a stockpile of each refined material.'],
                    ['Food & Decay', 'Food spoils over time. Decay is faster in summer and slower in winter. Build Food Chests and Ice Boxes to reduce spoilage rates and keep your food supply stable.'],
                ]
            },
        ]
    },
    {
        title: 'Crafting & Production',
        subsections: [
            {
                subtitle: 'Crafting System',
                entries: [
                    ['Crafting Stations', 'Different items require different stations: A Workbench for basic goods, an Anvil for metalwork, a Cauldron for cooking, an Alchemy Table for potions, an Enchanting Table for enchantments. Build the right station, then queue recipes. Building multiple of the same workstation will allow more colonists to take on crafting tasks at the unoccupied stations.'],
                    ['How Crafting Works', 'Open the Craft panel (C) and queue recipes. Colonists with Crafting or Cooking skill will work queued recipes at the appropriate station. Mana-powered stations (Enchanting Tables) work faster than their unpowered counterparts (Workbenches).'],
                    ['Quality Tiers', 'Crafted equipment rolls a quality level from Crude to Superior. Higher Crafting skill gives that colonist better odds of higher quality crafts. Quality multiplies the item\'s effectiveness signifigantly, with high-quality equipment from lower tiers outpacing low-quality equipment from higher tiers.'],
                    ['Enchantment Effects', 'Similar to equipment Quality, you can choose to enchant any non-trinket equipment from the inventory for a small cost. This will queue an enchantment task that is prioritized as a crafting task but distinctly uses the Enchantment skill level from the working colonist. These enchantments vary widely, applying some new effect to the equipment with a power level based on the enchantment\'s tier (I, II, III, or IV). The higher the Enchantment skill, the better odds of higher enchantment tiers. Additionally, enchanted equipment can be queued for enchantment multiple times, replacing the previous effect with a newly rolled one, allowing you to re-enchant your best equipment until you find an effect that you\'re satisfied with.'],
                    ['Auto-Craft & Auto-Cook', 'Set stock targets on recipes to automatically queue them when supplies run low. Toggle repeat mode to keep a recipe permanently queued. Great for maintaining food and potion supplies as well as keeping materials stocked.'],
                    ['Salvage', 'Recycle unwanted equipment from the inventory to recover a portion of its crafting materials. Useful for clearing out low-quality gear after upgrades.'],
                ]
            },
            {
                subtitle: 'Cooking & Potions',
                entries: [
                    ['Cooking', 'Convert raw crops and meat into cooked meals at the Cauldron. Cooked food fully restores hunger and provides a mood bonus. Eating raw food gives a mood penalty instead.'],
                    ['Food Sources', 'Crops from farming, meat from hunting animals, and products from tamed creatures (eggs, milk) all serve as cooking ingredients.'],
                    ['Potions', 'Brewed at the Alchemy Table after researching Alchemy. Potions provide temporary buffs like healing, speed, mana restoration, or damage resistance. They are auto-consumed when trigger conditions are met.'],
                ]
            },
            {
                subtitle: 'Trading',
                entries: [
                    ['Trade Caravans', 'Merchants arrive as random events. Open the barter panel to exchange resources and items. You sell at a discount and buy at a markup compared to base values.'],
                    ['Merchant Types', 'Different merchants carry different goods. Arms Dealers sell weapons and armor, Tome Peddlers sell spell tomes, and Wandering Alchemists sell potions and rare ingredients.'],
                    ['Exclusive Items', 'Some powerful items cannot be crafted and are only available from traders or as expedition loot. Watch for rare offerings when caravans arrive.'],
                    ['Trade Research', 'Research Trade Routes to improve your buy and sell rates colony-wide, making trading significantly more efficient.'],
                ]
            },
        ]
    },
    {
        title: 'Research & Magic',
        subsections: [
            {
                subtitle: 'Research',
                entries: [
                    ['How Research Works', 'Select a topic from the research tree, then colonists study at Research Desks to progress it. Only one active project at a time. Additional desks contribute with diminishing returns.'],
                    ['Research Gates', 'Advanced technologies may require more than just a prerequisite tech. Some need specific buildings on the map, population milestones, or a minimum number of completed techs in their tab.'],
                    ['Research Tabs', 'The tree is organized into multiple tabs covering different progression paths: foundations, nature, arcane power, crafting, advanced magic, and void/exploration. Cross-tab prerequisites exist between them.'],
                    ['What Research Unlocks', 'New buildings, recipes, crops, spells, and capabilities. Browse the tree early to plan your progression path. Some powerful buildings and mechanics are locked behind multi-step research chains.'],
                ]
            },
            {
                subtitle: 'Magic System',
                entries: [
                    ['Learning Spells', 'Colonists learn spells by studying Spell Tomes at a Research Desk, prioritized by the Research skill. Each tome teaches one spell. Progress persists per-colonist, and completing a tome permanently grants that spell, destroying the tome in the process. Colonists will slowly study their tome while contributing to research topic progress. Additionally, colonists will study their tome at a faster pace if there\'s no research topic to contribute to.'],
                    ['Colonist Mana', 'Each colonist has a personal mana pool that grows as they level magic skills. Spells consume mana and go on cooldown. Mana regenerates passively over time or can be restored instantly via potions.'],
                    ['Auto-Cast', 'Colonists auto-cast known spells when appropriate conditions are met (healing when allies are hurt, buffing speed when working). Disable specific spells to conserve mana for higher-priority casts.'],
                    ['Magic Schools', 'Six schools of magic, each with a distinct role: Evocation (damage), Enchantment (work/movement buffs), Abjuration (healing and shields), Conjuration (summons and teleportation), Transmutation (crop growth and terrain manipulation), Divination (influencing fate and events).'],
                    ['Evocation', 'Offensive combat spells that damage enemies at range. Scales with the caster\'s Evocation skill level.'],
                    ['Enchantment', 'Buff spells that increase movement and work speed for everyday productivity. Helps colonists complete tasks faster. This skill is also used when determining equipment enchantment tiers.'],
                    ['Abjuration', 'Healing and defensive spells that keep colonists alive during raids and combat encounters.'],
                    ['Conjuration', 'Summon familiars, spirits, and golems to fight alongside your colonists or teleport them to safety.'],
                    ['Transmutation', 'Accelerate crop growth and reshape terrain. Powerful for farming-focused colonies.'],
                    ['Divination', 'Influence fate itself to delay incoming raids, attract trade caravans, suppress disasters, or shift the weather in your favor.'],
                ]
            },
            {
                subtitle: 'Mana Grid (Power)',
                entries: [
                    ['Net Mana', 'Mana Crystals generate power while magical buildings consume it. If total consumption exceeds generation, all powered buildings shut off. Monitor the net mana display to stay in the positive.'],
                    ['Mana Crystals', 'Your primary power source. You start with a limited build cap that increases through research and rare consumables. Each crystal generates a base amount of mana for the grid.'],
                    ['Mana Relays', 'Reduce mana consumption of nearby buildings. Place relays in clusters of powered buildings to stretch your mana budget further. The reduction does not stack from multiple relays.'],
                    ['Planning Your Grid', 'Balance generation versus consumption as you add powered buildings. Prioritize essential buildings (Ice Box, Ember Ward) and expand crystal capacity through research before adding luxury consumers.'],
                ]
            },
            {
                subtitle: 'Golems',
                entries: [
                    ['What Are Golems', 'Animated stone workers that never eat, sleep, or have mood. Each golem specializes in one task type and works tirelessly without any needs management.'],
                    ['Creating Golems', 'Build a Golem Forge (requires Golem Craft research) and craft golems using stone, runite, and void essence. Multiple types available, each specializing in a different skill.'],
                    ['Golem Limitations', 'Golems cannot learn spells, cannot grow in skill, and do not count toward your colonist cap. They are pure task specialists, reliable but inflexible.'],
                ]
            },
            {
                subtitle: 'Complex Structures',
                entries: [
                    ['Pattern Activation', 'Certain multi-tile building patterns activate powerful colony-wide bonuses when completed. Build the core piece, then surround it with the required layout. Destroying any part of the pattern deactivates the bonus.'],
                    ['Great Forge', 'A walled enclosure around a Forge Core that greatly increases all crafting speed (2.5x) and improves crafting quality (+2 bonus) colony-wide. Requires Masterwork research.</p><p><img style="border: 1px solid #ddd; width: 150px;" src="glossary_images/great_forge.png">'],
                    ['Ritual Circle', 'A diamond pattern of walls around a Ritual Core that reduces spell cooldowns by 30% for all colonists colony-wide. Requires Advanced Arcana research.</p><p><img style="border: 1px solid #ddd; width: 150px;" src="glossary_images/ritual_circle.png">'],
                ]
            },
        ]
    },
    {
        title: 'Combat & Exploration',
        subsections: [
            {
                subtitle: 'Combat',
                entries: [
                    ['How Combat Works', 'Melee weapons attack adjacent tiles whereas ranged weapons and spells attack from a distance (with the exception of melee spells like Smite). Colonists engage in battle with enemies that step too close, automatically attacking any threat within their weapon range.'],
                    ['Weapon Types', 'Three categories: Melee (swords, daggers, axes, and maces, all close range with attack varying speeds), Ranged (bows and crossbows for attacking from distance), and Magic (wands and staves for boosting spell damage and attacking at range). Higher-tier weapons within each category deal more damage or have better bonuses.'],
                    ['Armor & Defense', 'Body armor and helmets reduce incoming damage. Heavier armor provides more protection in exchange for fewer magical bonuses. The two slots stack together for combined damage reduction.'],
                    ['Drafting', 'Press Q to draft selected colonists for manual control. Drafted colonists ignore all tasks, including eating and sleeping, and move where you right-click. Box-select multiple colonists and Draft All for group control.'],
                ]
            },
            {
                subtitle: 'Defense',
                entries: [
                    ['Raids', 'Hostile raiders attack your colony periodically. Raid strength scales with your colony\'s wealth and how long you\'ve been playing. Disabled in Peaceful Mode.'],
                    ['Guard Mode', 'Assign colonists to guard a position. They patrol nearby and automatically engage threats within a wider radius than normal, while still eating and sleeping when needed.'],
                    ['Turrets & Wards', 'Arcane Sentinels and Void Turrets automatically attack enemies within range. Inferno Wards and Ember Wards damage or deter nearby hostiles. All defensive buildings consume mana from the grid.'],
                    ['Defensive Building', 'Use walls and doors to funnel enemies through chokepoints. Place turrets along the path they must take. Reinforce critical walls with higher-tier materials (Void Walls) for durability.'],
                    ['Peaceful Mode', 'A game setting that disables raids and hostile wildlife. The Void Nexus wave system still functions separately for players who want optional combat challenges.'],
                ]
            },
            {
                subtitle: 'Wave Defense',
                entries: [
                    ['Void Nexus', 'Build after researching Void Summoning. You can start wave challenges using the Portal menu (V). During a wave enemies spawn from portals and try to destroy the Nexus. Defend it from these attacks to earn rewards. Don\'t worry, if your Nexus is destroyed you can always build a new one to replace it.'],
                    ['How Waves Work', 'Each successive wave sends tougher and more numerous enemies. Defeat all enemies in a wave to complete it and unlock the next. Waves are strictly player-initiated, not automatic.'],
                    ['Colony Cap', 'Your maximum colonist count starts small. Completing Void Nexus waves is the primary way to increase it. Buildings like Hearth Shrines also add to the cap in exchange for mana from the grid.'],
                    ['Void Essence', 'Dropped by wave enemies. This rare resource is essential for crafting late-game equipment and advanced defensive structures.'],
                    ['Strategy', 'Build walls and doors to create funnels toward the Nexus. Place turrets at chokepoints. Draft your colonists or set them to Guard mode to protect the Nexus themselves. Upgrade weapons and armor between waves.'],
                ]
            },
            {
                subtitle: 'Exploration',
                entries: [
                    ['Rift Gate', 'Build after researching Planar Rift. Click to open the expedition panel and send parties to other realms for loot. The gate consumes mana while active.'],
                    ['Expedition Parties', 'Select up to five colonists and two pack animals. Choose a realm and difficulty level. Higher difficulty means tougher enemies but significantly better loot and rare item chances.'],
                    ['Realms', 'Multiple expedition chains, each with increasing depth. Deeper realms require completing the previous one first. Later chains require additional research to unlock.'],
                    ['Encounters', 'During expeditions, your party faces combat encounters, traps, and discoveries. Combat resolves in real-time rounds. Even on defeat, you keep items found before the loss. Colonists defeated during an expedition will always survive their retreat, re-joining the colony at extremely low health.'],
                    ['Pack Animals', 'Tamed okapi can join expeditions as pack animals, reducing expedition duration. Bring them for faster completion and more efficient loot runs. Pack animals do not participate in combat and always return home safely.'],
                ]
            },
            {
                subtitle: 'Trinkets',
                entries: [
                    ['What Are Trinkets', 'Powerful unique items with special effects. Some are equipped directly on colonists for personal bonuses while others are placed on Trinket Pedestals to project area or colony-wide effects.'],
                    ['Trinket Pedestals', 'Build after researching Arcane Infusion. Place a trinket on a pedestal to project its effect in a radius around it. Some trinkets have global effects that benefit the entire colony. Pedestals consume mana based on the placed trinket.'],
                    ['Equipped Trinkets', 'When worn by a colonist, these provide passive bonuses: increased move speed, work speed, combat power, or emergency auto-revival. Some have special expedition-only effects.'],
                    ['Durability & Repair', 'Certain powerful trinkets break after activating their effect. Broken trinkets provide no bonuses. Repair tasks take place at an Anvil using runite and are queued automatically.'],
                    ['Finding Trinkets', 'Found as expedition loot (each realm chain has signature drops), purchased from rare trader inventories, or occasionally crafted with end-game research and materials.'],
                ]
            },
        ]
    },
    {
        title: 'World & Controls',
        subsections: [
            {
                subtitle: 'Seasons & Weather',
                entries: [
                    ['Season Cycle', 'Four seasons rotate continuously: Spring, Summer, Autumn, Winter. Each season affects temperature, crop growth rates, animal spawns, and which events can occur.'],
                    ['Spring', 'Moderate temperatures and normal crop growth. Wild animals appear more frequently. A good season for expanding farms and taming animals.'],
                    ['Summer', 'The hottest season with the fastest crop growth, but food also spoils faster. Risk of heat waves and fire events. Plan extra food storage.'],
                    ['Autumn', 'Cooling temperatures with slightly slower crop growth. Animal migrations commonly pass through, providing hunting opportunities.'],
                    ['Winter', 'Cold temperatures halt most outdoor crop growth. Snow covers the ground. Colonists need warmth from Ember Wards, Inferno Wards, or indoor torches to avoid freezing.'],
                    ['Weather Effects', 'Rain boosts crop growth and extinguishes fires. Thunderstorms can start fires via lightning. Blizzards halt all crop growth entirely. Weather varies by season.'],
                ]
            },
            {
                subtitle: 'Farming',
                entries: [
                    ['Farm Zones', 'Press F to enter Farm Zone mode. Select a crop type, then drag an area on grass or dirt. Colonists with Farming skill will automatically plant and harvest crops in the zone.'],
                    ['Crop Growth', 'Growth speed is affected by the current season, weather conditions, and magic spells. By default most crops do not grow during the winter season.'],
                    ['Available Crops', 'Crops range from basic (available immediately) to advanced (requiring research). Each has different season compatibility, growth speed, and yield. Some crops, like the magical Moonbloom, grow in all seasons.'],
                    ['Crop Blight', 'A random event that destroys a portion of growing crops. More common in summer and autumn. Certain trinkets and Divination spells can reduce or outright prevent blights.'],
                ]
            },
            {
                subtitle: 'Wildlife & Taming',
                entries: [
                    ['Wild Animals', 'Various creatures roam the map. Passive animals (deer, rabbits, okapi) flee when approached. Hostile animals (wolves) attack colonists that get too close, especially at night and in winter.'],
                    ['Hunting', 'Select an animal and click Hunt to queue a hunting task. Colonists with Animals skill will pursue it and attack when able. Hunting yields meat and hides for cooking and crafting.'],
                    ['Taming', 'Build a Beast Circle (requires Beast Binding research) to tame wild animals. Taming requires food and Animals skill. Higher skill improves success chance.'],
                    ['Dangerous Tames', 'Some animals (wolves) fight back when taming fails. The colonist takes damage and gains negative mood. Higher Animals skill reduces failure risk.'],
                    ['Tamed Roles', 'Tamed animals serve different purposes: guard animals patrol and attack threats, pack animals speed up expeditions, production animals generate resources like eggs, and some rare animals even provide passive mood auras to nearby colonists.'],
                ]
            },
            {
                subtitle: 'Events',
                entries: [
                    ['Random Events', 'Various events trigger as your colony grows: new colonists arriving, trade caravans, crop blights, mineral windfalls, fires, cold snaps, animal migrations, and inspiration.'],
                    ['Wanderers', 'New colonists occasionally ask to join your colony. Wanderers are more likely when colony mood is high. Accept or reject based on their traits and skills. Once a wanderer joins your colony you will have no simple way to remove them from their new community.'],
                    ['Destructive Events', 'Fires spread to adjacent flammable tiles (colonists auto-extinguish). Crop blight destroys growing plants in summer/autumn. Cold snaps kill all outdoor crops in winter.'],
                ]
            },
            {
                subtitle: 'Controls',
                entries: [
                    ['Camera', 'WASD or Arrow keys to pan. +/- or scroll wheel to zoom. Middle-click drag to pan. Home to center on selection.'],
                    ['Speed & Pause', 'Space to pause/unpause. < and > to change game speed (three levels). [ and ] to cycle between colonists.'],
                    ['Selection', 'Click to select a colonist, animal, or tile. Drag to box-select multiple. E selects all colonists. N jumps to next idle colonist.'],
                    ['Modes', 'B for Build mode, F for Farm Zone mode, G for Gather/Designate mode. X toggles deconstruct while in Build mode.'],
                    ['Panels', 'P (Priority), C (Craft), R (Research), I (Inventory), V (Arcane), J (Story). Esc closes any open panel.'],
                    ['Combat Controls', 'Q drafts/undrafts selected colonists. Right-click moves drafted colonists. Number keys 1-9 cast the selected colonist\'s controllable spells.'],
                    ['Keybindings', 'All keys can be remapped in Settings under Controls / Keybindings.'],
                ]
            },
            {
                subtitle: 'Map Symbols (ASCII-mode)',
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
                    ['◆', 'Trinket Pedestal', '#ccaa44'],
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
                html += `<div class="glossary-entry" style="margin:4px 0;"><b style="color:#fff">${term}</b> - ${parts[0]}</div>`;
                html += `<pre style="margin:2px 0 8px 12px; color:#aaa; font-size:11px; line-height:1.4;">${parts.slice(1).join('\n')}</pre>`;
            } else {
                html += `<div class="glossary-entry" style="margin:4px 0;"><b style="color:#fff">${term}</b> - ${desc}</div>`;
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
                                matches.push(`<b style="color:#fff">${term}</b> - ${parts[0]}<pre style="margin:2px 0 4px 12px; color:#aaa; font-size:11px; line-height:1.4;">${parts.slice(1).join('\n')}</pre>`);
                            } else {
                                matches.push(`<b style="color:#fff">${term}</b> - ${desc}`);
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
