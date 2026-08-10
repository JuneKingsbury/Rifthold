// Guards the save->load round-trip: build a game state, saveGame it, then
// loadGame into a fresh game and assert the meaningful fields survive intact.
// This is the broad regression net for the whole persisted state model, and it
// pins the Phase-1 "reject on version mismatch" behavior.
import { describe, it, expect, beforeEach } from 'vitest';
import { installBrowserShims, makeGame } from './helpers.js';

// save.js reads localStorage/document at call time, so the shims must exist
// before the module's functions run. Install them, then import.
const store = installBrowserShims();
const { saveGame, loadGame, hasSave } = await import('../js/core/save.js');

describe('save/load round-trip', () => {
    beforeEach(() => store.clear());

    it('reports no save before one is written', () => {
        expect(hasSave()).toBe(false);
    });

    it('round-trips scalar and collection state through save then load', () => {
        const src = makeGame();
        src.tick = 1234;
        src.timeOfDay = 0.75;
        src.speed = 3;
        src.weather.season = 'winter';
        src.weather.year = 4;
        src.resources.stockpile = { wood: 50, stone: 20 };
        src.research.completed = new Set(['fire', 'walls']);
        src.discoveredLoot = new Set(['ruby_ring']);
        src.exploration.completedRealms = new Set(['ashland']);
        src.story.unlocked = new Map([['intro', true]]);
        src.map[1][1].structure = 'bed';
        src.map[1][1].passable = false;

        expect(saveGame(src)).toBe(true);
        expect(hasSave()).toBe(true);

        const dst = makeGame();
        expect(loadGame(dst)).toBe(true);

        // Scalars
        expect(dst.tick).toBe(1234);
        expect(dst.timeOfDay).toBe(0.75);
        expect(dst.speed).toBe(3);
        expect(dst.weather.season).toBe('winter');
        expect(dst.weather.year).toBe(4);
        // Collections (Sets/Maps are rehydrated from their serialized form)
        expect(dst.resources.stockpile).toEqual({ wood: 50, stone: 20 });
        expect(dst.research.completed).toBeInstanceOf(Set);
        expect([...dst.research.completed].sort()).toEqual(['fire', 'walls']);
        expect(dst.discoveredLoot.has('ruby_ring')).toBe(true);
        expect(dst.exploration.completedRealms.has('ashland')).toBe(true);
        expect(dst.story.unlocked.get('intro')).toBe(true);
        // Map tiles
        expect(dst.map[1][1].structure).toBe('bed');
        expect(dst.map[1][1].passable).toBe(false);
    });

    it('rejects a save whose version does not match and clears it', () => {
        const src = makeGame();
        expect(saveGame(src)).toBe(true);

        // Corrupt the stored version to simulate an incompatible save.
        const raw = JSON.parse(store.get('colony_save'));
        raw.version = 1;
        store.set('colony_save', JSON.stringify(raw));

        const dst = makeGame();
        expect(loadGame(dst)).toBe(false);   // mismatch -> refuse
        expect(hasSave()).toBe(false);        // and discard the bad save
    });

    it('returns false when there is nothing to load', () => {
        expect(loadGame(makeGame())).toBe(false);
    });
});
