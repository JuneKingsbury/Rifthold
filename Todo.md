# Todo

## Content

### Story Milestones (41 entries need narrative text)
All milestone triggers and tracking work — just need the actual story text written.

**Colony lore milestones:**
- [ ] `first_building` — placing your first building
- [ ] `colony_5` — reaching 5 colonists
- [ ] `colony_10` — reaching 10 colonists
- [ ] `first_raid_survived` — surviving your first raid
- [ ] `first_mental_break` — first colonist mental break
- [ ] `first_death` — first colonist death
- [ ] `first_tame` — taming your first animal
- [ ] `first_trade` — completing your first trade
- [ ] `first_spell` — casting your first spell
- [ ] `first_wave_complete` — completing your first void wave

**Research lore milestones:**
- [ ] `runecraft`
- [ ] `druidcraft`
- [ ] `beast_binding`
- [ ] `ley_channeling`
- [ ] `arcane_studies`
- [ ] `void_summoning`
- [ ] `planar_rift`
- [ ] `deep_delving`
- [ ] `golem_craft`
- [ ] `herbalism`
- [ ] `void_architecture`
- [ ] `mana_reservoir`
- [ ] `alchemy`
- [ ] `trade_routes`
- [ ] `arcane_infusion`
- [ ] `warding`
- [ ] `void_forging`
- [ ] `masterwork`
- [ ] `advanced_arcana`
- [ ] `mana_weaving`
- [ ] `void_sorcery`

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
