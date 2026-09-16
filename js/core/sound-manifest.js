export const SOUND_MANIFEST = {
    sfx: {
        colonist_damaged: 'audio/sfx/combat/colonist_damaged.ogg',
        colonist_death: 'audio/sfx/combat/colonist_death.ogg',
        enemy_death: 'audio/sfx/combat/enemy_death.ogg',
        critical_hit: 'audio/sfx/combat/critical_hit.ogg',
        shield_block: 'audio/sfx/combat/shield_block.ogg',
        loot_drop: 'audio/sfx/combat/loot_drop.ogg',
        arrow_fire: 'audio/sfx/combat/arrow_fire.ogg',
        bolt_fire: 'audio/sfx/combat/bolt_fire.ogg',
        turret_fire: 'audio/sfx/combat/turret_fire.ogg',

        spell_cast: 'audio/sfx/spells/spell_cast.ogg',
        spell_heal: 'audio/sfx/spells/spell_heal.ogg',
        spell_buff: 'audio/sfx/spells/spell_buff.ogg',
        spell_shield: 'audio/sfx/spells/spell_shield.ogg',
        spell_teleport: 'audio/sfx/spells/spell_teleport.ogg',
        spell_growth: 'audio/sfx/spells/spell_growth.ogg',
        spell_terraform: 'audio/sfx/spells/spell_terraform.ogg',
        spell_divination: 'audio/sfx/spells/spell_divination.ogg',
        magic_levelup: 'audio/sfx/spells/magic_levelup.ogg',
        mana_regen: 'audio/sfx/spells/mana_regen.ogg',
        summon_arrival: 'audio/sfx/spells/summon_arrival.ogg',
        golem_activate: 'audio/sfx/spells/golem_activate.ogg',

        build_complete: 'audio/sfx/work/build_complete.ogg',
        craft_complete: 'audio/sfx/work/craft_complete.ogg',
        research_complete: 'audio/sfx/work/research_complete.ogg',
        enchant_complete: 'audio/sfx/work/enchant_complete.ogg',
        harvest: 'audio/sfx/work/harvest.ogg',
        mine_hit: 'audio/sfx/work/mine_hit.ogg',
        chop_hit: 'audio/sfx/work/chop_hit.ogg',

        // Environment — file paths are wired up; add .ogg files to audio/sfx/environment/ to activate
        fire_ignite: 'audio/sfx/environment/fire_ignite.ogg',
        freezing: 'audio/sfx/environment/freezing.ogg',
        rain_start: 'audio/sfx/environment/rain_start.ogg',
        thunder_crack: 'audio/sfx/environment/thunder_crack.ogg',
        blizzard_start: 'audio/sfx/environment/blizzard_start.ogg',
        snow_start: 'audio/sfx/environment/snow_start.ogg',
        heatwave_start: 'audio/sfx/environment/heatwave_start.ogg',
        weather_clear: 'audio/sfx/environment/weather_clear.ogg',

        button_click: 'audio/sfx/ui/button_click.ogg',
        open_close_click: 'audio/sfx/ui/open_close_click.ogg',
        notification: 'audio/sfx/ui/notification.ogg',
        wave_alert: 'audio/sfx/ui/wave_alert.ogg',
        mental_break: 'audio/sfx/ui/mental_break.ogg',
    },
    music: {
        ambient_day: 'audio/music/ambient_day.ogg',
        ambient_night: 'audio/music/ambient_night.ogg',
        combat: 'audio/music/combat.ogg',
        menu_theme: 'audio/music/menu_theme.ogg',
        credits: 'audio/music/credits.ogg',

        // Expedition: plays while a party is exploring a realm.
        // expedition.ogg is the generic fallback used when no realm-specific track is present.
        expedition: 'audio/music/expedition.ogg',

        // Optional per-realm tracks. Each key is 'expedition_' + realmKey.
        // If the file is absent the game falls back to expedition.ogg automatically.
        // Crystal chain
        expedition_crystal_caves:   'audio/music/expedition_crystal_caves.ogg',
        expedition_crystal_mines:   'audio/music/expedition_crystal_mines.ogg',
        expedition_crystal_depths:  'audio/music/expedition_crystal_depths.ogg',
        // Verdant chain
        expedition_verdant_depths:  'audio/music/expedition_verdant_depths.ogg',
        expedition_fungal_hollows:  'audio/music/expedition_fungal_hollows.ogg',
        expedition_primeval_canopy: 'audio/music/expedition_primeval_canopy.ogg',
        // Arcane chain
        expedition_arcane_library:       'audio/music/expedition_arcane_library.ogg',
        expedition_ancient_university:   'audio/music/expedition_ancient_university.ogg',
        expedition_abandoned_laboratory: 'audio/music/expedition_abandoned_laboratory.ogg',
        // Shadow chain
        expedition_shadow_realm:   'audio/music/expedition_shadow_realm.ogg',
        expedition_void_abyss:     'audio/music/expedition_void_abyss.ogg',
        expedition_oblivion_rift:  'audio/music/expedition_oblivion_rift.ogg',
        // Kingdom chain
        expedition_kingdom_outskirts: 'audio/music/expedition_kingdom_outskirts.ogg',
        expedition_crusader_barracks: 'audio/music/expedition_crusader_barracks.ogg',
        expedition_palace_fortress:   'audio/music/expedition_palace_fortress.ogg',

        // Optional weather tracks. Fall back to season/day-night if the file is absent.
        // Keys are 'weather_' + Weather.currentWeather (see WEATHER_TYPES in config/world.js).
        // No weather_clear: "clear" uses the season/day-night fallback.
        weather_rain: 'audio/music/weather_rain.ogg',
        weather_thunderstorm: 'audio/music/weather_thunderstorm.ogg',
        weather_snow: 'audio/music/weather_snow.ogg',
        weather_blizzard: 'audio/music/weather_blizzard.ogg',
        weather_heatwave: 'audio/music/weather_heatwave.ogg',

        // Optional season tracks. Fall back to day/night if the file is absent.
        // Keys are 'season_' + Weather.season (see SEASONS in config/world.js).
        season_spring: 'audio/music/season_spring.ogg',
        season_summer: 'audio/music/season_summer.ogg',
        season_autumn: 'audio/music/season_autumn.ogg',
        season_winter: 'audio/music/season_winter.ogg',
    },
};
