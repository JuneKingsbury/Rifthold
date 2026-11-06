import { MAGIC_SKILLS } from '../core/config.js';
import { t } from '../core/i18n.js';
import { escapeAttr, escapeHtml } from './ui-utils.js';

export const GLOSSARY = [
    {
        id: 'colonists_needs',
        subsections: [
            {
                id: 'races',
                entries: [
                    'races_overview',
                    'human',
                    'nymph',
                    'ferin',
                    'kobalos',
                    'bufos',
                ]
            },
            {
                id: 'needs_mood',
                entries: [
                    'hunger',
                    'rest',
                    'mood',
                    'mood_levels',
                    'thoughts',
                    'mental_breaks',
                    'critical_alerts',
                ]
            },
            {
                id: 'traits',
                entries: [
                    'traits_overview',
                    'work_traits',
                    'survival_traits',
                    'combat_traits',
                    'social_traits',
                    'food_traits',
                    'animal_traits',
                    'magic_traits',
                    'expedition_traits',
                    'trade_traits',
                    'rare_traits',
                ]
            },
            {
                id: 'skills_health',
                entries: [
                    'skills',
                    'skill_leveling',
                    'health',
                    'equipment_slots',
                    'active_effects',
                ]
            },
            {
                id: 'colony_population',
                entries: [
                    'colony_cap',
                    'colony_milestones',
                ]
            },
        ]
    },
    {
        id: 'relationships_social',
        subsections: [
            {
                id: 'social_system',
                entries: [
                    'socializing',
                    'opinion',
                    'relationship_tiers',
                    'interactions',
                    'thoughts_mood',
                    'trait_influence',
                ]
            },
        ]
    },
    {
        id: 'work_tasks',
        subsections: [
            {
                id: 'task_system',
                entries: [
                    'how_tasks_work',
                    'priorities',
                    'work_speed',
                    'tool_bonuses',
                    'mood_work_speed',
                    'idle_behavior',
                ]
            },
            {
                id: 'room_workshop_quality',
                entries: [
                    'bedrooms',
                    'workshops',
                    'town_hall',
                    'furniture_types',
                ]
            },
        ]
    },
    {
        id: 'building_resources',
        subsections: [
            {
                id: 'construction',
                entries: [
                    'placing_buildings',
                    'resource_costs',
                    'structure_hp',
                    'rooms',
                    'deconstruction',
                    'research_gated_buildings',
                ]
            },
            {
                id: 'resources',
                entries: [
                    'global_stockpile',
                    'gathering_resources',
                    'processed_materials',
                    'food_decay',
                ]
            },
        ]
    },
    {
        id: 'crafting_production',
        subsections: [
            {
                id: 'crafting_system',
                entries: [
                    'crafting_stations',
                    'how_crafting_works',
                    'quality_tiers',
                    'enchantment_effects',
                    'auto_craft_auto_cook',
                    'salvage',
                ]
            },
            {
                id: 'cooking_potions',
                entries: [
                    'cooking',
                    'food_sources',
                    'potions',
                ]
            },
            {
                id: 'trading',
                entries: [
                    'trade_caravans',
                    'exclusive_items',
                    'trade_research',
                    'trade_rift',
                    'merchant_types',
                ]
            },
        ]
    },
    {
        id: 'research_magic',
        subsections: [
            {
                id: 'research',
                entries: [
                    'how_research_works',
                    'research_gates',
                    'research_tabs',
                    'what_research_unlocks',
                ]
            },
            {
                id: 'magic_system',
                entries: [
                    'learning_spells',
                    'colonist_mana',
                    'auto_cast',
                    'magic_schools',
                    { id: 'evocation', school: 'evocation' },
                    { id: 'enchantment', school: 'enchantment' },
                    { id: 'abjuration', school: 'abjuration' },
                    { id: 'conjuration', school: 'conjuration' },
                    { id: 'transmutation', school: 'transmutation' },
                    { id: 'divination', school: 'divination', withText: true },
                ]
            },
            {
                id: 'mana_grid_power',
                entries: [
                    'net_mana',
                    'power_priority',
                    'mana_crystals',
                    'mana_relays',
                    'planning_your_grid',
                ]
            },
            {
                id: 'golems',
                entries: [
                    'what_are_golems',
                    'creating_golems',
                    'golem_limitations',
                ]
            },
            {
                id: 'complex_structures',
                entries: [
                    'pattern_activation',
                    'arcane_core',
                    'great_forge',
                    'ritual_circle',
                    'anvil_shrine',
                    'star_ward',
                    'harvest_sigil',
                    'watchers_eye',
                    'scholars_ring',
                    'grand_altar',
                ]
            },
        ]
    },
    {
        id: 'combat_exploration',
        subsections: [
            {
                id: 'combat',
                entries: [
                    'how_combat_works',
                    'weapon_types',
                    'armor_defense',
                    'drafting',
                ]
            },
            {
                id: 'defense',
                entries: [
                    'raids',
                    'guard_mode',
                    'turrets_wards',
                    'defensive_building',
                    'peaceful_mode',
                ]
            },
            {
                id: 'wave_defense',
                entries: [
                    'void_nexus',
                    'how_waves_work',
                    'void_essence',
                    'strategy',
                ]
            },
            {
                id: 'exploration',
                entries: [
                    'rift_gate',
                    'expedition_parties',
                    'formation',
                    'party_synergy',
                    'expedition_fatigue',
                    'expedition_xp',
                    'war_beasts',
                    'party_presets',
                    'auto_expedition',
                    'realms',
                    'encounters',
                    'pack_animals',
                ]
            },
            {
                id: 'ancient_crypts',
                entries: [
                    'ancient_crypts',
                    'breaching_a_crypt',
                    'crypt_wards',
                    'crypt_guardians_traps',
                    'crypt_chests',
                    'rift_anchors',
                    'crypt_themes',
                ]
            },
            {
                id: 'trinkets',
                entries: [
                    'what_are_trinkets',
                    'trinket_pedestals',
                    'pedestal_overcharge',
                    'equipped_trinkets',
                    'durability_repair',
                    'finding_trinkets',
                ]
            },
        ]
    },
    {
        id: 'world_controls',
        subsections: [
            {
                id: 'seasons_weather',
                entries: [
                    'season_cycle',
                    'spring',
                    'summer',
                    'autumn',
                    'winter',
                    'weather_effects',
                    'winter_feast',
                ]
            },
            {
                id: 'farming',
                entries: [
                    'farm_zones',
                    'crop_growth',
                    'available_crops',
                    'creeping_miasma',
                    'blight_blooms',
                ]
            },
            {
                id: 'wildlife_taming',
                entries: [
                    'wild_animals',
                    'hunting',
                    'taming',
                    'dangerous_tames',
                    'tamed_roles',
                ]
            },
            {
                id: 'events',
                entries: [
                    'random_events',
                    'wanderers',
                    'destructive_events',
                ]
            },
            {
                id: 'controls',
                entries: [
                    'camera',
                    { id: 'pause_speed', params: { slower_key: '<', faster_key: '>' } },
                    'selection',
                    'modes',
                    'panels',
                    'overlays',
                    'combat_controls',
                    'keybindings',
                ]
            },
            {
                id: 'map_symbols_ascii_mode',
                symbols: [
                    ['.', 'grass', '#22aa22'],
                    [',', 'dirt', '#88aa44'],
                    ['#', 'rock_slow', '#666666'],
                    ['▲', 'tall_rock_impassable', '#444444'],
                    ['~', 'water_slow', '#4488cc'],
                    ['T', 'tree', '#228822'],
                    ['o', 'stone_iron_runite_deposit', '#aaaaaa'],
                    ['@', 'colonist', '#00ccff'],
                    ['R', 'raider', '#ff6600'],
                    ['E', 'void_enemy', '#ff2222'],
                    ['V', 'void_nexus', '#9933ff'],
                    ['▓', 'void_wall', '#6622aa'],
                    ['Y', 'void_turret', '#aa33ff'],
                    ['Ω', 'rift_gate', '#66aaff'],
                    ['✧', 'dormant_rift_anchor', '#66c8ff'],
                    ['✦', 'attuned_rift_anchor', '#aaf0ff'],
                    ['▣', 'crypt_chest', '#d4a84a'],
                    ['▢', 'looted_chest', '#7a6a44'],
                    ['▦', 'warded_wall', '#9d7fe0'],
                    ['Ğ', 'golem_forge', '#cc8833'],
                    ['⚒', 'forge_core', '#ff8844'],
                    ['◎', 'ritual_core', '#aa44ff'],
                    ['◌', 'ritual_chalk', '#cc99ff'],
                    ['◆', 'trinket_pedestal', '#ccaa44'],
                    ['⌂', 'anvil', '#999999'],
                    ['Ħ', 'inferno_ward', '#ff4400'],
                    ['⊛', 'mana_relay', '#aa88ff'],
                    ['☀', 'beacon', '#ffffaa'],
                    ['╬', 'reinforced_door', '#aa8855'],
                    ['G', 'golem', '#888888'],
                    ['*', 'turret_beam', '#ff4444'],
                ]
            },
        ]
    },
];

