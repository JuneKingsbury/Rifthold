export const CHANGELOG = [
    { date: '2026-08-06', message: 'Colonists can now socialize with each other and develop relationships. Also added more colonist trait options.' },
    { date: '2026-08-04', message: 'Room Quality system: enclosed rooms are now scored (0-100) based on size, flooring, lighting, decorations, and wall quality — nicer bedrooms give better mood bonuses when sleeping' },
    { date: '2026-08-04', message: 'Workshop Quality system: rooms with crafting stations score based on size, flooring, lighting, station focus (dedicated rooms score higher), and support furniture — grants up to +25% craft speed and +3 virtual skill for quality rolls' },
    { date: '2026-08-04', message: 'Station Focus bonus: rooms with a single workstation group (Smithy, Kitchen, Workshop, Scriptorium, Laboratory) get a large quality bonus — dedicated rooms outperform cluttered ones' },
    { date: '2026-08-04', message: 'New Scriptorium workstation: dedicated tome-crafting station unlocked with Arcane Studies research — all spell tome recipes moved here from the Enchanting Table' },
    { date: '2026-08-04', message: 'New decorative furniture: Rug, Shelf, Chair, Bookcase — place in rooms to boost bedroom quality' },
    { date: '2026-08-04', message: 'New workshop support furniture: Tool Rack, Material Shelf — place in workshops to boost crafting bonuses' },
    { date: '2026-08-04', message: 'Room quality breakdown shown in tile info panel — see exactly what contributes to your room score and current bonuses' },
    { date: '2026-08-03', message: 'Entities no longer hide buildings/furniture underneath them — transparent sprite areas reveal the structure below' },
    { date: '2026-08-03', message: 'Terrain dithering intensity setting: Off, Minimal, Light, Normal, Heavy, Extreme (Settings > Visual)' },
    { date: '2026-08-03', message: 'Separate sleeping sprites: colonists sleeping in a bed vs on the ground use different sprites' },
    { date: '2026-08-03', message: 'Inventory Resources tab reorganized into sections: Building Materials, Foodstuffs, and Other' },
    { date: '2026-08-03', message: 'Resource bar shows sprite icons instead of text labels — cleaner top-left HUD with only key resources' },
    { date: '2026-08-03', message: 'Crafting panel items sorted by tier within each equipment tab (T1 bows no longer buried at bottom)' },
    { date: '2026-08-03', message: 'Crafting panel split: Equipment tab replaced with separate Weapons, Armor, and Tools tabs' },
    { date: '2026-08-03', message: 'Tier-based filter buttons on Weapons/Armor/Tools tabs to hide lower-tier clutter' },
    { date: '2026-08-03', message: 'Tome filtering: school-of-magic dropdown and minimum spell level filter buttons' },
    { date: '2026-08-03', message: 'Material sprites supported in skin editor — 20 resource entries available under Materials category' },
    { date: '2026-08-03', message: 'Sleeping colonist sprite added to skin editor (shared single sprite for all colonist variants)' },
    { date: '2026-07-29', message: 'Ranged weapons: Short Bow, Hunting Bow, Iron Crossbow, Runic Crossbow, Void Longbow — colonists fire projectiles at enemies from a distance' },
    { date: '2026-07-29', message: 'Wands and staffs now have range — spellcasters stay at distance instead of closing to melee' },
    { date: '2026-07-29', message: 'New spell: Smite (Evocation, melee-range burst damage) with craftable Tome of Smite' },
    { date: '2026-07-29', message: 'Visual effects overhaul: 19 new ambient/combat effects (craft sparks, sleep Zzz, death skulls, shield blocks, harvest swirls, mine dust, and more)' },
    { date: '2026-07-29', message: 'Screen flash overlay on wave start for dramatic wave alerts' },
    { date: '2026-07-29', message: 'Floor/terrain sprites now remain visible underneath ASCII effect characters in sprite mode' },
    { date: '2026-07-29', message: 'Removed redundant melee hit indicator (!) — damage flash now handles combat feedback' },
    { date: '2026-07-27', message: 'Critical colonist alerts: proactive warnings when colonists are near starvation, mental break, or freezing' },
    { date: '2026-07-27', message: 'Auto-craft system: toggle repeat on any recipe or set a stock target to maintain automatically' },
    { date: '2026-07-27', message: 'Expedition strength preview: party power rating (Easy/Fair/Tough/Dangerous/Suicidal) shown during setup' },
    { date: '2026-07-27', message: 'Auto-assign beds: newly built beds and arriving colonists automatically pair up' },
    { date: '2026-07-27', message: 'Auto-cook control fixed for mobile: replaced slider with +/- buttons and number input' },
    { date: '2026-07-27', message: 'Equipment effects summary shown below gear slots in colonist info panel' },
    { date: '2026-07-27', message: 'Removed Tame panel — taming info is in the glossary, animals are in inventory' },
    { date: '2026-07-27', message: 'Helmet slot: new headgear equipment slot with 4 helmets (Leather Cap, Iron Helmet, Runic Helm, Void Crown)' },
    { date: '2026-07-27', message: 'Paper-doll equipment grid: colonist info shows gear in a person-shaped 2x3 layout — click slots to equip' },
    { date: '2026-07-27', message: 'Equipment expansion: 7 new weapons, 5 new armors across all progression tiers' },
    { date: '2026-07-27', message: 'New materials: iron ore (mining) and hides/leather (hunting) for mid-tier equipment' },
    { date: '2026-07-27', message: 'Tool system overhaul: 15 tools across 5 categories (Pickaxe, Axe, Sickle, Hammer, Mattock) × 3 material tiers (Stone → Iron → Runic)' },
    { date: '2026-07-27', message: 'Mattock tools: multi-purpose mining + chopping at slightly lower efficiency than specialists' },
    { date: '2026-07-27', message: 'Hammer tools: new crafting speed bonus for faster crafting and cooking tasks' },
    { date: '2026-07-27', message: 'Crafting quality system: skill-based rolls produce Crude/Fine/Superior items with stat modifiers' },
    { date: '2026-07-27', message: 'Salvage system: recycle unwanted equipment for partial resource recovery' },
    { date: '2026-07-27', message: 'Fixed unreachableFailers crash on game load — uses plain object instead of Set for JSON compatibility' },
    { date: '2026-07-27', message: 'Deconstruct toggle button in build mode — works on mobile and for users without right-click (press X or click button)' },
    { date: '2026-07-27', message: 'Mobile crafting tabs now scrollable horizontally' },
    { date: '2026-07-24', message: 'Expedition difficulty selector: 5 levels (Normal to Suicidal) with scaling enemies, traps, loot, and rare find chances' },
    { date: '2026-07-24', message: 'Expedition visualization: diagonal perspective for finish line, room dividers, and party positioning' },
    { date: '2026-07-24', message: 'Expedition visualization: pack animals form a separate line behind colonists, smoother finish line rendering' },
    { date: '2026-07-24', message: 'Expedition walk-off animation slowed for a more satisfying completion feel' },
    { date: '2026-07-24', message: 'Raid scaling overhaul: raids now scale with both colony wealth AND time (ramp over 3 years). Early raids are much gentler' },
    { date: '2026-07-24', message: 'Mana crystal limit of 4, upgradeable with Crystal Capacitor consumable (from trades/expeditions)' },
    { date: '2026-07-24', message: 'Consumable item system: items appear in inventory with Use button (generalizable for future items)' },
    { date: '2026-07-24', message: 'ASCII item icons in inventory, equipment, and trade panels (configurable per-category in config.js)' },
    { date: '2026-07-24', message: 'Expedition party selection now shows combat stats: HP, Damage, Defense%, and Threat priority' },
    { date: '2026-07-24', message: 'Pack animal visuals in expedition canvas + enforced limits (5 colonists, 2 pack animals)' },
    { date: '2026-07-24', message: 'Save button moved to top of settings menu for easy access' },
    { date: '2026-07-24', message: 'Events now properly unpause when dismissed while portal panel is open' },
    { date: '2026-07-24', message: 'Raider sprites used for expedition enemies when skin is active' },
    { date: '2026-07-23', message: 'Artifacts system: 14 artifacts with pedestal placement, AoE/global effects, combat targeting, expedition bonuses, durability & anvil repair' },
    { date: '2026-07-23', message: 'New buildings: Artifact Pedestal (place artifacts for radius buffs) and Anvil (repair broken artifacts)' },
    { date: '2026-07-23', message: 'Radius visualization: selecting pedestals, turrets, or heaters highlights affected tiles' },
    { date: '2026-07-23', message: 'Expedition loot is now kept even if all party members are defeated' },
    { date: '2026-07-23', message: 'Performance: Map-based O(1) colonist/task lookups, reusable renderer buffers, precomputed night lighting grid' },
    { date: '2026-07-23', message: 'Balance pass: ~2x longer mid-to-endgame (research costs, craft times, exploration durations, tome learning)' },
    { date: '2026-07-23', message: 'Raider AI overhaul: individual flee at 25% HP, group rout at 75% casualties, longer safety timeout' },
    { date: '2026-07-23', message: 'Dead colonists now sort to bottom of Colonists panel' },
    { date: '2026-07-23', message: 'New games start at 6:00 AM instead of midnight' },
    { date: '2026-07-23', message: 'Fix trader UI bug and add QoL to exploration info panel and easier to use starting screen' },
    { date: '2026-07-23', message: 'Way better glossary and exploration systems' },
    { date: '2026-07-23', message: 'Several todo list items like wolf taming and golems' },
    { date: '2026-07-23', message: 'Auto derived glossary from README.md' },
    { date: '2026-07-23', message: 'Wilderness update to make animals easier to extend' },
    { date: '2026-07-23', message: 'Divination school spells' },
    { date: '2026-07-23', message: 'Magic system and spell learning' },
    { date: '2026-07-23', message: 'Fixed config order' },
    { date: '2026-07-22', message: 'Reorganized config.js to make more sense to look at' },
    { date: '2026-07-22', message: 'Build list categorizing' },
    { date: '2026-07-22', message: 'Working on animal systems' },
    { date: '2026-07-22', message: 'Better research, multiple research benches allow for multiple colonists to work' },
    { date: '2026-07-20', message: 'Looking into unreachableFailers.add issue on game load' },
    { date: '2026-07-20', message: 'New overlay graphics, start of expedition system, food spoilage' },
    { date: '2026-07-18', message: 'Magic system todo' },
    { date: '2026-07-18', message: 'Dream todo list' },
    { date: '2026-07-17', message: 'Better recipes and randomized names' },
    { date: '2026-07-17', message: 'QoL changes' },
    { date: '2026-07-17', message: 'More item options and potions' },
    { date: '2026-07-17', message: 'More map generation options' },
    { date: '2026-07-17', message: 'All in config.js if possible' },
    { date: '2026-07-17', message: 'Better winter look and mobile top bar fix' },
    { date: '2026-07-17', message: 'Day-night light' },
    { date: '2026-07-17', message: 'Even more config.js centric extensibility' },
    { date: '2026-07-16', message: 'Fix mobile bug where info panel does not update when we go-to it' },
    { date: '2026-07-16', message: 'Reorganize file structure and improve color usability' },
    { date: '2026-07-16', message: 'Better colors' },
    { date: '2026-07-16', message: 'Big efficiency changes' },
    { date: '2026-07-16', message: 'Even more reliance on config.js' },
    { date: '2026-07-16', message: 'config.js overhaul' },
    { date: '2026-07-16', message: 'UI cleanup and tooltips' },
    { date: '2026-07-16', message: 'Way better mobile support' },
    { date: '2026-07-15', message: 'Implement wave system with void nexus defense mechanics' },
    { date: '2026-07-14', message: 'Add more names to COLONIST_NAMES array' },
    { date: '2026-07-14', message: 'UI overhaul' },
    { date: '2026-07-14', message: 'Clean up duplicate glossary entries' },
    { date: '2026-07-14', message: 'Enhance README with About section and heading updates' },
    { date: '2026-07-14', message: 'Enhance README with game mechanics and glossary' },
    { date: '2026-07-14', message: 'Fixing more bugs where buttons are destroyed mid-click' },
    { date: '2026-07-14', message: 'Optimize research panel HTML update logic' },
    { date: '2026-07-13', message: 'Add files via upload' },
    { date: '2026-07-13', message: 'Initial commit' },
];

