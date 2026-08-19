# Todo

## Content

### Story Milestones
All milestone triggers and story left to flesh out.

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
- [ ] `kingdom_outskirts`
- [ ] `crusader_barracks`
- [ ] `palace_fortress`

### Audio Assets
The sound system is fully wired up (`js/core/sound.js` + `js/core/sound-manifest.js`) but the `audio/` directory has no actual files. All paths are relative to the project root. Format: `.ogg` (Vorbis).

#### Combat SFX — `audio/sfx/combat/`

| File | Description |
|------|-------------|
| `colonist_death.ogg` | Colonist killed |
| `enemy_death.ogg` | Enemy killed |
| `critical_hit.ogg` | Critical strike landed |
| `shield_block.ogg` | Damage blocked by shield/armor |

#### Spell SFX — `audio/sfx/spells/`

| File | Description |
|------|-------------|
| `spell_terraform.ogg` | Terrain transformation |
| `magic_levelup.ogg` | Magic skill level up |
| `mana_regen.ogg` | Mana crystal recharge |

#### Work SFX — `audio/sfx/work/`

| File | Description |
|------|-------------|
| `build_complete.ogg` | Structure finished building |
| `craft_complete.ogg` | Item crafted |
| `research_complete.ogg` | Research topic unlocked |

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
| `notification.ogg` | Generic notification chime |
| `mental_break.ogg` | Colonist mental break warning |

