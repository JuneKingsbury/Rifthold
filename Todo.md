# Todo

## Content

### Story Milestones
Milestone triggers and story left to flesh out.

**Realm exploration lore:**
- [X] `crystal_caves`
- [ ] `crystal_mines`
- [ ] `crystal_depths`
- [ ] `verdant_depths`
- [ ] `fungal_hollows`
- [ ] `primeval_canopy`
- [X] `arcane_library`
- [X] `ancient_university`
- [X] `abandoned_laboratory`
- [ ] `shadow_realm`
- [ ] `void_abyss`
- [ ] `oblivion_rift`
- [ ] `kingdom_outskirts`
- [ ] `crusader_barracks`
- [ ] `palace_fortress`

**Bestiary lore**

### Audio Assets
The sound system is fully wired up (`js/core/sound.js` + `js/core/sound-manifest.js`). Music tracks are all present. The tables below list only the **missing** SFX files. All paths are relative to the project root. Format: `.ogg` (Vorbis).

#### Combat SFX — `audio/sfx/combat/`

| File | Description |
|------|-------------|
| `enemy_death.ogg` | Enemy killed |

#### Spell SFX — `audio/sfx/spells/`

| File | Description |
|------|-------------|
| `magic_levelup.ogg` | Magic skill level up |
| `mana_regen.ogg` | Mana crystal recharge |

#### Environment SFX — `audio/sfx/environment/`

| File | Description |
|------|-------------|
| `fire_ignite.ogg` | Fire starts (event or structure) |
| `freezing.ogg` | Colonist freezing warning |
| `rain_start.ogg` | Weather transitions to rain |
| `blizzard_start.ogg` | Weather transitions to blizzard |
| `snow_start.ogg` | Weather transitions to snow |
| `heatwave_start.ogg` | Weather transitions to heatwave |
| `weather_clear.ogg` | Weather clears up |

### Steam Integration
The steamworks.js foundation is wired up (`steam-bridge.js`, IPC handlers, preload bridge, cloud save hooks, achievement triggers in `story.js`). The game runs normally without Steam. Remaining steps to finish:

**Setup & Testing**
- [x] Run `npm install` to pull `steamworks.js` and rebuild native modules
- [x] Test `npm start` works without Steam running (should behave identically to before)
- [ ] Test with Steam running + `steam_appid.txt` (uses Spacewar test app 480)

**Steamworks Partner Dashboard** (requires a Steamworks developer account)
- [ ] Register the game and get a real Steam App ID
- [ ] Replace `480` with real App ID in `electron-main.js` line 95 (`steamBridge.initialize(480)`)
- [ ] Configure all 29 achievements in the Steamworks dashboard — each "API Name" must match the milestone key exactly:
  - Colony: `first_building`, `colony_5`, `colony_10`, `first_raid_survived`, `first_crusader_raid_survived`, `first_death`, `first_love`, `first_winter_feast`, `first_wave_complete`
  - Realms: `realm_crystal_caves`, `realm_crystal_mines`, `realm_crystal_depths`, `realm_verdant_depths`, `realm_fungal_hollows`, `realm_primeval_canopy`, `realm_arcane_library`, `realm_ancient_university`, `realm_abandoned_laboratory`, `realm_shadow_realm`, `realm_void_abyss`, `realm_oblivion_rift`, `realm_void_hollow`, `realm_void_sanctum`, `realm_void_heart`, `realm_fracture_gate`, `realm_shifting_labyrinth`, `realm_unraveling_core`, `realm_kingdom_outskirts`, `realm_crusader_barracks`, `realm_palace_fortress`
- [ ] Upload achievement icons (locked + unlocked) for each achievement
- [ ] Set display names and descriptions for each achievement
- [ ] Configure Steam Cloud storage quota in the dashboard (save files are small — a few MB total)
- [ ] Configure Steam Stats keys to match `game.stats` fields (e.g. `raidsDefeated`, `wavesCompleted`, etc.)

**Production Build**
- [ ] Verify `npm run dist:mac` / `dist:win` / `dist:linux` packages correctly with steamworks.js native binaries
- [ ] Test the packaged app launches through Steam client with overlay working (Shift+Tab)
- [ ] Set up platform-specific CI runners if cross-compiling (native modules need to match target platform)

**Polish (optional)**
- [ ] Display Steam player name somewhere in the UI (start screen or settings)
- [ ] Add a cloud save sync status indicator in the save slot UI
- [ ] Add a "cloud vs local" conflict resolution prompt instead of auto-picking newest

### Cooking System
Today the cooking system in Rifthold is really really simple. You throw 5 foodstuffs into a cauldron and 1 cooked food comes out.

Can we make the ingredients used actually matter? For example, we could have colonists
attempt to cook food with their random 5 foodstuffs and that will be tied to a cooked food item for that specific recipe. From there you should be able to toggle different dishes off and on so colonists only cook the dishes you prefer. When a dish is toggled off it will not be cooked by colonists (they will not cook with that 5 foodstuffs recipe combo) and colonists will prefer other food items when eating.

From there we can do things like make colonists have food preferences and favorite dishes. Another option is to introduce boosts to the colonist that eats a particular dish for several in-game hours. These boosts could be basically any small buff from our existing effects list.

Basically these are potions again but instead of being used strategically in relevant situations, it instead boosts the colonist for a longer period of time every time they eat.
