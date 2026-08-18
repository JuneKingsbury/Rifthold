# Todo

## Content

### Story Milestones
All milestone triggers and story left to flesh out.

**Colony lore milestones:**
- [x] `first_building`
- [x] `colony_5` — reaching 5 colonists
- [x] `colony_10` — reaching 10 colonists
- [x] `first_raid_survived`
- [x] `first_mental_break`
- [x] `first_death`
- [x] `first_tame` — taming your first animal
- [x] `first_trade`
- [x] `first_spell` — casting your first spell
- [x] `first_wave_complete` — completing your first void wave

**Race lore milestones:**
- [x] `bufoi`
- [x] `kobaloi`
- [x] `ferini`
- [x] `nympha`
- [x] `humanity`

**Research lore milestones:**
- [x] `runecraft`
- [x] `druidcraft`
- [x] `beast_binding`
- [x] `ley_channeling`
- [x] `arcane_studies`
- [x] `void_summoning`
- [x] `planar_rift`
- [x] `deep_delving`
- [x] `golem_craft`
- [x] `herbalism`
- [x] `void_architecture`
- [x] `mana_reservoir`
- [x] `alchemy`
- [x] `trade_routes`
- [x] `arcane_infusion`
- [x] `warding`
- [x] `void_forging`
- [x] `masterwork`
- [x] `advanced_arcana`
- [x] `mana_weaving`
- [x] `void_sorcery`

**Realm exploration lore:**
- [ ] `crystal_caves`
- [ ] `crystal_mines`
- [ ] `crystal_depths`
- [ ] `verdant_depths`
- [ ] `fungal_hollows`
- [ ] `primeval_canopy`
- [ ] `arcane_library`
- [ ] `ancient_university`
- [ ] `abandoned_laboratory`
- [ ] `shadow_realm`
- [ ] `void_abyss`
- [ ] `oblivion_rift`

### Audio Assets
The sound system is fully wired up (`js/core/sound.js` + `js/core/sound-manifest.js`) but the `audio/` directory has no actual files. All paths are relative to the project root. Format: `.ogg` (Vorbis).

#### Combat SFX — `audio/sfx/combat/`

| File | Description |
|------|-------------|
| `colonist_damaged.ogg` | Colonist takes a hit |
| `colonist_death.ogg` | Colonist death |
| `enemy_death.ogg` | Enemy killed |
| `critical_hit.ogg` | Critical strike landed |
| `shield_block.ogg` | Damage blocked by shield/armor |
| `loot_drop.ogg` | Loot drops from enemy |
| `arrow_fire.ogg` | Bow/crossbow shot fired |
| `bolt_fire.ogg` | Crossbow bolt fired |
| `turret_fire.ogg` | Sentinel turret fires |

#### Spell SFX — `audio/sfx/spells/`

| File | Description |
|------|-------------|
| `spell_cast.ogg` | Generic spell cast |
| `spell_heal.ogg` | Healing spell effect |
| `spell_buff.ogg` | Buff/haste applied |
| `spell_shield.ogg` | Shield/ward raised |
| `spell_teleport.ogg` | Teleport/blink |
| `spell_growth.ogg` | Nature/growth magic |
| `spell_terraform.ogg` | Terrain transformation |
| `spell_divination.ogg` | Divination/scrying |
| `magic_levelup.ogg` | Magic skill level up |
| `mana_regen.ogg` | Mana crystal recharge |
| `summon_arrival.ogg` | Summoned creature appears |
| `golem_activate.ogg` | Golem comes to life |

#### Work SFX — `audio/sfx/work/`

| File | Description |
|------|-------------|
| `build_complete.ogg` | Structure finished building |
| `craft_complete.ogg` | Item crafted |
| `research_complete.ogg` | Research topic unlocked |
| `harvest.ogg` | Crop harvested |
| `mine_hit.ogg` | Pickaxe strikes rock |

#### Environment SFX — `audio/sfx/environment/`

| File | Description |
|------|-------------|
| `fire_ignite.ogg` | Fire starts (event or structure) |
| `freezing.ogg` | Colonist freezing warning |
| `rain_ambient.ogg` | Rain loop (loopable) |
| `thunder_crack.ogg` | Thunder strike |
| `wind_blizzard.ogg` | Blizzard wind (loopable) |

#### UI SFX — `audio/sfx/ui/`

| File | Description |
|------|-------------|
| `button_click.ogg` | Button/panel interaction |
| `notification.ogg` | Generic notification chime |
| `wave_alert.ogg` | Void wave incoming alert |
| `mental_break.ogg` | Colonist mental break warning |

#### Music — `audio/music/`

| File | Description |
|------|-------------|
| `ambient_day.ogg` | Daytime ambient track (loopable) |
| `ambient_night.ogg` | Nighttime ambient track (loopable) |
| `combat.ogg` | Combat encounter music (loopable) |
| `menu_theme.ogg` | Start screen / menu theme |
