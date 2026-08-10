import { SUMMON_TYPES, STAT_META } from '../core/config.js';

export const EFFECT_TYPES = [
    { value: 'stat_bonus', label: 'Stat Bonus', contexts: ['passive', 'aura', 'buff', 'on_hit'] },
    { value: 'damage', label: 'Damage', contexts: ['on_cast', 'on_hit'] },
    { value: 'heal', label: 'Heal', contexts: ['on_cast'] },
    { value: 'buff_speed', label: 'Buff Speed', contexts: ['on_cast', 'on_hit', 'aura'] },
    { value: 'buff_defense', label: 'Buff Defense', contexts: ['on_cast', 'on_hit', 'aura'] },
    { value: 'summon', label: 'Summon', contexts: ['on_cast'] },
    { value: 'teleport', label: 'Teleport', contexts: ['on_cast'] },
    { value: 'boost_crops', label: 'Boost Crops', contexts: ['on_cast', 'aura'] },
    { value: 'terraform', label: 'Terraform', contexts: ['on_cast'] },
    { value: 'mood_aura', label: 'Mood Effect', contexts: ['passive', 'aura'] },
    { value: 'divination', label: 'Divination Modifier', contexts: ['on_cast'] },
    { value: 'damage_aura', label: 'Damage Aura', contexts: ['aura'] },
    { value: 'heal_aura', label: 'Heal Aura', contexts: ['aura'] },
    { value: 'regen', label: 'Regeneration', contexts: ['passive', 'buff'] },
    { value: 'damage_over_time', label: 'Damage Over Time', contexts: ['on_hit', 'on_cast'] },
    { value: 'lifesteal', label: 'Lifesteal', contexts: ['passive', 'on_hit'] },
    { value: 'thorns', label: 'Thorns', contexts: ['passive'] },
    { value: 'slow', label: 'Slow', contexts: ['on_hit', 'on_cast', 'aura'] },
    { value: 'stun', label: 'Stun', contexts: ['on_hit', 'on_cast'] },
    { value: 'knockback', label: 'Knockback', contexts: ['on_hit', 'on_cast'] },
    { value: 'shield', label: 'Shield', contexts: ['on_cast', 'buff'] },
    { value: 'taunt', label: 'Taunt', contexts: ['aura'] },
    { value: 'stealth', label: 'Stealth', contexts: ['buff', 'passive'] },
    { value: 'resource_aura', label: 'Resource Aura', contexts: ['aura'] },
    { value: 'xp_boost', label: 'XP Boost', contexts: ['passive', 'aura'] },
    { value: 'weather_resist', label: 'Weather Resist', contexts: ['passive', 'aura'] },
    { value: 'spawn_block', label: 'Spawn Block', contexts: ['aura'] },
    { value: 'lure', label: 'Lure', contexts: ['aura'] },
    { value: 'fear', label: 'Fear', contexts: ['aura', 'on_cast'] },
    { value: 'revive', label: 'Revive', contexts: ['on_cast'] },
    { value: 'transform_terrain', label: 'Transform Terrain', contexts: ['passive', 'aura'] },
];

export const STAT_KEYS = Object.entries(STAT_META).map(([value, m]) => ({ value, label: m.label }));

export const CONTEXTS = [
    { value: 'passive', label: 'Passive' },
    { value: 'aura', label: 'Aura' },
    { value: 'buff', label: 'Buff (timed)' },
    { value: 'on_cast', label: 'On Cast' },
    { value: 'on_hit', label: 'On Hit' },
];

export const STACKING_MODES = [
    { value: 'additive', label: 'Additive' },
    { value: 'strongest', label: 'Strongest Only' },
    { value: 'independent', label: 'Independent' },
];

export class EffectPicker {
    constructor(containerEl, options = {}) {
        this._container = containerEl;
        this._allowedContexts = options.allowedContexts || CONTEXTS.map(c => c.value);
        this._onChange = options.onChange || null;
        this._effects = [];
        this._render();
    }

    getEffects() {
        return this._effects.map(e => ({ ...e }));
    }

    setEffects(effects) {
        this._effects = (effects || []).map(e => ({ ...e }));
        this._render();
    }

    clear() {
        this._effects = [];
        this._render();
    }

    _render() {
        let html = '';
        this._effects.forEach((effect, i) => {
            html += this._renderEffectRow(effect, i);
        });
        html += `<button class="fe-effect-add">+ Add Effect</button>`;
        this._container.innerHTML = html;
        this._bindRowEvents();
    }