export function renderChangelogHTML() {
    let html = '<div style="margin-bottom:12px;"><input type="text" id="changelog-search" placeholder="Search changelog..." style="width:100%;padding:6px 8px;background:#2a2a3e;border:1px solid #555;border-radius:4px;color:#ccc;font-family:inherit;font-size:12px;"></div>';
    html += '<div id="changelog-list">';
    html += _buildChangelogList(CHANGELOG);
    html += '</div>';
    return html;
}

function _buildChangelogList(entries) {
    let html = '';
    let lastDate = '';
    for (const entry of entries) {
        if (entry.date !== lastDate) {
            lastDate = entry.date;
            html += `<div style="color:#aaccff;font-weight:bold;margin-top:10px;margin-bottom:4px;font-size:11px;">${entry.date}</div>`;
        }
        html += `<div style="padding:2px 0 2px 12px;color:#ccc;font-size:12px;border-left:2px solid #444;margin-left:4px;">• ${entry.message}</div>`;
    }
    return html;
}

export function initChangelogInteraction() {
    const search = document.getElementById('changelog-search');
    const list = document.getElementById('changelog-list');
    if (!search || !list) return;
    search.addEventListener('input', () => {
        const q = search.value.toLowerCase().trim();
        if (!q) {
            list.innerHTML = _buildChangelogList(CHANGELOG);
            return;
        }
        const filtered = CHANGELOG.filter(e => e.message.toLowerCase().includes(q) || e.date.includes(q));
        list.innerHTML = filtered.length ? _buildChangelogList(filtered) : '<div style="color:#666;padding:8px;">No matching entries.</div>';
    });
}

