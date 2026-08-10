// Guards getMaxCountBonus: the single place the placement gate and every UI
// "at max" display agree on how many extra slots a building gets. Two sources
// stack — a research-driven bonus on game[maxCountBonusKey], and a hardcoded
// +3 for mana_crystal once mana_reservoir is researched.
import { describe, it, expect } from 'vitest';
import { getMaxCountBonus } from '../js/systems/building.js';

// Minimal game stub exposing only what getMaxCountBonus reads: the bonus-key
// field and research.isResearched.
function makeGameStub({ bonusFields = {}, researched = [] } = {}) {
    const done = new Set(researched);
    return { ...bonusFields, research: { isResearched: (id) => done.has(id) } };
}

describe('getMaxCountBonus', () => {
    it('returns 0 when the def declares no bonus key and is not mana_crystal', () => {
        const def = {};
        expect(getMaxCountBonus(def, 'wood_wall', makeGameStub())).toBe(0);
    });

    it('reads the research bonus from game[maxCountBonusKey]', () => {
        const def = { maxCountBonusKey: 'manaCrystalBonus' };
        const game = makeGameStub({ bonusFields: { manaCrystalBonus: 5 } });
        // mana_crystal, but mana_reservoir NOT researched -> only the keyed bonus.
        expect(getMaxCountBonus(def, 'mana_crystal', game)).toBe(5);
    });

    it('treats a missing bonus field as 0', () => {
        const def = { maxCountBonusKey: 'manaCrystalBonus' };
        // No manaCrystalBonus field set on the game at all.
        expect(getMaxCountBonus(def, 'wood_wall', makeGameStub())).toBe(0);
    });

    it('adds +3 for mana_crystal once mana_reservoir is researched', () => {
        const def = { maxCountBonusKey: 'manaCrystalBonus' };
        const game = makeGameStub({ researched: ['mana_reservoir'] });
        // No keyed bonus -> just the special-case +3.
        expect(getMaxCountBonus(def, 'mana_crystal', game)).toBe(3);
    });

    it('stacks the keyed bonus and the mana_reservoir +3', () => {
        const def = { maxCountBonusKey: 'manaCrystalBonus' };
        const game = makeGameStub({ bonusFields: { manaCrystalBonus: 2 }, researched: ['mana_reservoir'] });
        expect(getMaxCountBonus(def, 'mana_crystal', game)).toBe(5);
    });

    it('does not apply the +3 to other build types even with mana_reservoir researched', () => {
        const def = { maxCountBonusKey: 'manaCrystalBonus' };
        const game = makeGameStub({ bonusFields: { manaCrystalBonus: 2 }, researched: ['mana_reservoir'] });
        expect(getMaxCountBonus(def, 'arcane_altar', game)).toBe(2);
    });
});
