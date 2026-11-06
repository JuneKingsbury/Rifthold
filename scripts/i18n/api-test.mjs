// Dev-only checks for js/core/i18n.js: lookups, placeholders, plurals, HTML
// escaping, config stamping and fallbacks. Run by `npm run i18n:check`.
const m = await import(new URL('../../js/core/i18n.js', import.meta.url));
const { loadLocaleData, t, tp, tHtml, stampLoc, defText, defName, hasKey, registerFallback, mergeLocale, getMissingKeys } = m;
const assert = (c, msg) => { if (!c) { console.error('FAIL', msg); process.exitCode = 1; } else console.log('ok  ', msg); };
loadLocaleData('en', { 'a.b': 'Hello {name}', 'p': { one: '{n} cat', other: '{n} cats' }, 'x_html': '<b>{v}</b>', 'brace': '{{lit}} {n}', 'spell.fire.name': 'Fireball' });
assert(t('a.b', { name: 'Ana' }) === 'Hello Ana', 'placeholder');
assert(t('a.b') === 'Hello {name}', 'no params leaves placeholder');
assert(t('nope') === 'nope', 'missing returns key');
assert(t('nope2', { x: 1 }, 'Inline {x}') === 'Inline 1', 'fallback formatted');
assert(tp('p', 1) === '1 cat' && tp('p', 0) === '0 cats' && tp('p', 5) === '5 cats', 'plural');
assert(tHtml('x_html', { v: '<i>' }) === '<b>&lt;i&gt;</b>', 'tHtml escapes params only');
assert(t('brace', { n: 3 }) === '{lit} 3', 'literal braces');
const SPELLS = { fire: { name: 'Inline Fire', description: 'Burns {d}' }, ice: { name: 'Ice' } };
stampLoc(SPELLS, 'spell');
assert(SPELLS.fire._loc === 'spell.fire', 'stamp map');
assert(defName(SPELLS.fire) === 'Fireball', 'table beats inline');
assert(defName(SPELLS.ice) === 'Ice', 'inline fallback');
assert(defText(SPELLS.fire, 'description', { d: 5 }) === 'Burns 5', 'inline fallback params');
assert(defText({ ...SPELLS.fire, key: 'fire' }, 'name') === 'Fireball', 'shallow copy keeps _loc');
const TIERS = [{ key: 'crude', prefix: 'Crude' }];
stampLoc(TIERS, 'quality_tier');
assert(TIERS[0]._loc === 'quality_tier.crude', 'stamp array');
const DEC = { d1: { text: 'Pick', options: [{ text: 'A' }, { text: 'B' }] } };
stampLoc(DEC, 'exp_decision', { children: ['options'] });
assert(DEC.d1.options[1]._loc === 'exp_decision.d1.options.1', 'stamp children');
stampLoc(SPELLS, 'other');
assert(SPELLS.fire._loc === 'spell.fire', 'restamp keeps first');
registerFallback('mod.x', 'ModText'); registerFallback('a.b', 'nope');
assert(t('mod.x') === 'ModText' && t('a.b', { name: 'Z' }) === 'Hello Z', 'registerFallback only fills gaps');
mergeLocale('en', { 'a.b': 'Override', 'new.k': 'New' });
assert(t('a.b', { name: 'Z' }) === 'Hello Z' && t('new.k') === 'New', 'mergeLocale base wins');
loadLocaleData('xx', { 'a.b': 'Hola {name}' });
assert(t('a.b', { name: 'Ana' }) === 'Hola Ana' && t('new.k') === 'New', 'other lang with English fallback');
assert(getMissingKeys().includes('nope'), 'missing tracked');
assert(defText(null, 'name') === '' && defText({}, 'name') === '', 'null-safe');
{
    const { ref, defRef } = m;
    loadLocaleData('en', { 'log.found': 'Found {item} x{n}', 'item.sword.name': 'Sword', 'nest': 'Hi {who}', 'w': 'World' });
    assert(t('log.found', { item: ref('item.sword.name'), n: 2 }) === 'Found Sword x2', 'ref param');
    assert(t('log.found', { item: ref('item.gone.name', 'Old Name'), n: 1 }) === 'Found Old Name x1', 'ref param fallback');
    assert(t('log.found', { item: ref('nest', null, { who: ref('w') }), n: 1 }) === 'Found Hi World x1', 'nested ref');
    const ITEMS = stampLoc({ sword: { name: 'Inline' }, axe: { name: 'Axe' } }, 'item');
    assert(t('log.found', { item: defRef(ITEMS.sword), n: 1 }) === 'Found Sword x1', 'defRef uses table');
    assert(t('log.found', { item: defRef(ITEMS.axe), n: 1 }) === 'Found Axe x1', 'defRef falls back inline');
    assert(JSON.parse(JSON.stringify(defRef(ITEMS.sword))).$t === 'item.sword.name', 'ref survives JSON');
}
{
    const { registerParamType } = m;
    registerParamType('dbl', (v) => v + v);
    loadLocaleData('en', { 'x': 'Got {thing}' });
    assert(t('x', { thing: { $f: 'dbl', v: 'ab' } }) === 'Got abab', 'typed param');
    assert(t('x', { thing: { $f: 'nope', v: 1, fb: 'Fallback' } }) === 'Got Fallback', 'unknown typed param falls back');
}
{
    const { getInlineConfigKeys, getTableConfigKeys } = m;
    loadLocaleData('en', { 'realm.r1.name': 'Realm One', 'realm.r1.boss.approachText': 'It comes', 'realm.r1.ambient.1': 'Line B', 'building.wall.name': 'Wall' });
    const REALMS = { r1: { name: 'old', icon: 'x', boss: { approachText: 'old', hp: 5, phases: [{ hp: 1 }] }, ambient: ['Line A', 'old B'] } };
    stampLoc(REALMS, 'realm');
    assert(REALMS.r1.name === 'Realm One' && REALMS.r1.icon === 'x', 'top-level field filled from table');
    assert(REALMS.r1.boss.approachText === 'It comes' && REALMS.r1.boss._loc === 'realm.r1.boss', 'nested field filled');
    assert(REALMS.r1.boss.phases[0]._loc === undefined, 'nested object without text not stamped');
    assert(REALMS.r1.ambient[0] === 'Line A' && REALMS.r1.ambient[1] === 'Line B', 'text array filled by index');
    assert(getInlineConfigKeys().includes('realm.r1.ambient.0') && getTableConfigKeys().includes('realm.r1.name'), 'inline vs table keys tracked');
    const B = stampLoc({ wall: { hp: 3 }, door: { hp: 1 } }, 'building');
    assert(B.wall.name === 'Wall' && !('name' in B.door), 'fields only in the table are filled');
    const copy = { ...B.wall, key: 'wall' };
    assert(copy._loc === 'building.wall', 'copies keep _loc');
    const CAT = stampLoc({ a: { category: 'Furniture', name: 'n' } }, 'thing');
    assert(CAT.a.category === 'Furniture', 'identifier fields untouched');
}
{
    const { defMessage } = m;
    loadLocaleData('en', { 'trap.pit.successText': '{name} jumps', 'realm.r.events.combatHit.1': '{a} hits' });
    const TRAPS = stampLoc({ pit: { successText: 'x' } }, 'trap');
    const R = stampLoc({ r: { events: { combatHit: ['p', 'q'] } } }, 'realm');
    const msg = defMessage(TRAPS.pit, 'successText', { name: 'Ann' });
    assert(msg.key === 'trap.pit.successText' && t(msg.key, msg.params) === 'Ann jumps', 'defMessage keyed');
    const m2 = defMessage(R.r.events, 'combatHit.1', { a: 'Bo' });
    assert(m2.key === 'realm.r.events.combatHit.1' && t(m2.key, m2.params) === 'Bo hits', 'defMessage list path');
    assert(defMessage({ failText: '{name} fails' }, 'failText', { name: 'Cy' }) === 'Cy fails', 'defMessage inline mod text');
}