export function renderCreditsHTML() {
    return `
<div style="text-align:center; padding:20px 0;">
    <div style="color:#ffcc00; font-size:16px; font-weight:bold; margin-bottom:16px;">Arcanum</div>
    <div style="color:#aaa; margin-bottom:20px;">A browser-based magical colony sim</div>
    <div style="color:#ccc; margin-bottom:8px;"><b>Design & Development</b></div>
    <div style="color:#aaa; margin-bottom:20px;">June "Mars" Kingsbury</div>
    <div style="color:#ccc; margin-bottom:8px;"><b>Built With</b></div>
    <div style="color:#aaa; margin-bottom:4px;">Vanilla JavaScript, HTML5 Canvas</div>
    <div style="color:#aaa; margin-bottom:20px;">jszip for skin ZIP file handling</div>
    <div style="color:#ccc; margin-bottom:8px;"><b>Additional Sprites</b></div>
    <div style="color:#aaa; margin-bottom:4px;"><a style="color:#aaa;" href="https://merchant-shade.itch.io/16x16-mini-world-sprites">Mini World</a> by Shade</div>
    <div style="color:#aaa; margin-bottom:4px;"><a style="color:#aaa;" href="https://merchant-shade.itch.io/16x16-puny-world">Puny World</a> by Shade</div>
    <div style="color:#aaa; margin-bottom:4px;"><a style="color:#aaa;" href="https://merchant-shade.itch.io/16x16-puny-dungeon">Puny Dungeon</a> by Shade</div>
    <div style="color:#aaa; margin-bottom:4px;"><a style="color:#aaa;" href="https://glionox.itch.io/items16">16x16 Items</a> by Glionox</div>
    <div style="color:#666; font-size:10px; margin-top:20px;">Version 0.1 — July 2026</div>
</div>`;
}
