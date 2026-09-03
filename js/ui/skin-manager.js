import { EQUIPMENT_OVERLAY_OFFSETS, RENDER_CONFIG } from '../core/config.js';

export class SkinManager {
    constructor() {
        this._sprites = new Map();
        this._skinNames = ['ascii'];
        this._activeSkin = 'ascii';
        this._humanBodyCount = 0;
        this._nymphBodyCount = 0;
        this._ferinBodyCount = 0;
        this._kobalosBodyCount = 0;
        this._bufosBodyCount = 0;
        this._hairCount = 0;
        this._shirtCount = 0;
        this._compositeCache = new Map();
    }

    get isActive() {
        return this._activeSkin !== 'ascii' && this._sprites.size > 0;
    }

    get activeSkin() {
        return this._activeSkin;
    }

    get humanBodyCount() { return this._humanBodyCount; }
    get nymphBodyCount() { return this._nymphBodyCount; }
    get ferinBodyCount() { return this._ferinBodyCount; }
    get kobalosBodyCount() { return this._kobalosBodyCount; }
    get bufosBodyCount() { return this._bufosBodyCount; }
    get hairCount() { return this._hairCount; }
    get shirtCount() { return this._shirtCount; }

    getSkinNames() {
        return this._skinNames;
    }

    async init() {
        if (this._initialized) return;
        this._initialized = true;
        const discovered = await this._discoverSkins();
        if (discovered.length > 0) {
            this._skinNames = ['ascii', ...discovered];
        } else {
            try {
                const resp = await fetch('skins/index.json');
                if (resp.ok) {
                    const names = await resp.json();
                    this._skinNames = names;
                }
            } catch (e) {
                // index.json missing or malformed — just use ascii
            }
        }
    }

    async _discoverSkins() {
        try {
            const resp = await fetch('skins/');
            if (!resp.ok) return [];
            const ct = resp.headers.get('content-type') || '';
            if (!ct.includes('text/html')) return [];
            const html = await resp.text();
            if (!html.includes('.skin.zip')) return [];
            const matches = html.match(/[a-zA-Z0-9][\w.-]*\.skin\.zip/g) || [];
            const names = [...new Set(matches.map(m => m.replace('.skin.zip', '')))];
            return names.sort();
        } catch (e) {
            return [];
        }
    }

    async switchSkin(skinName) {
        if (skinName === 'ascii') {
            this._sprites.clear();
            this._activeSkin = 'ascii';
            this._humanBodyCount = 0;
            this._nymphBodyCount = 0;
            this._ferinBodyCount = 0;
            this._kobalosBodyCount = 0;
            this._bufosBodyCount = 0;
            this._hairCount = 0;
            this._shirtCount = 0;
            this._itemDataURLCache = null;
            this._compositeCache.clear();
            return;
        }
        await this._loadSkin(skinName);
        this._activeSkin = skinName;
        this._itemDataURLCache = null;
        this._compositeCache.clear();
    }

    getSprite(category, key) {
        return this._sprites.get(category + ':' + key) || null;
    }

    getItemSprite(itemKey) {
        return this._sprites.get('items:' + itemKey) || null;
    }

    getMaterialSprite(materialKey) {
        return this._sprites.get('materials:' + materialKey) || null;
    }

    getItemSpriteDataURL(itemKey) {
        if (!this._itemDataURLCache) this._itemDataURLCache = new Map();
        if (this._itemDataURLCache.has(itemKey)) return this._itemDataURLCache.get(itemKey);
        const sprite = this.getItemSprite(itemKey) || this.getMaterialSprite(itemKey);
        if (!sprite) { this._itemDataURLCache.set(itemKey, null); return null; }
        const c = document.createElement('canvas');
        c.width = sprite.width || sprite.naturalWidth || 16;
        c.height = sprite.height || sprite.naturalHeight || 16;
        const ctx = c.getContext('2d');
        ctx.drawImage(sprite, 0, 0);
        const url = c.toDataURL('image/png');
        this._itemDataURLCache.set(itemKey, url);
        return url;
    }