    _renderEffectRow(effect, index) {
        const typeInfo = EFFECT_TYPES.find(t => t.value === effect.type) || EFFECT_TYPES[0];
        const availableContexts = typeInfo.contexts.filter(c => this._allowedContexts.includes(c));

        let html = `<div class="fe-effect-row" data-index="${index}">`;
        html += `<div class="fe-effect-header">`;
        html += `<select class="fe-effect-type" data-index="${index}">`;
        for (const t of EFFECT_TYPES) {
            const hasContext = t.contexts.some(c => this._allowedContexts.includes(c));
            if (!hasContext) continue;
            html += `<option value="${t.value}" ${t.value === effect.type ? 'selected' : ''}>${t.label}</option>`;
        }
        html += `</select>`;

        if (availableContexts.length > 1) {
            html += `<select class="fe-effect-context" data-index="${index}">`;
            for (const c of availableContexts) {
                const label = CONTEXTS.find(x => x.value === c)?.label || c;
                html += `<option value="${c}" ${c === effect.context ? 'selected' : ''}>${label}</option>`;
            }
            html += `</select>`;
        }

        html += `<select class="fe-effect-stacking" data-index="${index}">`;
        for (const s of STACKING_MODES) {
            html += `<option value="${s.value}" ${s.value === (effect.stacking || 'additive') ? 'selected' : ''}>${s.label}</option>`;
        }
        html += `</select>`;

        html += `<button class="fe-effect-move-up" data-index="${index}" title="Move up">&#9650;</button>`;
        html += `<button class="fe-effect-move-down" data-index="${index}" title="Move down">&#9660;</button>`;
        html += `<button class="fe-effect-remove" data-index="${index}" title="Remove">&#10005;</button>`;
        html += `</div>`;

        html += `<div class="fe-effect-params">`;
        html += this._renderParams(effect);
        html += `</div>`;
        html += `</div>`;
        return html;
    }

