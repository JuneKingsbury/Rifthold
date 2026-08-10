import { ENTITIES } from '../core/config.js';

export const ROLE_TYPES = [
    { value: 'guard', label: 'Guard', categories: ['animal', 'summon', 'enemy'] },
    { value: 'production', label: 'Production', categories: ['animal'] },
    { value: 'pack', label: 'Pack Animal', categories: ['animal'] },
    { value: 'ranged_attacker', label: 'Ranged Attacker', categories: ['enemy', 'summon'] },
    { value: 'melee_charger', label: 'Melee Charger', categories: ['enemy', 'summon'] },
    { value: 'nexus_target', label: 'Nexus Target', categories: ['enemy'] },
    { value: 'structure_breaker', label: 'Structure Breaker', categories: ['enemy'] },
    { value: 'boss', label: 'Boss', categories: ['enemy'] },
    { value: 'worker', label: 'Worker', categories: ['golem'] },
    { value: 'flee_on_damage', label: 'Flee on Damage', categories: ['animal', 'enemy'] },
    { value: 'summoned', label: 'Summoned (expires)', categories: ['summon'] },
];

export class RolePicker {
    constructor(containerEl, options = {}) {
        this._container = containerEl;
        this._category = options.category || null;
        this._onChange = options.onChange || null;
        this._roles = [];
        this._render();
    }

    getRoles() {
        return this._roles.map(r => ({ ...r }));
    }

    setRoles(roles) {
        this._roles = (roles || []).map(r => ({ ...r }));
        this._render();
    }

    setCategory(category) {
        this._category = category;
        this._render();
    }

    clear() {
        this._roles = [];
        this._render();
    }

    _getAvailableTypes() {
        if (!this._category) return ROLE_TYPES;
        return ROLE_TYPES.filter(r => r.categories.includes(this._category));
    }

    _render() {
        const available = this._getAvailableTypes();
        let html = '';
        this._roles.forEach((role, i) => {
            html += this._renderRoleRow(role, i, available);
        });
        html += `<button class="fe-effect-add fe-role-add">+ Add Role</button>`;
        this._container.innerHTML = html;
        this._bindRowEvents(available);
    }

    _renderRoleRow(role, index, available) {
        let html = `<div class="fe-effect-row fe-role-row" data-index="${index}">`;
        html += `<div class="fe-effect-header">`;
        html += `<select class="fe-role-type" data-index="${index}">`;
        for (const t of available) {
            html += `<option value="${t.value}" ${t.value === role.type ? 'selected' : ''}>${t.label}</option>`;
        }
        html += `</select>`;
        html += `<button class="fe-effect-move-up" data-index="${index}" title="Move up">&#9650;</button>`;
        html += `<button class="fe-effect-move-down" data-index="${index}" title="Move down">&#9660;</button>`;
        html += `<button class="fe-effect-remove" data-index="${index}" title="Remove">&#10005;</button>`;
        html += `</div>`;
        html += `<div class="fe-effect-params">`;
        html += this._renderParams(role);
        html += `</div>`;
        html += `</div>`;
        return html;
    }

