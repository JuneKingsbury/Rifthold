// Dev-only: the key order of locale/en.json, shared by the scripts that write it.
//
// Keys are sorted alphabetically, except the realm.* keys: those are grouped by
// realm in the order the player meets them, the same order as the Rifts panel
// (js/ui/ui-arcane.js). Chains are ordered by the difficulty of their first
// realm, ties by definition order in REALMS, and realms within a chain by
// chainOrder. Keys inside one realm stay alphabetical. Realm ids in the table
// that REALMS doesn't define go after the known realms, alphabetically.

const { REALMS } = await import(new URL('../../js/core/config/exploration.js', import.meta.url));

const allRealms = Object.entries(REALMS).map(([key, r], i) => ({ key, ...r, _defIdx: i }));
const chainRealms = (chain) => allRealms.filter(r => r.chain === chain).sort((a, b) => a.chainOrder - b.chainOrder);
const chains = [...new Set(allRealms.map(r => r.chain))].sort((a, b) => {
    const aFirst = chainRealms(a)[0], bFirst = chainRealms(b)[0];
    const aDiff = aFirst?.difficulty ?? 0, bDiff = bFirst?.difficulty ?? 0;
    if (aDiff !== bDiff) return aDiff - bDiff;
    return (aFirst?._defIdx ?? 0) - (bFirst?._defIdx ?? 0);
});
const REALM_RANK = new Map(chains.flatMap(chainRealms).map((r, i) => [r.key, i]));

const realmId = (key) => key.startsWith('realm.') ? key.split('.')[1] : null;
const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function compareKeys(a, b) {
    const ra = realmId(a), rb = realmId(b);
    if (ra === null || rb === null || ra === rb) return cmp(a, b);
    // The realm.* block sits where it would alphabetically; only its realms are reordered.
    const ia = REALM_RANK.get(ra) ?? Infinity, ib = REALM_RANK.get(rb) ?? Infinity;
    return ia !== ib ? ia - ib : cmp(ra, rb);
}

export const sortKeys = (keys) => keys.slice().sort(compareKeys);
export const sortTable = (table) => Object.fromEntries(sortKeys(Object.keys(table)).map(k => [k, table[k]]));