// Section and subsection titles, entry terms and texts are looked up from
// glossary.<section>.<subsection>.<entry>.term/.text. Magic school entries
// reuse the school's config name and summary.
function sectionTitle(section) {
    return t(`glossary.${section.id}.title`);
}

function subsectionTitle(section, sub) {
    return t(`glossary.${section.id}.${sub.id}.subtitle`);
}

// Returns [term, text] for an entry: an id string, { id, params } for text with
// placeholders, or { id, school, withText } for a magic school.
function entryText(section, sub, entry) {
    const prefix = `glossary.${section.id}.${sub.id}`;
    if (typeof entry === 'string') {
        return [t(`${prefix}.${entry}.term`), t(`${prefix}.${entry}.text`)];
    }
    if (!entry.school) {
        return [t(`${prefix}.${entry.id}.term`), t(`${prefix}.${entry.id}.text`, entry.params)];
    }
    const school = MAGIC_SKILLS[entry.school];
    const text = entry.withText ? t(`${prefix}.${entry.id}.text`, { summary: school.summary }) : school.summary;
    return [school.name, text];
}

function symbolLabel(section, sub, labelId) {
    return t(`glossary.${section.id}.${sub.id}.${labelId}.label`);
}

function renderSubsectionContent(section, sub) {
    let html = '';
    if (sub.symbols) {
        html += '<div style="font-family:monospace; color:#aaa; line-height:2;">';
        for (const [char, labelId, color] of sub.symbols) {
            html += `<span class="glossary-entry"><span style="color:${color}; font-size:14px;">${escapeHtml(char)}</span> ${escapeHtml(symbolLabel(section, sub, labelId))} &nbsp;&nbsp;</span>`;
        }
        html += '</div>';
    } else if (sub.entries) {
        for (const entry of sub.entries) {
            const [term, desc] = entryText(section, sub, entry);
            if (desc.includes('\n')) {
                const parts = desc.split('\n');
                html += `<div class="glossary-entry" style="margin:4px 0;"><b style="color:#fff">${escapeHtml(term)}</b> - ${escapeHtml(parts[0])}</div>`;
                html += `<pre style="margin:2px 0 8px 12px; color:#aaa; font-size:11px; line-height:1.4;">${escapeHtml(parts.slice(1).join('\n'))}</pre>`;
            } else {
                html += `<div class="glossary-entry" style="margin:4px 0;"><b style="color:#fff">${escapeHtml(term)}</b> - ${escapeHtml(desc)}</div>`;
            }
        }
    }
    return html;
}