    _renderParams(role) {
        let html = '';
        switch (role.type) {
            case 'guard':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Guard Radius</label><input type="number" class="fe-rp-guardRadius" value="${role.guardRadius || 8}"></div>`;
                html += `<div class="fe-field"><label>Guard Damage</label><input type="number" class="fe-rp-guardDamage" value="${role.guardDamage || 8}"></div>`;
                html += `<div class="fe-field"><label>Patrol Radius</label><input type="number" class="fe-rp-patrolRadius" value="${role.patrolRadius || 3}"></div>`;
                html += `</div>`;
                break;

            case 'production':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Produces</label><input type="text" class="fe-rp-produces" value="${role.produces || 'eggs'}"></div>`;
                html += `<div class="fe-field"><label>Produce Rate (ticks)</label><input type="number" class="fe-rp-produceRate" value="${role.produceRate || 80}"></div>`;
                html += `<div class="fe-field"><label>Amount</label><input type="number" class="fe-rp-produceAmount" value="${role.produceAmount || 1}"></div>`;
                html += `</div>`;
                break;

            case 'pack':
                html += `<div class="fe-field"><label>Expedition Speed Bonus</label><input type="number" class="fe-rp-expeditionSpeedBonus" step="0.05" value="${role.expeditionSpeedBonus || 0.25}"></div>`;
                break;

            case 'ranged_attacker':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Range</label><input type="number" class="fe-rp-range" value="${role.range || 6}"></div>`;
                html += `<div class="fe-field"><label>Prefer Distance</label><input type="number" class="fe-rp-preferDistance" value="${role.preferDistance || 4}"></div>`;
                html += `</div>`;
                break;

            case 'melee_charger':
                html += `<div class="fe-field"><label>Charge Bonus Damage</label><input type="number" class="fe-rp-chargeBonus" value="${role.chargeBonus || 5}"></div>`;
                break;

            case 'nexus_target':
                html += `<div class="fe-field" style="color:#888;font-size:11px;">Paths toward and attacks the void nexus. No additional params.</div>`;
                break;

            case 'structure_breaker':
                html += `<div class="fe-field"><label>Break Speed</label><input type="number" class="fe-rp-breakSpeed" value="${role.breakSpeed || 1}"></div>`;
                break;

            case 'boss':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Enrage Threshold (0-1)</label><input type="number" class="fe-rp-enrageThreshold" step="0.05" value="${role.enrageThreshold || 0.3}"></div>`;
                html += `<div class="fe-field"><label>Enrage Damage Mult</label><input type="number" class="fe-rp-enrageDamageMult" step="0.1" value="${role.enrageDamageMult || 1.5}"></div>`;
                html += `</div>`;
                break;

            case 'worker':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Specialty</label><select class="fe-rp-specialty">
                    <option value="farming" ${role.specialty === 'farming' ? 'selected' : ''}>Farming</option>
                    <option value="building" ${role.specialty === 'building' ? 'selected' : ''}>Building/Mining</option>
                    <option value="combat" ${role.specialty === 'combat' ? 'selected' : ''}>Combat</option>
                    <option value="crafting" ${role.specialty === 'crafting' ? 'selected' : ''}>Crafting</option>
                    <option value="cooking" ${role.specialty === 'cooking' ? 'selected' : ''}>Cooking</option>
                </select></div>`;
                html += `<div class="fe-field"><label>Skill Level</label><input type="number" class="fe-rp-skillLevel" value="${role.skillLevel || 6}"></div>`;
                html += `</div>`;
                break;

            case 'flee_on_damage':
                html += `<div class="fe-field"><label>Flee Threshold (0-1)</label><input type="number" class="fe-rp-fleeThreshold" step="0.05" value="${role.fleeThreshold || 0.3}"></div>`;
                break;

            case 'summoned':
                html += `<div class="fe-field" style="color:#888;font-size:11px;">Follows owner and expires after summonDuration ticks. Set duration on the entity.</div>`;
                break;
        }
        return html;
    }

    _bindRowEvents(available) {
        this._container.querySelector('.fe-role-add')?.addEventListener('click', () => {
            const firstType = available[0];
            if (!firstType) return;
            this._roles.push({ type: firstType.value });
            this._render();
            this._fireChange();
        });

        this._container.querySelectorAll('.fe-effect-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                this._roles.splice(parseInt(btn.dataset.index), 1);
                this._render();
                this._fireChange();
            });
        });

        this._container.querySelectorAll('.fe-effect-move-up').forEach(btn => {
            btn.addEventListener('click', () => {
                const i = parseInt(btn.dataset.index);
                if (i > 0) {
                    [this._roles[i - 1], this._roles[i]] = [this._roles[i], this._roles[i - 1]];
                    this._render();
                    this._fireChange();
                }
            });
        });

        this._container.querySelectorAll('.fe-effect-move-down').forEach(btn => {
            btn.addEventListener('click', () => {
                const i = parseInt(btn.dataset.index);
                if (i < this._roles.length - 1) {
                    [this._roles[i], this._roles[i + 1]] = [this._roles[i + 1], this._roles[i]];
                    this._render();
                    this._fireChange();
                }
            });
        });

        this._container.querySelectorAll('.fe-role-type').forEach(sel => {
            sel.addEventListener('change', () => {
                const i = parseInt(sel.dataset.index);
                this._roles[i] = { type: sel.value };
                this._render();
                this._fireChange();
            });
        });

        this._container.querySelectorAll('.fe-role-row').forEach(row => {
            const i = parseInt(row.dataset.index);
            row.querySelectorAll('input, select').forEach(el => {
                if (el.classList.contains('fe-role-type')) return;
                el.addEventListener('input', () => {
                    this._collectRowData(row, i);
                    this._fireChange();
                });
                el.addEventListener('change', () => {
                    this._collectRowData(row, i);
                    this._fireChange();
                });
            });
        });
    }

    _collectRowData(row, index) {
        const role = this._roles[index];
        if (!role) return;

        switch (role.type) {
            case 'guard': {
                const gr = row.querySelector('.fe-rp-guardRadius');
                const gd = row.querySelector('.fe-rp-guardDamage');
                const pr = row.querySelector('.fe-rp-patrolRadius');
                if (gr) role.guardRadius = parseInt(gr.value) || 0;
                if (gd) role.guardDamage = parseInt(gd.value) || 0;
                if (pr) role.patrolRadius = parseInt(pr.value) || 0;
                break;
            }
            case 'production': {
                const p = row.querySelector('.fe-rp-produces');
                const r = row.querySelector('.fe-rp-produceRate');
                const a = row.querySelector('.fe-rp-produceAmount');
                if (p) role.produces = p.value.trim() || 'eggs';
                if (r) role.produceRate = parseInt(r.value) || 80;
                if (a) role.produceAmount = parseInt(a.value) || 1;
                break;
            }
            case 'pack': {
                const e = row.querySelector('.fe-rp-expeditionSpeedBonus');
                if (e) role.expeditionSpeedBonus = parseFloat(e.value) || 0;
                break;
            }
            case 'ranged_attacker': {
                const r = row.querySelector('.fe-rp-range');
                const pd = row.querySelector('.fe-rp-preferDistance');
                if (r) role.range = parseInt(r.value) || 6;
                if (pd) role.preferDistance = parseInt(pd.value) || 4;
                break;
            }
            case 'melee_charger': {
                const cb = row.querySelector('.fe-rp-chargeBonus');
                if (cb) role.chargeBonus = parseInt(cb.value) || 0;
                break;
            }
            case 'structure_breaker': {
                const bs = row.querySelector('.fe-rp-breakSpeed');
                if (bs) role.breakSpeed = parseInt(bs.value) || 1;
                break;
            }
            case 'boss': {
                const et = row.querySelector('.fe-rp-enrageThreshold');
                const em = row.querySelector('.fe-rp-enrageDamageMult');
                if (et) role.enrageThreshold = parseFloat(et.value) || 0.3;
                if (em) role.enrageDamageMult = parseFloat(em.value) || 1.5;
                break;
            }
            case 'worker': {
                const sp = row.querySelector('.fe-rp-specialty');
                const sl = row.querySelector('.fe-rp-skillLevel');
                if (sp) role.specialty = sp.value;
                if (sl) role.skillLevel = parseInt(sl.value) || 6;
                break;
            }
            case 'flee_on_damage': {
                const ft = row.querySelector('.fe-rp-fleeThreshold');
                if (ft) role.fleeThreshold = parseFloat(ft.value) || 0.3;
                break;
            }
        }
    }

    _fireChange() {
        if (this._onChange) this._onChange();
    }
}

export function formatRolesCode(roles, indent = '    ') {
    if (!roles || !roles.length) return '';
    const lines = roles.map(r => {
        const parts = [`type: '${r.type}'`];
        switch (r.type) {
            case 'guard':
                parts.push(`guardRadius: ${r.guardRadius || 8}`);
                parts.push(`guardDamage: ${r.guardDamage || 8}`);
                if (r.patrolRadius) parts.push(`patrolRadius: ${r.patrolRadius}`);
                break;
            case 'production':
                parts.push(`produces: '${r.produces || 'eggs'}'`);
                parts.push(`produceRate: ${r.produceRate || 80}`);
                parts.push(`produceAmount: ${r.produceAmount || 1}`);
                break;
            case 'pack':
                parts.push(`expeditionSpeedBonus: ${r.expeditionSpeedBonus || 0.25}`);
                break;
            case 'ranged_attacker':
                parts.push(`range: ${r.range || 6}`);
                parts.push(`preferDistance: ${r.preferDistance || 4}`);
                break;
            case 'melee_charger':
                if (r.chargeBonus) parts.push(`chargeBonus: ${r.chargeBonus}`);
                break;
            case 'structure_breaker':
                parts.push(`breakSpeed: ${r.breakSpeed || 1}`);
                break;
            case 'boss':
                parts.push(`enrageThreshold: ${r.enrageThreshold || 0.3}`);
                parts.push(`enrageDamageMult: ${r.enrageDamageMult || 1.5}`);
                break;
            case 'worker':
                parts.push(`specialty: '${r.specialty || 'farming'}'`);
                parts.push(`skillLevel: ${r.skillLevel || 6}`);
                break;
            case 'flee_on_damage':
                parts.push(`fleeThreshold: ${r.fleeThreshold || 0.3}`);
                break;
        }
        return `${indent}    { ${parts.join(', ')} }`;
    });
    return `[\n${lines.join(',\n')},\n${indent}]`;
}
