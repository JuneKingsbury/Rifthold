// Guards initEntityRoles — the role-state initializer that the Phase-2a
// ensureEntityRoles helper will wrap. Entities carry a `roles` array (behavior
// definitions); initEntityRoles calls each role handler's init() to populate
// per-role mutable state in `roleState`, skipping any role already present so
// accumulated state survives a re-init.
import { describe, it, expect } from 'vitest';
import { initEntityRoles, ensureEntityRoles } from '../js/entities/roles.js';

describe('initEntityRoles', () => {
    it('runs each role handler init to populate roleState', () => {
        // The production handler seeds { cooldown: produceRate || 80 }.
        const entity = { roles: [{ type: 'production', produceRate: 50 }] };
        initEntityRoles(entity);
        expect(entity.roleState.production).toEqual({ cooldown: 50 });
    });

    it('defaults produceRate when the role omits it', () => {
        const entity = { roles: [{ type: 'production' }] };
        initEntityRoles(entity);
        expect(entity.roleState.production.cooldown).toBe(80);
    });

    it('does not re-init a role whose state already exists', () => {
        const entity = {
            roles: [{ type: 'production', produceRate: 50 }],
            roleState: { production: { cooldown: 3 } },   // mid-countdown
        };
        initEntityRoles(entity);
        expect(entity.roleState.production.cooldown).toBe(3);   // preserved, not reset to 50
    });

    it('creates an empty roleState and handles an entity with no roles', () => {
        const entity = { roles: [] };
        expect(() => initEntityRoles(entity)).not.toThrow();
        expect(entity.roleState).toEqual({});
    });

    it('ignores roles with no matching handler without throwing', () => {
        const entity = { roles: [{ type: 'not_a_real_role' }] };
        expect(() => initEntityRoles(entity)).not.toThrow();
        expect(entity.roleState).toEqual({});
    });
});

describe('ensureEntityRoles (save-load backfill)', () => {
    const wildDef = { roles: [{ type: 'melee_charger' }] };
    const tamedDef = {
        roles: [{ type: 'melee_charger' }],
        tamed: { roles: [{ type: 'production', produceRate: 100 }, { type: 'wander' }] },
    };

    it('backfills roles from def.roles when the entity has none', () => {
        const entity = { type: 'brute' };
        ensureEntityRoles(entity, wildDef);
        expect(entity.roles.map(r => r.type)).toEqual(['melee_charger']);
        expect(entity.roleState.melee_charger).toBeDefined();
    });

    it('uses def.tamed.roles for a tamed entity', () => {
        const entity = { type: 'cow', tamed: true };
        ensureEntityRoles(entity, tamedDef);
        expect(entity.roles.map(r => r.type)).toEqual(['production', 'wander']);
    });

    it('uses def.roles for an untamed entity even if a tamed variant exists', () => {
        const entity = { type: 'cow' };   // not tamed
        ensureEntityRoles(entity, tamedDef);
        expect(entity.roles.map(r => r.type)).toEqual(['melee_charger']);
    });

    it('shallow-clones role objects so it never mutates the shared def', () => {
        const entity = { type: 'brute' };
        ensureEntityRoles(entity, wildDef);
        expect(entity.roles[0]).not.toBe(wildDef.roles[0]);
    });

    it('keeps existing roles and does not re-init preserved state', () => {
        const entity = {
            type: 'cow', tamed: true,
            roles: [{ type: 'production', produceRate: 100 }],
            roleState: { production: { cooldown: 7 } },
        };
        ensureEntityRoles(entity, tamedDef);
        expect(entity.roles.map(r => r.type)).toEqual(['production']);   // not overwritten from def
        expect(entity.roleState.production.cooldown).toBe(7);            // preserved
    });

    it('tolerates an unknown type (no def) by leaving roles empty', () => {
        const entity = { type: 'ghost' };
        expect(() => ensureEntityRoles(entity, undefined)).not.toThrow();
        expect(entity.roles).toEqual([]);
        expect(entity.roleState).toEqual({});
    });
});
