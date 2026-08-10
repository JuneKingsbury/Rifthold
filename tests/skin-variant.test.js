// Guards SkinManager.getColonistSprite — the composited body+hair+shirt lookup.
// We stub sprite lookups by populating _sprites directly so no fetch is needed.
// Canvas-dependent paths (compositing) require DOM and can't run in this env;
// we test only the pure lookup/guard paths here.
import { describe, it, expect, beforeEach } from 'vitest';
import { SkinManager } from '../js/ui/skin-manager.js';

const fakeSprite = (label) => ({ _label: label, width: 16, height: 16 });

describe('SkinManager.getColonistSprite — null/drafted guards (no canvas)', () => {
    let sm;
    beforeEach(() => {
        sm = new SkinManager();
        sm._activeSkin = 'fantasy';
        sm._bodyCount = 3;
        sm._hairCount = 2;
        sm._shirtCount = 2;
        for (let i = 1; i <= 3; i++) sm._sprites.set(`entities:colonist_body_${i}`, fakeSprite(`body_${i}`));
        for (let i = 1; i <= 2; i++) sm._sprites.set(`entities:colonist_hair_${i}`, fakeSprite(`hair_${i}`));
        for (let i = 1; i <= 2; i++) sm._sprites.set(`entities:colonist_shirt_${i}`, fakeSprite(`shirt_${i}`));
    });

    it('returns null when bodyCount is 0 (ASCII mode)', () => {
        sm._bodyCount = 0;
        expect(sm.getColonistSprite(1, false, 1, 1, 1, '#ff0000')).toBeNull();
    });

    it('returns null when the body sprite key is missing from the map', () => {
        sm._sprites.clear();
        // bodyCount > 0 but no actual sprite loaded — should return null
        expect(sm.getColonistSprite(1, false, 1, 1, 1, '#ff0000')).toBeNull();
    });

    it('returns the drafted sprite when drafted=true and one exists', () => {
        const drafted = fakeSprite('drafted');
        sm._sprites.set('entities:colonist_drafted', drafted);
        const result = sm.getColonistSprite(1, true, 1, 1, 1, '#ff0000');
        expect(result).toBe(drafted);
    });

    it('falls through to compositing when drafted=true but no drafted sprite exists', () => {
        // No colonist_drafted sprite; should attempt to build composite from body
        // (will throw due to missing document.createElement in this env, but that
        // confirms it did not short-circuit — we just guard the drafted fast-path here)
        sm._sprites.delete('entities:colonist_drafted');
        // If bodyCount > 0 and body sprite exists, it will try to create a canvas.
        // We verify it does NOT return the non-existent drafted sprite (null for that key).
        // Instead it should proceed (throws in test env, but that's expected).
        expect(() => sm.getColonistSprite(1, true, 1, 1, 1, '#ff0000')).toThrow();
    });
});

describe('SkinManager body/hair/shirt counts', () => {
    it('starts at zero before a skin is loaded', () => {
        const sm = new SkinManager();
        expect(sm.bodyCount).toBe(0);
        expect(sm.hairCount).toBe(0);
        expect(sm.shirtCount).toBe(0);
    });

    it('exposes counts via getters after manual population', () => {
        const sm = new SkinManager();
        sm._bodyCount = 4;
        sm._hairCount = 6;
        sm._shirtCount = 3;
        expect(sm.bodyCount).toBe(4);
        expect(sm.hairCount).toBe(6);
        expect(sm.shirtCount).toBe(3);
    });

    it('resets all counts when switching back to ascii', async () => {
        const sm = new SkinManager();
        sm._bodyCount = 3;
        sm._hairCount = 2;
        sm._shirtCount = 4;
        // switchSkin('ascii') clears everything synchronously (no fetch needed)
        await sm.switchSkin('ascii');
        expect(sm.bodyCount).toBe(0);
        expect(sm.hairCount).toBe(0);
        expect(sm.shirtCount).toBe(0);
    });
});
