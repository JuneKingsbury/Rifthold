# Audio System

## How It Works

The sound system is fully dynamic. Just drop `.ogg` files into the right folder and they'll play automatically when the matching game event happens. If a file is missing, the game just skips it quietly. No errors, no crashes, no code changes needed.

## Adding Sounds

1. Create your audio file in `.ogg` format
2. Name it exactly as listed below
3. Drop it in the correct subfolder
4. Next time that event fires in-game, you'll hear it

## Volume Controls

Both the start screen and the in-game settings panel have Music and SFX volume sliders (0 to 100). These values are saved with your game automatically.

## Music Behavior

Background music is layered. Each tick the game picks the most specific track that has a file present, and falls back to a more general one when a specialized track is missing. Priority, highest first:

1. **Expedition** (a party is out exploring a realm): `music/expedition.ogg`. If this file is missing, colony music simply goes silent for the duration of the expedition.
2. **Combat** (raid or wave active): `music/combat.ogg`
3. **Weather** (current weather is not clear): `music/weather_<type>.ogg`, e.g. `music/weather_rain.ogg`
4. **Season**: `music/season_<name>.ogg`, e.g. `music/season_winter.ogg`
5. **Day / Night** (the always-present base): `music/ambient_day.ogg` or `music/ambient_night.ogg`

So on a rainy winter night with no enemies, the game plays `weather_rain.ogg` if it exists, else `season_winter.ogg` if it exists, else `ambient_night.ogg`. Weather takes precedence over season. The weather and season tracks are entirely optional: add only the ones you want, and the rest fall through to day/night automatically.

When the music changes, it crossfades over 2 seconds so you don't get a jarring cut. All tracks loop.

## SFX Behavior

- There's a 200ms cooldown per sound so rapid-fire events don't stack the same clip on top of itself
- Up to 8 SFX can play at once (prevents distortion during big fights)
- Each sound is fetched and cached the first time it plays, so after that initial load it's instant

## Accepted Files

### Music

Listed highest priority first. Weather and season tracks are optional, and missing ones fall through to the day/night base.

| File | Trigger |
|------|---------|
| `music/expedition.ogg` | A party is out exploring a realm (pauses colony music) |
| `music/combat.ogg` | Raid or wave enemies active |
| `music/weather_rain.ogg` | Current weather is rain (no enemies) |
| `music/weather_thunderstorm.ogg` | Current weather is thunderstorm (no enemies) |
| `music/weather_snow.ogg` | Current weather is snow (no enemies) |
| `music/weather_blizzard.ogg` | Current weather is blizzard (no enemies) |
| `music/weather_heatwave.ogg` | Current weather is heat wave (no enemies) |
| `music/season_spring.ogg` | Season is spring (no enemies, weather clear or no weather track) |
| `music/season_summer.ogg` | Season is summer (no enemies, weather clear or no weather track) |
| `music/season_autumn.ogg` | Season is autumn (no enemies, weather clear or no weather track) |
| `music/season_winter.ogg` | Season is winter (no enemies, weather clear or no weather track) |
| `music/ambient_day.ogg` | Daytime base (no enemies, no more specific track) |
| `music/ambient_night.ogg` | Nighttime base (no enemies, no more specific track), also the track a new game starts on |
| `music/menu_theme.ogg` | Start menu / main menu |
| `music/credits.ogg` | Credits screen |

### SFX: Combat

| File | Trigger |
|------|---------|
| `sfx/combat/colonist_damaged.ogg` | Colonist takes damage |
| `sfx/combat/colonist_death.ogg` | Colonist dies |
| `sfx/combat/enemy_death.ogg` | Raider or wave enemy dies |
| `sfx/combat/critical_hit.ogg` | Critical hit lands |
| `sfx/combat/shield_block.ogg` | Shield absorbs damage or colonist dodges |
| `sfx/combat/loot_drop.ogg` | Enemy drops loot on death |
| `sfx/combat/arrow_fire.ogg` | Arrow projectile fired |
| `sfx/combat/bolt_fire.ogg` | Bolt projectile fired |
| `sfx/combat/turret_fire.ogg` | Arcane or void turret fires |

### SFX: Spells

| File | Trigger |
|------|---------|
| `sfx/spells/spell_cast.ogg` | Any spell is auto-cast |
| `sfx/spells/spell_heal.ogg` | Heal spell effect applied |
| `sfx/spells/spell_buff.ogg` | Speed buff spell applied |
| `sfx/spells/spell_shield.ogg` | Defense/shield spell applied |
| `sfx/spells/spell_teleport.ogg` | Teleport spell used |
| `sfx/spells/spell_growth.ogg` | Crop growth spell cast |
| `sfx/spells/spell_terraform.ogg` | Terraform spell cast |
| `sfx/spells/spell_divination.ogg` | Divination modifier spell cast |
| `sfx/spells/magic_levelup.ogg` | Magic skill level increases |
| `sfx/spells/mana_regen.ogg` | Not yet wired up (mana regen tick) |
| `sfx/spells/summon_arrival.ogg` | Summoned creature appears |
| `sfx/spells/golem_activate.ogg` | Golem is crafted and animated |

### SFX: Work

| File | Trigger |
|------|---------|
| `sfx/work/build_complete.ogg` | Building construction finishes |
| `sfx/work/craft_complete.ogg` | Crafting order finishes |
| `sfx/work/research_complete.ogg` | Research project completes |
| `sfx/work/harvest.ogg` | Crop harvested |
| `sfx/work/mine_hit.ogg` | Mining completes (rock removed) |
| `sfx/work/chop_hit.ogg` | Chopping completes (tree removed) |

### SFX: Environment

| File | Trigger |
|------|---------|
| `sfx/environment/fire_ignite.ogg` | Fire starts or spreads to a new tile |
| `sfx/environment/freezing.ogg` | Not yet wired up (colonist freezing) |
| `sfx/environment/rain_ambient.ogg` | Not yet wired up (rain weather) |
| `sfx/environment/thunder_crack.ogg` | Not yet wired up (thunderstorm) |
| `sfx/environment/wind_blizzard.ogg` | Not yet wired up (blizzard weather) |

### SFX: UI

| File | Trigger |
|------|---------|
| `sfx/ui/button_click.ogg` | Not yet wired up (button clicks) |
| `sfx/ui/notification.ogg` | Not yet wired up (notification popups) |
| `sfx/ui/wave_alert.ogg` | New wave begins |
| `sfx/ui/mental_break.ogg` | Colonist has a mental break |