    // Returns a composited canvas (body + hair + tinted shirt) for a colonist,
    // or null if the active pack has no body sprites (ASCII mode).
    // bodyVariant/hairVariant/shirtVariant are 1-based; missing/0 falls back to 1.
    _addOutline(canvas, color) {
        const w = canvas.width;
        const h = canvas.height;
        const src = canvas.getContext('2d').getImageData(0, 0, w, h);
        const out = document.createElement('canvas');
        out.width = w + 2;
        out.height = h + 2;
        const ctx = out.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        const dst = ctx.getImageData(0, 0, w + 2, h + 2);
        const d = dst.data;
        const s = src.data;
        // Parse outline color
        const tmp = document.createElement('canvas');
        tmp.width = tmp.height = 1;
        const tc = tmp.getContext('2d');
        tc.fillStyle = color;
        tc.fillRect(0, 0, 1, 1);
        const cd = tc.getImageData(0, 0, 1, 1).data;
        const [or, og, ob] = [cd[0], cd[1], cd[2]];
        // Check opacity of source pixel (offset +1 in dst space)
        const opaque = (x, y) => x >= 0 && x < w && y >= 0 && y < h && s[(y * w + x) * 4 + 3] > 0;
        for (let y = 0; y < h + 2; y++) {
            for (let x = 0; x < w + 2; x++) {
                const sx = x - 1, sy = y - 1;
                if (opaque(sx, sy)) continue;
                if (opaque(sx - 1, sy) || opaque(sx + 1, sy) || opaque(sx, sy - 1) || opaque(sx, sy + 1)) {
                    const i = (y * (w + 2) + x) * 4;
                    d[i] = or; d[i + 1] = og; d[i + 2] = ob; d[i + 3] = 255;
                }
            }
        }
        ctx.putImageData(dst, 0, 0);
        ctx.drawImage(canvas, 1, 1);
        return out;
    }

    // Applies the standard colonist outline (nameColor when highlighted, else black),
    // plus an additional purple ring around the whole sprite when the colonist is
    // drafted — so drafted colonists read as combat-ready without a separate sprite.
    _finishColonistOutline(canvas, drafted, nameColor, highlight) {
        const inner = highlight && nameColor ? this._addOutline(canvas, nameColor) : this._addOutline(canvas, '#000000');
        if (!drafted) return inner;
        return this._addOutline(inner, RENDER_CONFIG.draftedOutlineColor);
    }

    getColonistSprite(colonistId, drafted, race, bodyVariant, hairVariant, shirtVariant, nameColor, highlight, outline = true) {
        let bodyCount = 0;
        if (race === 'nymph') {
            bodyCount = this._nymphBodyCount;
        }
        else if (race === 'ferin') {
            bodyCount = this._ferinBodyCount;
        }
        else if (race === 'kobalos') {
            bodyCount = this._kobalosBodyCount;
        }
        else if (race === 'bufos') {
            bodyCount = this._bufosBodyCount;
        }
        else {
            bodyCount = this._humanBodyCount;
        }
        if (bodyCount <= 0) return null;

        const bIdx = (bodyVariant && bodyVariant > 0) ? ((bodyVariant - 1) % bodyCount) + 1 : 1;
        const body = this._sprites.get(`entities:colonist_${race}_body_` + bIdx);
        if (!body) return null;

        const cw = body.width || body.naturalWidth || 16;
        const ch = body.height || body.naturalHeight || 16;
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(body, 0, 0, cw, ch);

        if (this._hairCount > 0) {
            const hIdx = (hairVariant && hairVariant > 0) ? ((hairVariant - 1) % this._hairCount) + 1 : 1;
            const hair = this._sprites.get('entities:colonist_hair_' + hIdx);
            if (hair) ctx.drawImage(hair, 0, 0, cw, ch);
        }

        if (this._shirtCount > 0 && nameColor) {
            const sIdx = (shirtVariant && shirtVariant > 0) ? ((shirtVariant - 1) % this._shirtCount) + 1 : 1;
            const shirt = this._sprites.get('entities:colonist_shirt_' + sIdx);
            if (shirt) {
                const tinted = this._tintSprite(shirt, nameColor, cw, ch);
                ctx.drawImage(tinted, 0, 0, cw, ch);
            }
        }

        if (outline) {
            return this._finishColonistOutline(canvas, drafted, nameColor, highlight);
        }
        else {
            return canvas;
        }
    }