    _renderParams(effect) {
        let html = '';
        switch (effect.type) {
            case 'stat_bonus':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Stat</label><select class="fe-ep-stat">`;
                for (const s of STAT_KEYS) {
                    html += `<option value="${s.value}" ${s.value === effect.stat ? 'selected' : ''}>${s.label}</option>`;
                }
                html += `</select></div>`;
                html += `<div class="fe-field"><label>Value</label><input type="number" class="fe-ep-value" step="0.05" value="${effect.value || 0}"></div>`;
                html += `</div>`;
                break;

            case 'damage':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Damage</label><input type="number" class="fe-ep-value" value="${effect.value || 10}"></div>`;
                html += `<div class="fe-field"><label>Range</label><input type="number" class="fe-ep-range" value="${effect.range || 5}"></div>`;
                html += `<div class="fe-field"><label>Radius (0=single)</label><input type="number" class="fe-ep-radius" value="${effect.radius || 0}"></div>`;
                html += `</div>`;
                html += `<div class="fe-row">`;
                html += `<div class="fe-field" style="flex:0 0 60px;"><label>Proj Char</label><input type="text" class="fe-ep-projChar" maxlength="2" value="${effect.projectileChar || '*'}"></div>`;
                html += `<div class="fe-field" style="flex:0 0 60px;"><label>Color</label><input type="color" class="fe-ep-projColor" value="${effect.projectileColor || '#ffaa33'}"></div>`;
                html += `</div>`;
                break;

            case 'heal':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Heal Amount</label><input type="number" class="fe-ep-value" value="${effect.value || 15}"></div>`;
                html += `<div class="fe-field"><label>HP Threshold (0-1)</label><input type="number" class="fe-ep-hpThreshold" step="0.05" min="0" max="1" value="${effect.hpThreshold || 0.5}"></div>`;
                html += `</div>`;
                html += `<div class="fe-checkbox-row"><input type="checkbox" class="fe-ep-targetSelf" ${effect.targetSelf ? 'checked' : ''}><label>Target Self</label></div>`;
                break;

            case 'buff_speed':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Move Speed</label><input type="number" class="fe-ep-moveSpeed" step="0.1" value="${effect.moveSpeedBonus || 0}"></div>`;
                html += `<div class="fe-field"><label>Work Speed</label><input type="number" class="fe-ep-workSpeed" step="0.1" value="${effect.workSpeedBonus || 0}"></div>`;
                html += `<div class="fe-field"><label>Duration</label><input type="number" class="fe-ep-duration" value="${effect.duration || 60}"></div>`;
                html += `</div>`;
                break;

            case 'buff_defense':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Damage Reduction (0-1)</label><input type="number" class="fe-ep-damageReduction" step="0.05" min="0" max="1" value="${effect.damageReduction || 0.3}"></div>`;
                html += `<div class="fe-field"><label>Duration</label><input type="number" class="fe-ep-duration" value="${effect.duration || 60}"></div>`;
                html += `</div>`;
                break;

            case 'summon':
                html += `<div class="fe-field"><label>Summon Type</label><select class="fe-ep-summonType">`;
                for (const k of Object.keys(SUMMON_TYPES)) {
                    html += `<option value="${k}" ${k === effect.summonType ? 'selected' : ''}>${k}</option>`;
                }
                html += `</select></div>`;
                break;

            case 'teleport':
                html += `<div class="fe-field"><label>Range</label><input type="number" class="fe-ep-range" value="${effect.range || 20}"></div>`;
                break;

            case 'boost_crops':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Range</label><input type="number" class="fe-ep-range" value="${effect.range || 5}"></div>`;
                html += `<div class="fe-field"><label>Radius</label><input type="number" class="fe-ep-radius" value="${effect.radius || 2}"></div>`;
                html += `</div>`;
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Growth Mult</label><input type="number" class="fe-ep-growthMult" step="0.1" value="${effect.growthMult || 1.5}"></div>`;
                html += `<div class="fe-field"><label>Duration</label><input type="number" class="fe-ep-duration" value="${effect.duration || 100}"></div>`;
                html += `</div>`;
                break;

            case 'terraform':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Range</label><input type="number" class="fe-ep-range" value="${effect.range || 8}"></div>`;
                html += `<div class="fe-field"><label>Radius</label><input type="number" class="fe-ep-radius" value="${effect.radius || 3}"></div>`;
                html += `</div>`;
                html += `<div class="fe-field"><label>Target Terrain</label><input type="text" class="fe-ep-targetTerrain" value="${effect.targetTerrain || 'grass'}"></div>`;
                break;

            case 'mood_aura':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Scope</label><select class="fe-ep-scope">`;
                html += `<option value="aura" ${(effect.scope || 'aura') === 'aura' ? 'selected' : ''}>Aura (radius)</option>`;
                html += `<option value="self" ${effect.scope === 'self' ? 'selected' : ''}>Self</option>`;
                html += `<option value="global" ${effect.scope === 'global' ? 'selected' : ''}>Global (all colonists)</option>`;
                html += `</select></div>`;
                html += `<div class="fe-field"><label>Mood Bonus</label><input type="number" class="fe-ep-moodBonus" value="${effect.moodBonus || 5}"></div>`;
                html += `</div>`;
                if ((effect.scope || 'aura') === 'aura') {
                    html += `<div class="fe-row"><div class="fe-field"><label>Radius</label><input type="number" class="fe-ep-radius" value="${effect.radius || 5}"></div></div>`;
                }
                break;

            case 'divination':
                html += `<div class="fe-field"><label>Modifiers (JSON)</label><input type="text" class="fe-ep-modifiers" value='${JSON.stringify(effect.modifiers || {})}'></div>`;
                html += `<div class="fe-field"><label>Duration</label><input type="number" class="fe-ep-duration" value="${effect.duration || 300}"></div>`;
                break;

            case 'damage_aura':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Radius</label><input type="number" class="fe-ep-radius" value="${effect.radius || 5}"></div>`;
                html += `<div class="fe-field"><label>Damage</label><input type="number" class="fe-ep-damage" value="${effect.damage || 3}"></div>`;
                html += `<div class="fe-field"><label>Tick Rate</label><input type="number" class="fe-ep-tickRate" value="${effect.tickRate || 20}"></div>`;
                html += `</div>`;
                break;

            case 'heal_aura':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Radius</label><input type="number" class="fe-ep-radius" value="${effect.radius || 5}"></div>`;
                html += `<div class="fe-field"><label>Heal Amount</label><input type="number" class="fe-ep-healAmount" value="${effect.healAmount || 2}"></div>`;
                html += `<div class="fe-field"><label>Tick Rate</label><input type="number" class="fe-ep-tickRate" value="${effect.tickRate || 30}"></div>`;
                html += `</div>`;
                break;

            case 'regen':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>HP Per Tick</label><input type="number" class="fe-ep-hpPerTick" value="${effect.hpPerTick || 1}"></div>`;
                html += `<div class="fe-field"><label>Duration (0=infinite)</label><input type="number" class="fe-ep-duration" value="${effect.duration || 0}"></div>`;
                html += `</div>`;
                break;

            case 'damage_over_time':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Damage/Tick</label><input type="number" class="fe-ep-damage" value="${effect.damage || 3}"></div>`;
                html += `<div class="fe-field"><label>Ticks</label><input type="number" class="fe-ep-ticks" value="${effect.ticks || 5}"></div>`;
                html += `<div class="fe-field"><label>Tick Rate</label><input type="number" class="fe-ep-tickRate" value="${effect.tickRate || 15}"></div>`;
                html += `</div>`;
                break;

            case 'lifesteal':
                html += `<div class="fe-field"><label>Percent (0-1)</label><input type="number" class="fe-ep-percent" step="0.05" min="0" max="1" value="${effect.percent || 0.15}"></div>`;
                break;

            case 'thorns':
                html += `<div class="fe-field"><label>Reflect Percent (0-1)</label><input type="number" class="fe-ep-reflectPercent" step="0.05" min="0" max="1" value="${effect.reflectPercent || 0.25}"></div>`;
                break;

            case 'slow':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Speed Reduction (0-1)</label><input type="number" class="fe-ep-moveSpeedReduction" step="0.05" min="0" max="1" value="${effect.moveSpeedReduction || 0.3}"></div>`;
                html += `<div class="fe-field"><label>Duration</label><input type="number" class="fe-ep-duration" value="${effect.duration || 40}"></div>`;
                html += `</div>`;
                if (effect.context === 'aura') {
                    html += `<div class="fe-field"><label>Radius</label><input type="number" class="fe-ep-radius" value="${effect.radius || 5}"></div>`;
                }
                break;

            case 'stun':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Duration (ticks)</label><input type="number" class="fe-ep-duration" value="${effect.duration || 15}"></div>`;
                html += `<div class="fe-field"><label>Chance (0-1)</label><input type="number" class="fe-ep-chance" step="0.05" min="0" max="1" value="${effect.chance || 0.2}"></div>`;
                html += `</div>`;
                break;

            case 'knockback':
                html += `<div class="fe-field"><label>Distance (tiles)</label><input type="number" class="fe-ep-distance" value="${effect.distance || 3}"></div>`;
                break;

            case 'shield':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Absorb HP</label><input type="number" class="fe-ep-absorb" value="${effect.absorb || 20}"></div>`;
                html += `<div class="fe-field"><label>Duration</label><input type="number" class="fe-ep-duration" value="${effect.duration || 100}"></div>`;
                html += `</div>`;
                break;

            case 'taunt':
                html += `<div class="fe-field"><label>Radius</label><input type="number" class="fe-ep-radius" value="${effect.radius || 6}"></div>`;
                break;

            case 'stealth':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Duration (0=infinite)</label><input type="number" class="fe-ep-duration" value="${effect.duration || 0}"></div>`;
                html += `</div>`;
                html += `<div class="fe-checkbox-row"><input type="checkbox" class="fe-ep-breakOnAttack" ${effect.breakOnAttack !== false ? 'checked' : ''}><label>Break on Attack</label></div>`;
                break;

            case 'resource_aura':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Radius</label><input type="number" class="fe-ep-radius" value="${effect.radius || 5}"></div>`;
                html += `<div class="fe-field"><label>Resource</label><input type="text" class="fe-ep-resource" value="${effect.resource || 'research'}"></div>`;
                html += `<div class="fe-field"><label>Amount/Tick</label><input type="number" class="fe-ep-amountPerTick" step="0.1" value="${effect.amountPerTick || 0.5}"></div>`;
                html += `</div>`;
                break;

            case 'xp_boost':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Multiplier</label><input type="number" class="fe-ep-multiplier" step="0.1" value="${effect.multiplier || 1.5}"></div>`;
                html += `<div class="fe-field"><label>Radius (if aura)</label><input type="number" class="fe-ep-radius" value="${effect.radius || 5}"></div>`;
                html += `</div>`;
                break;

            case 'weather_resist':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Radius (if aura)</label><input type="number" class="fe-ep-radius" value="${effect.radius || 5}"></div>`;
                html += `<div class="fe-field"><label>Resist Type</label><select class="fe-ep-resistType">
                    <option value="cold" ${effect.resistType === 'cold' ? 'selected' : ''}>Cold</option>
                    <option value="rain" ${effect.resistType === 'rain' ? 'selected' : ''}>Rain</option>
                    <option value="all" ${effect.resistType === 'all' ? 'selected' : ''}>All</option>
                </select></div>`;
                html += `</div>`;
                break;

            case 'spawn_block':
                html += `<div class="fe-field"><label>Radius</label><input type="number" class="fe-ep-radius" value="${effect.radius || 8}"></div>`;
                break;

            case 'lure':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Radius</label><input type="number" class="fe-ep-radius" value="${effect.radius || 10}"></div>`;
                html += `<div class="fe-field"><label>Entity Type</label><input type="text" class="fe-ep-entityType" value="${effect.entityType || ''}"></div>`;
                html += `</div>`;
                break;

            case 'fear':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Radius</label><input type="number" class="fe-ep-radius" value="${effect.radius || 6}"></div>`;
                html += `<div class="fe-field"><label>Duration</label><input type="number" class="fe-ep-duration" value="${effect.duration || 40}"></div>`;
                html += `</div>`;
                break;

            case 'revive':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>HP Percent (0-1)</label><input type="number" class="fe-ep-hpPercent" step="0.05" min="0" max="1" value="${effect.hpPercent || 0.5}"></div>`;
                html += `<div class="fe-field"><label>Range</label><input type="number" class="fe-ep-range" value="${effect.range || 5}"></div>`;
                html += `</div>`;
                html += `<div class="fe-checkbox-row"><input type="checkbox" class="fe-ep-reviveColonists" ${effect.reviveColonists ? 'checked' : ''}><label>Can Revive Colonists (if colony has space)</label></div>`;
                break;

            case 'transform_terrain':
                html += `<div class="fe-row">`;
                html += `<div class="fe-field"><label>Radius</label><input type="number" class="fe-ep-radius" value="${effect.radius || 3}"></div>`;
                html += `<div class="fe-field"><label>Terrain</label><input type="text" class="fe-ep-terrain" value="${effect.terrain || 'grass'}"></div>`;
                html += `<div class="fe-field"><label>Tick Rate</label><input type="number" class="fe-ep-tickRate" value="${effect.tickRate || 50}"></div>`;
                html += `</div>`;
                break;
        }

        const typesWithOwnRadius = ['mood_aura', 'damage_aura', 'heal_aura', 'slow', 'taunt',
            'resource_aura', 'xp_boost', 'weather_resist', 'spawn_block', 'lure', 'fear',
            'transform_terrain', 'boost_crops', 'damage', 'terraform'];
        if (effect.context === 'aura' && !typesWithOwnRadius.includes(effect.type)) {
            html += `<div class="fe-field"><label>Aura Radius</label><input type="number" class="fe-ep-auraRadius" value="${effect.radius || 5}"></div>`;
        }

        return html;
    }

    _bindRowEvents() {
        this._container.querySelector('.fe-effect-add')?.addEventListener('click', () => {
            const firstType = EFFECT_TYPES.find(t => t.contexts.some(c => this._allowedContexts.includes(c)));
            const ctx = firstType.contexts.find(c => this._allowedContexts.includes(c));
            this._effects.push({ type: firstType.value, context: ctx });
            this._render();
            this._fireChange();
        });

        this._container.querySelectorAll('.fe-effect-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                this._effects.splice(parseInt(btn.dataset.index), 1);
                this._render();
                this._fireChange();
            });
        });

        this._container.querySelectorAll('.fe-effect-move-up').forEach(btn => {
            btn.addEventListener('click', () => {
                const i = parseInt(btn.dataset.index);
                if (i > 0) {
                    [this._effects[i - 1], this._effects[i]] = [this._effects[i], this._effects[i - 1]];
                    this._render();
                    this._fireChange();
                }
            });
        });

        this._container.querySelectorAll('.fe-effect-move-down').forEach(btn => {
            btn.addEventListener('click', () => {
                const i = parseInt(btn.dataset.index);
                if (i < this._effects.length - 1) {
                    [this._effects[i], this._effects[i + 1]] = [this._effects[i + 1], this._effects[i]];
                    this._render();
                    this._fireChange();
                }
            });
        });

        this._container.querySelectorAll('.fe-effect-type').forEach(sel => {
            sel.addEventListener('change', () => {
                const i = parseInt(sel.dataset.index);
                const newType = sel.value;
                const typeInfo = EFFECT_TYPES.find(t => t.value === newType);
                const validCtx = typeInfo.contexts.find(c => this._allowedContexts.includes(c));
                this._effects[i] = { type: newType, context: validCtx };
                this._render();
                this._fireChange();
            });
        });

        this._container.querySelectorAll('.fe-effect-context').forEach(sel => {
            sel.addEventListener('change', () => {
                const i = parseInt(sel.dataset.index);
                this._effects[i].context = sel.value;
                this._render();
                this._fireChange();
            });
        });

        this._container.querySelectorAll('.fe-effect-stacking').forEach(sel => {
            sel.addEventListener('change', () => {
                const i = parseInt(sel.dataset.index);
                this._effects[i].stacking = sel.value;
                this._fireChange();
            });
        });

        this._container.querySelectorAll('.fe-effect-row').forEach(row => {
            const i = parseInt(row.dataset.index);
            row.querySelectorAll('input, select').forEach(el => {
                if (el.classList.contains('fe-effect-type') || el.classList.contains('fe-effect-context')) return;
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
        const effect = this._effects[index];
        if (!effect) return;

        switch (effect.type) {
            case 'stat_bonus': {
                const stat = row.querySelector('.fe-ep-stat');
                const value = row.querySelector('.fe-ep-value');
                if (stat) effect.stat = stat.value;
                if (value) effect.value = parseFloat(value.value) || 0;
                break;
            }
            case 'damage': {
                const value = row.querySelector('.fe-ep-value');
                const range = row.querySelector('.fe-ep-range');
                const radius = row.querySelector('.fe-ep-radius');
                const projChar = row.querySelector('.fe-ep-projChar');
                const projColor = row.querySelector('.fe-ep-projColor');
                if (value) effect.value = parseInt(value.value) || 0;
                if (range) effect.range = parseInt(range.value) || 0;
                if (radius) {
                    const r = parseInt(radius.value) || 0;
                    if (r > 0) effect.radius = r;
                    else delete effect.radius;
                }
                if (projChar) effect.projectileChar = projChar.value || '*';
                if (projColor) effect.projectileColor = projColor.value;
                break;
            }
            case 'heal': {
                const value = row.querySelector('.fe-ep-value');
                const threshold = row.querySelector('.fe-ep-hpThreshold');
                const targetSelf = row.querySelector('.fe-ep-targetSelf');
                if (value) effect.value = parseInt(value.value) || 0;
                if (threshold) effect.hpThreshold = parseFloat(threshold.value) || 0;
                if (targetSelf) effect.targetSelf = targetSelf.checked;
                break;
            }
            case 'buff_speed': {
                const move = row.querySelector('.fe-ep-moveSpeed');
                const work = row.querySelector('.fe-ep-workSpeed');
                const dur = row.querySelector('.fe-ep-duration');
                if (move) effect.moveSpeedBonus = parseFloat(move.value) || 0;
                if (work) effect.workSpeedBonus = parseFloat(work.value) || 0;
                if (dur) effect.duration = parseInt(dur.value) || 0;
                break;
            }
            case 'buff_defense': {
                const dr = row.querySelector('.fe-ep-damageReduction');
                const dur = row.querySelector('.fe-ep-duration');
                if (dr) effect.damageReduction = parseFloat(dr.value) || 0;
                if (dur) effect.duration = parseInt(dur.value) || 0;
                break;
            }
            case 'summon': {
                const st = row.querySelector('.fe-ep-summonType');
                if (st) effect.summonType = st.value;
                break;
            }
            case 'teleport': {
                const range = row.querySelector('.fe-ep-range');
                if (range) effect.range = parseInt(range.value) || 0;
                break;
            }
            case 'boost_crops': {
                const range = row.querySelector('.fe-ep-range');
                const radius = row.querySelector('.fe-ep-radius');
                const mult = row.querySelector('.fe-ep-growthMult');
                const dur = row.querySelector('.fe-ep-duration');
                if (range) effect.range = parseInt(range.value) || 0;
                if (radius) effect.radius = parseInt(radius.value) || 0;
                if (mult) effect.growthMult = parseFloat(mult.value) || 1;
                if (dur) effect.duration = parseInt(dur.value) || 0;
                break;
            }
            case 'terraform': {
                const range = row.querySelector('.fe-ep-range');
                const radius = row.querySelector('.fe-ep-radius');
                const terrain = row.querySelector('.fe-ep-targetTerrain');
                if (range) effect.range = parseInt(range.value) || 0;
                if (radius) effect.radius = parseInt(radius.value) || 0;
                if (terrain) effect.targetTerrain = terrain.value.trim() || 'grass';
                break;
            }
            case 'mood_aura': {
                const scope = row.querySelector('.fe-ep-scope');
                const radius = row.querySelector('.fe-ep-radius');
                const mood = row.querySelector('.fe-ep-moodBonus');
                if (scope) effect.scope = scope.value;
                if (radius) effect.radius = parseInt(radius.value) || 0;
                if (mood) effect.moodBonus = parseInt(mood.value) || 0;
                break;
            }
            case 'divination': {
                const mods = row.querySelector('.fe-ep-modifiers');
                const dur = row.querySelector('.fe-ep-duration');
                if (mods) {
                    try { effect.modifiers = JSON.parse(mods.value); } catch {}
                }
                if (dur) effect.duration = parseInt(dur.value) || 0;
                break;
            }
            case 'damage_aura': {
                const radius = row.querySelector('.fe-ep-radius');
                const damage = row.querySelector('.fe-ep-damage');
                const tickRate = row.querySelector('.fe-ep-tickRate');
                if (radius) effect.radius = parseInt(radius.value) || 0;
                if (damage) effect.damage = parseInt(damage.value) || 0;
                if (tickRate) effect.tickRate = parseInt(tickRate.value) || 20;
                break;
            }
            case 'heal_aura': {
                const radius = row.querySelector('.fe-ep-radius');
                const healAmount = row.querySelector('.fe-ep-healAmount');
                const tickRate = row.querySelector('.fe-ep-tickRate');
                if (radius) effect.radius = parseInt(radius.value) || 0;
                if (healAmount) effect.healAmount = parseInt(healAmount.value) || 0;
                if (tickRate) effect.tickRate = parseInt(tickRate.value) || 30;
                break;
            }
            case 'regen': {
                const hpPerTick = row.querySelector('.fe-ep-hpPerTick');
                const dur = row.querySelector('.fe-ep-duration');
                if (hpPerTick) effect.hpPerTick = parseInt(hpPerTick.value) || 0;
                if (dur) effect.duration = parseInt(dur.value) || 0;
                break;
            }
            case 'damage_over_time': {
                const damage = row.querySelector('.fe-ep-damage');
                const ticks = row.querySelector('.fe-ep-ticks');
                const tickRate = row.querySelector('.fe-ep-tickRate');
                if (damage) effect.damage = parseInt(damage.value) || 0;
                if (ticks) effect.ticks = parseInt(ticks.value) || 0;
                if (tickRate) effect.tickRate = parseInt(tickRate.value) || 15;
                break;
            }
            case 'lifesteal': {
                const percent = row.querySelector('.fe-ep-percent');
                if (percent) effect.percent = parseFloat(percent.value) || 0;
                break;
            }
            case 'thorns': {
                const rp = row.querySelector('.fe-ep-reflectPercent');
                if (rp) effect.reflectPercent = parseFloat(rp.value) || 0;
                break;
            }
            case 'slow': {
                const reduction = row.querySelector('.fe-ep-moveSpeedReduction');
                const dur = row.querySelector('.fe-ep-duration');
                const radius = row.querySelector('.fe-ep-radius');
                if (reduction) effect.moveSpeedReduction = parseFloat(reduction.value) || 0;
                if (dur) effect.duration = parseInt(dur.value) || 0;
                if (radius) effect.radius = parseInt(radius.value) || 0;
                break;
            }
            case 'stun': {
                const dur = row.querySelector('.fe-ep-duration');
                const chance = row.querySelector('.fe-ep-chance');
                if (dur) effect.duration = parseInt(dur.value) || 0;
                if (chance) effect.chance = parseFloat(chance.value) || 0;
                break;
            }
            case 'knockback': {
                const dist = row.querySelector('.fe-ep-distance');
                if (dist) effect.distance = parseInt(dist.value) || 0;
                break;
            }
            case 'shield': {
                const absorb = row.querySelector('.fe-ep-absorb');
                const dur = row.querySelector('.fe-ep-duration');
                if (absorb) effect.absorb = parseInt(absorb.value) || 0;
                if (dur) effect.duration = parseInt(dur.value) || 0;
                break;
            }
            case 'taunt': {
                const radius = row.querySelector('.fe-ep-radius');
                if (radius) effect.radius = parseInt(radius.value) || 0;
                break;
            }
            case 'stealth': {
                const dur = row.querySelector('.fe-ep-duration');
                const boa = row.querySelector('.fe-ep-breakOnAttack');
                if (dur) effect.duration = parseInt(dur.value) || 0;
                if (boa) effect.breakOnAttack = boa.checked;
                break;
            }
            case 'resource_aura': {
                const radius = row.querySelector('.fe-ep-radius');
                const resource = row.querySelector('.fe-ep-resource');
                const amount = row.querySelector('.fe-ep-amountPerTick');
                if (radius) effect.radius = parseInt(radius.value) || 0;
                if (resource) effect.resource = resource.value.trim() || 'research';
                if (amount) effect.amountPerTick = parseFloat(amount.value) || 0;
                break;
            }
            case 'xp_boost': {
                const mult = row.querySelector('.fe-ep-multiplier');
                const radius = row.querySelector('.fe-ep-radius');
                if (mult) effect.multiplier = parseFloat(mult.value) || 1;
                if (radius) effect.radius = parseInt(radius.value) || 0;
                break;
            }
            case 'weather_resist': {
                const radius = row.querySelector('.fe-ep-radius');
                const resist = row.querySelector('.fe-ep-resistType');
                if (radius) effect.radius = parseInt(radius.value) || 0;
                if (resist) effect.resistType = resist.value;
                break;
            }
            case 'spawn_block': {
                const radius = row.querySelector('.fe-ep-radius');
                if (radius) effect.radius = parseInt(radius.value) || 0;
                break;
            }
            case 'lure': {
                const radius = row.querySelector('.fe-ep-radius');
                const entityType = row.querySelector('.fe-ep-entityType');
                if (radius) effect.radius = parseInt(radius.value) || 0;
                if (entityType) effect.entityType = entityType.value.trim();
                break;
            }
            case 'fear': {
                const radius = row.querySelector('.fe-ep-radius');
                const dur = row.querySelector('.fe-ep-duration');
                if (radius) effect.radius = parseInt(radius.value) || 0;
                if (dur) effect.duration = parseInt(dur.value) || 0;
                break;
            }
            case 'revive': {
                const hpPercent = row.querySelector('.fe-ep-hpPercent');
                const range = row.querySelector('.fe-ep-range');
                const reviveColonists = row.querySelector('.fe-ep-reviveColonists');
                if (hpPercent) effect.hpPercent = parseFloat(hpPercent.value) || 0;
                if (range) effect.range = parseInt(range.value) || 0;
                if (reviveColonists) effect.reviveColonists = reviveColonists.checked;
                break;
            }
            case 'transform_terrain': {
                const radius = row.querySelector('.fe-ep-radius');
                const terrain = row.querySelector('.fe-ep-terrain');
                const tickRate = row.querySelector('.fe-ep-tickRate');
                if (radius) effect.radius = parseInt(radius.value) || 0;
                if (terrain) effect.terrain = terrain.value.trim() || 'grass';
                if (tickRate) effect.tickRate = parseInt(tickRate.value) || 50;
                break;
            }
        }

        const auraRadius = row.querySelector('.fe-ep-auraRadius');
        if (auraRadius && effect.context === 'aura') {
            effect.radius = parseInt(auraRadius.value) || 5;
        }
    }

    _fireChange() {
        if (this._onChange) this._onChange();
    }
}

export function formatEffectsCode(effects, indent = '    ') {
    if (!effects || !effects.length) return '';
    const lines = effects.map(e => {
        const parts = [];
        parts.push(`type: '${e.type}'`);
        if (e.context) parts.push(`context: '${e.context}'`);
        if (e.stacking && e.stacking !== 'additive') parts.push(`stacking: '${e.stacking}'`);
        switch (e.type) {
            case 'stat_bonus':
                parts.push(`stat: '${e.stat}'`);
                parts.push(`value: ${e.value}`);
                break;
            case 'damage':
                parts.push(`value: ${e.value}`);
                parts.push(`range: ${e.range}`);
                if (e.radius) parts.push(`radius: ${e.radius}`);
                if (e.projectileChar) parts.push(`projectileChar: '${e.projectileChar}'`);
                if (e.projectileColor) parts.push(`projectileColor: '${e.projectileColor}'`);
                break;
            case 'heal':
                parts.push(`value: ${e.value}`);
                if (e.hpThreshold) parts.push(`hpThreshold: ${e.hpThreshold}`);
                if (e.targetSelf) parts.push(`targetSelf: true`);
                break;
            case 'buff_speed':
                if (e.moveSpeedBonus) parts.push(`moveSpeedBonus: ${e.moveSpeedBonus}`);
                if (e.workSpeedBonus) parts.push(`workSpeedBonus: ${e.workSpeedBonus}`);
                parts.push(`duration: ${e.duration}`);
                break;
            case 'buff_defense':
                parts.push(`damageReduction: ${e.damageReduction}`);
                parts.push(`duration: ${e.duration}`);
                break;
            case 'summon':
                parts.push(`summonType: '${e.summonType}'`);
                break;
            case 'teleport':
                parts.push(`range: ${e.range}`);
                break;
            case 'boost_crops':
                parts.push(`range: ${e.range}`);
                parts.push(`radius: ${e.radius}`);
                parts.push(`growthMult: ${e.growthMult}`);
                parts.push(`duration: ${e.duration}`);
                break;
            case 'terraform':
                parts.push(`range: ${e.range}`);
                parts.push(`radius: ${e.radius}`);
                parts.push(`targetTerrain: '${e.targetTerrain}'`);
                break;
            case 'mood_aura':
                parts.push(`scope: ${e.scope || 'aura'}`);
                parts.push(`moodBonus: ${e.moodBonus}`);
                if ((e.scope || 'aura') === 'aura') parts.push(`radius: ${e.radius}`);
                break;
            case 'divination':
                parts.push(`modifiers: ${JSON.stringify(e.modifiers || {})}`);
                parts.push(`duration: ${e.duration}`);
                break;
            case 'damage_aura':
                parts.push(`radius: ${e.radius}`);
                parts.push(`damage: ${e.damage}`);
                parts.push(`tickRate: ${e.tickRate}`);
                break;
            case 'heal_aura':
                parts.push(`radius: ${e.radius}`);
                parts.push(`healAmount: ${e.healAmount}`);
                parts.push(`tickRate: ${e.tickRate}`);
                break;
            case 'regen':
                parts.push(`hpPerTick: ${e.hpPerTick}`);
                if (e.duration) parts.push(`duration: ${e.duration}`);
                break;
            case 'damage_over_time':
                parts.push(`damage: ${e.damage}`);
                parts.push(`ticks: ${e.ticks}`);
                parts.push(`tickRate: ${e.tickRate}`);
                break;
            case 'lifesteal':
                parts.push(`percent: ${e.percent}`);
                break;
            case 'thorns':
                parts.push(`reflectPercent: ${e.reflectPercent}`);
                break;
            case 'slow':
                parts.push(`moveSpeedReduction: ${e.moveSpeedReduction}`);
                parts.push(`duration: ${e.duration}`);
                if (e.radius) parts.push(`radius: ${e.radius}`);
                break;
            case 'stun':
                parts.push(`duration: ${e.duration}`);
                parts.push(`chance: ${e.chance}`);
                break;
            case 'knockback':
                parts.push(`distance: ${e.distance}`);
                break;
            case 'shield':
                parts.push(`absorb: ${e.absorb}`);
                parts.push(`duration: ${e.duration}`);
                break;
            case 'taunt':
                parts.push(`radius: ${e.radius}`);
                break;
            case 'stealth':
                if (e.duration) parts.push(`duration: ${e.duration}`);
                parts.push(`breakOnAttack: ${e.breakOnAttack !== false}`);
                break;
            case 'resource_aura':
                parts.push(`radius: ${e.radius}`);
                parts.push(`resource: '${e.resource}'`);
                parts.push(`amountPerTick: ${e.amountPerTick}`);
                break;
            case 'xp_boost':
                parts.push(`multiplier: ${e.multiplier}`);
                if (e.radius) parts.push(`radius: ${e.radius}`);
                break;
            case 'weather_resist':
                if (e.radius) parts.push(`radius: ${e.radius}`);
                parts.push(`resistType: '${e.resistType || 'cold'}'`);
                break;
            case 'spawn_block':
                parts.push(`radius: ${e.radius}`);
                break;
            case 'lure':
                parts.push(`radius: ${e.radius}`);
                if (e.entityType) parts.push(`entityType: '${e.entityType}'`);
                break;
            case 'fear':
                parts.push(`radius: ${e.radius}`);
                parts.push(`duration: ${e.duration}`);
                break;
            case 'revive':
                parts.push(`hpPercent: ${e.hpPercent}`);
                parts.push(`range: ${e.range}`);
                if (e.reviveColonists) parts.push(`reviveColonists: true`);
                break;
            case 'transform_terrain':
                parts.push(`radius: ${e.radius}`);
                parts.push(`terrain: '${e.terrain}'`);
                parts.push(`tickRate: ${e.tickRate}`);
                break;
        }
        if (e.context === 'aura' && e.type !== 'mood_aura' && e.radius) {
            if (!parts.some(p => p.startsWith('radius:'))) {
                parts.push(`radius: ${e.radius}`);
            }
        }
        return `${indent}    { ${parts.join(', ')} }`;
    });
    return `${indent}effects: [\n${lines.join(',\n')},\n${indent}]`;
}