export function renderGlossaryHTML() {
    let html = '';
    html += `<input type="text" id="glossary-search" placeholder="${escapeAttr(t('glossary.ui.search_placeholder'))}" style="width:100%; padding:6px 10px; margin-bottom:10px; background:#2a2a4a; border:1px solid #555; border-radius:4px; color:#eee; font-size:12px; font-family:inherit; outline:none;">`;

    html += `<div id="glossary-tabs" style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:10px;">`;
    for (let i = 0; i < GLOSSARY.length; i++) {
        html += `<button class="glossary-tab-btn" data-tab="${i}" style="padding:3px 8px; background:${i === 0 ? '#446' : '#2a2a4a'}; border:1px solid #555; border-radius:3px; color:${i === 0 ? '#88ccff' : '#888'}; font-size:11px; cursor:pointer; font-family:inherit;">${escapeHtml(sectionTitle(GLOSSARY[i]))}</button>`;
    }
    html += `</div>`;

    html += `<div id="glossary-content">`;
    for (let i = 0; i < GLOSSARY.length; i++) {
        const section = GLOSSARY[i];
        html += `<div class="glossary-section" data-section="${i}" style="display:${i === 0 ? 'block' : 'none'}">`;
        for (const sub of section.subsections) {
            html += `<div style="color:#88ccff; font-weight:bold; margin:12px 0 6px 0; font-size:12px; border-bottom:1px solid #333; padding-bottom:3px;">${escapeHtml(subsectionTitle(section, sub))}</div>`;
            html += renderSubsectionContent(section, sub);
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
            window.soundManager?.playSFXPitched('button_click', 0);
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
            for (const sub of section.subsections) {
                const matches = [];
                const label = subsectionTitle(section, sub);
                if (sub.symbols) {
                    for (const [char, labelId, color] of sub.symbols) {
                        const lbl = symbolLabel(section, sub, labelId);
                        if (`${char} ${lbl}`.toLowerCase().includes(query)) {
                            matches.push(`<span style="color:${color}; font-size:14px;">${escapeHtml(char)}</span> ${escapeHtml(lbl)}`);
                        }
                    }
                } else if (sub.entries) {
                    for (const entry of sub.entries) {
                        const [term, desc] = entryText(section, sub, entry);
                        if (`${term} ${desc}`.toLowerCase().includes(query)) {
                            if (desc.includes('\n')) {
                                const parts = desc.split('\n');
                                matches.push(`<b style="color:#fff">${escapeHtml(term)}</b> - ${escapeHtml(parts[0])}<pre style="margin:2px 0 4px 12px; color:#aaa; font-size:11px; line-height:1.4;">${escapeHtml(parts.slice(1).join('\n'))}</pre>`);
                            } else {
                                matches.push(`<b style="color:#fff">${escapeHtml(term)}</b> - ${escapeHtml(desc)}`);
                            }
                        }
                    }
                }
                if (matches.length > 0) {
                    html += `<div style="color:#88ccff; font-weight:bold; margin-top:8px; margin-bottom:4px; font-size:11px;">${escapeHtml(label)}</div>`;
                    for (const m of matches) {
                        html += `<div style="margin:3px 0;">${m}</div>`;
                    }
                }
            }
        }
        results.innerHTML = html || `<div style="color:#888; margin-top:10px;">${escapeHtml(t('glossary.ui.no_results'))}</div>`;
    });
}
