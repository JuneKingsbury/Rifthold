# Todo

## Content

### Verify in-game glossary is up-to-date
Go through in-game glossary and make sure everything is up-to-date with the latest version of the game.

### Verify tutorial text
Go through all 3 tutorial types and verify they progress as intended and their tasks are clear.

### Achievement Portrait Art
Make portrait art for every story that is planned to be tied to a Steam achievement (see skin editor dev tool for list).

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

**Polish**
- [ ] Display Steam player name somewhere in the UI (start screen or settings)
- [ ] Add a "cloud vs local" conflict resolution prompt instead of auto-picking newest