    _tintSprite(sprite, color, w, h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(sprite, 0, 0, w, h);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(sprite, 0, 0, w, h);
        return c;
    }

    getColonistSleepingSprite() {
        return this._sprites.get('entities:colonist_sleeping') || null;
    }

    getCompositedColonistSprite(colonistId, drafted, race, armorKey, helmetKey, bodyVariant, hairVariant, shirtVariant, nameColor, weaponKey, toolKey, clothesKey, highlight) {
        if (!armorKey && !helmetKey && !weaponKey && !toolKey && !clothesKey) return this.getColonistSprite(colonistId, drafted, race, bodyVariant, hairVariant, shirtVariant, nameColor, highlight);

        const cacheKey = `${colonistId}:${drafted}:${bodyVariant || ''}:${hairVariant || ''}:${shirtVariant || ''}:${nameColor || ''}:${armorKey || ''}:${helmetKey || ''}:${clothesKey || ''}:${weaponKey || ''}:${toolKey || ''}${highlight ? ':hl' : ''}`;
        if (this._compositeCache.has(cacheKey)) return this._compositeCache.get(cacheKey);

        const base = this.getColonistSprite(colonistId, drafted, race, bodyVariant, hairVariant, shirtVariant, nameColor, highlight, false);
        if (!base) return null;

        const clothesSprite = clothesKey ? this._sprites.get('equipment_worn:' + clothesKey) : null;
        const armorSprite = armorKey ? this._sprites.get('equipment_worn:' + armorKey) : null;
        const helmetSprite = helmetKey ? this._sprites.get('equipment_worn:' + helmetKey) : null;
        const weaponSprite = weaponKey ? this._sprites.get('equipment_worn:' + weaponKey) : null;
        const toolSprite = toolKey ? this._sprites.get('equipment_worn:' + toolKey) : null;

        if (!armorSprite && !helmetSprite && !weaponSprite && !toolSprite && !clothesSprite) {
            this._compositeCache.set(cacheKey, base);
            return base;
        }

        const cw = base.width || base.naturalWidth || 16;
        const ch = base.height || base.naturalHeight || 16;
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(base, 0, 0, cw, ch);
        if (clothesSprite) {
            const offX = Math.floor(cw * (EQUIPMENT_OVERLAY_OFFSETS.clothes.offsetX || 0));
            const offY = Math.floor(ch * (EQUIPMENT_OVERLAY_OFFSETS.clothes.offsetY || 0));
            ctx.drawImage(clothesSprite, offX, offY, cw, ch);
        }
        if (armorSprite) {
            const offX = Math.floor(cw * (EQUIPMENT_OVERLAY_OFFSETS.armor.offsetX || 0));
            const offY = Math.floor(ch * (EQUIPMENT_OVERLAY_OFFSETS.armor.offsetY || 0));
            ctx.drawImage(armorSprite, offX, offY, cw, ch);
        }
        if (helmetSprite) {
            const offX = Math.floor(cw * (EQUIPMENT_OVERLAY_OFFSETS.helmet.offsetX || 0));
            const offY = Math.floor(ch * (EQUIPMENT_OVERLAY_OFFSETS.helmet.offsetY || 0));
            ctx.drawImage(helmetSprite, offX, offY, cw, ch);
        }
        if (weaponSprite) {
            const offX = Math.floor(cw * (EQUIPMENT_OVERLAY_OFFSETS.weapon.offsetX || 0));
            const offY = Math.floor(ch * (EQUIPMENT_OVERLAY_OFFSETS.weapon.offsetY || 0));
            ctx.drawImage(weaponSprite, offX, offY, cw, ch);
        }
        if (toolSprite) {
            const offX = Math.floor(cw * (EQUIPMENT_OVERLAY_OFFSETS.tool.offsetX || 0));
            const offY = Math.floor(ch * (EQUIPMENT_OVERLAY_OFFSETS.tool.offsetY || 0));
            ctx.drawImage(toolSprite, offX, offY, cw, ch);
        }

        const result = this._finishColonistOutline(canvas, drafted, nameColor, highlight);
        if (this._compositeCache.size > 200) this._compositeCache.clear();
        this._compositeCache.set(cacheKey, result);
        return result;
    }

