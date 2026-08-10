// Guards the dependency-free presentation helpers shared across the UI and the
// exploration system. getTargetPriority encodes a behavior decision (Phase 2d):
// the expedition value wins, but falls back to the combat value so a
// combat-only artifact still reports a consistent threat.
import { describe, it, expect } from 'vitest';
import { getTargetPriority, countByKey, getThreatDisplayHtml } from '../js/ui/ui-utils.js';

describe('getTargetPriority', () => {
    it('returns 0 for an item with no artifact', () => {
        expect(getTargetPriority({})).toBe(0);
    });

    it('returns 0 for an artifact that declares no threat', () => {
        expect(getTargetPriority({ artifact: {} })).toBe(0);
    });

    it('prefers the expedition targetPriority when present', () => {
        const item = { artifact: { expedition: { targetPriority: 7 }, combat: { targetPriority: 2 } } };
        expect(getTargetPriority(item)).toBe(7);
    });

    it('falls back to the combat targetPriority when expedition is absent', () => {
        const item = { artifact: { combat: { targetPriority: -3 } } };
        expect(getTargetPriority(item)).toBe(-3);
    });

    it('falls back to combat when expedition value is 0 (falsy)', () => {
        // 0 is falsy, so the || chain skips it and uses the combat value.
        const item = { artifact: { expedition: { targetPriority: 0 }, combat: { targetPriority: 4 } } };
        expect(getTargetPriority(item)).toBe(4);
    });
});

describe('countByKey', () => {
    it('returns an empty object for no items', () => {
        expect(countByKey([], (x) => x)).toEqual({});
    });

    it('tallies items by their mapped key', () => {
        const items = [{ t: 'a' }, { t: 'b' }, { t: 'a' }, { t: 'a' }];
        expect(countByKey(items, (i) => i.t)).toEqual({ a: 3, b: 1 });
    });

    it('supports a keyFn that returns the item itself', () => {
        expect(countByKey(['x', 'x', 'y'], (i) => i)).toEqual({ x: 2, y: 1 });
    });
});

describe('getThreatDisplayHtml', () => {
    it('returns empty string for neutral (0) priority', () => {
        expect(getThreatDisplayHtml(0)).toBe('');
    });

    it('renders an up-arrow threat span for positive priority', () => {
        const html = getThreatDisplayHtml(5);
        expect(html).toContain('▲');
        expect(html).toContain('#ff6644');
    });

    it('renders a down-arrow span for negative priority', () => {
        const html = getThreatDisplayHtml(-5);
        expect(html).toContain('▼');
        expect(html).toContain('#66aaff');
    });
});
