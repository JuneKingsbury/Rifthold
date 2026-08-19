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

### Cooking System
Today the cooking system in Rifthold is really really simple. You throw 5 foodstuffs into a cauldron and 1 cooked food comes out.

Can we make the ingredients used actually matter? For example, we could have colonists
attempt to cook food with their random 5 foodstuffs and that will be tied to a cooked food item for that specific recipe. From there you should be able to toggle different dishes off and on so colonists only cook the dishes you prefer. When a dish is toggled off it will not be cooked by colonists (they will not cook with that 5 foodstuffs recipe combo) and colonists will prefer other food items when eating.

From there we can do things like make colonists have food preferences and favorite dishes. Another option is to introduce boosts to the colonist that eats a particular dish for several in-game hours. These boosts could be basically any small buff from our existing effects list.

Basically these are potions again but instead of being used strategically in relevant situations, it instead boosts the colonist for a longer period of time every time they eat.

### Visual Effects
I want to look into swapping several of the existing .png effect sprites with animated .gif files. This would make several of the effects, like "building complete", much more visually interesting and rewarding.