    invalidateComposite(colonistId) {
        for (const key of this._compositeCache.keys()) {
            if (key.startsWith(colonistId + ':')) {
                this._compositeCache.delete(key);
            }
        }
    }

    async _loadSkin(skinName) {
        // Load into a staging map so the current sprites remain visible until
        // the entire skin is ready, preventing a flash back to ASCII mid-load.
        const staging = new Map();
        const loaded = await this._tryLoadFromZip(skinName, staging) || await this._tryLoadFromFolder(skinName, staging);
        if (!loaded) return;

        // Atomic swap: old sprites stay live until the new set is fully decoded.
        this._sprites = staging;
        this._compositeCache.clear();

        let bH = 0; while (this._sprites.has('entities:colonist_human_body_' + (bH + 1))) bH++;
        let bN = 0; while (this._sprites.has('entities:colonist_nymph_body_' + (bN + 1))) bN++;
        let bF = 0; while (this._sprites.has('entities:colonist_ferin_body_' + (bF + 1))) bF++;
        let bK = 0; while (this._sprites.has('entities:colonist_kobalos_body_' + (bK + 1))) bK++;
        let bB = 0; while (this._sprites.has('entities:colonist_bufos_body_' + (bB + 1))) bB++;
        let h = 0; while (this._sprites.has('entities:colonist_hair_' + (h + 1))) h++;
        let s = 0; while (this._sprites.has('entities:colonist_shirt_' + (s + 1))) s++;
        this._humanBodyCount = bH;
        this._nymphBodyCount = bN;
        this._ferinBodyCount = bF;
        this._kobalosBodyCount = bK;
        this._bufosBodyCount = bB;
        this._hairCount = h;
        this._shirtCount = s;
    }

    async _tryLoadFromZip(skinName, target) {
        if (typeof JSZip === 'undefined') return false;
        try {
            const resp = await fetch(`skins/${skinName}.skin.zip`);
            if (!resp.ok) return false;
            const buf = await resp.arrayBuffer();
            const zip = await JSZip.loadAsync(buf);

            const manifestFile = zip.file('manifest.json');
            if (!manifestFile) return false;
            const manifest = JSON.parse(await manifestFile.async('string'));

            const loadPromises = [];
            for (const [category, keys] of Object.entries(manifest.sprites || {})) {
                for (const key of keys) {
                    const file = zip.file(`${category}/${key}.png`);
                    if (!file) continue;
                    loadPromises.push(
                        file.async('blob').then(blob => {
                            const url = URL.createObjectURL(blob);
                            return this._loadImage(url).then(img => {
                                URL.revokeObjectURL(url);
                                if (img) target.set(category + ':' + key, img);
                            });
                        })
                    );
                }
            }
            await Promise.all(loadPromises);
            return true;
        } catch (e) {
            return false;
        }
    }

    async _tryLoadFromFolder(skinName, target) {
        const basePath = `skins/${skinName}`;
        let manifest;
        try {
            const resp = await fetch(`${basePath}/manifest.json`);
            if (!resp.ok) return false;
            manifest = await resp.json();
        } catch (e) {
            return false;
        }

        const loadPromises = [];
        for (const [category, keys] of Object.entries(manifest.sprites || {})) {
            for (const key of keys) {
                const path = `${basePath}/${category}/${key}.png`;
                loadPromises.push(this._loadImage(path).then(img => {
                    if (img) target.set(category + ':' + key, img);
                }));
            }
        }
        await Promise.all(loadPromises);
        return true;
    }

    _loadImage(src) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
        });
    }
}
