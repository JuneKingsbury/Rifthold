import { HELMETS, EQUIPMENT_OVERLAY_OFFSETS } from '../core/config.js';

export class SkinManager {
    constructor() {
        this._sprites = new Map();
        this._skinNames = ['ascii'];
        this._activeSkin = 'ascii';
        this._bodyCount = 0;
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

    get bodyCount() { return this._bodyCount; }
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
            this._bodyCount = 0;
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

    getColonistSprite(colonistId, drafted, bodyVariant, hairVariant, shirtVariant, nameColor, highlight) {
        if (drafted) {
            const s = this._sprites.get('entities:colonist_drafted');
            if (s) return s;
        }
        if (this._bodyCount <= 0) return null;

        const bIdx = (bodyVariant && bodyVariant > 0) ? ((bodyVariant - 1) % this._bodyCount) + 1 : 1;
        const body = this._sprites.get('entities:colonist_body_' + bIdx);
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

        return highlight && nameColor ? this._addOutline(canvas, nameColor) : canvas;
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

    getCompositedColonistSprite(colonistId, drafted, armorKey, helmetKey, bodyVariant, hairVariant, shirtVariant, nameColor, weaponKey, toolKey, highlight) {
        if (!armorKey && !helmetKey && !weaponKey && !toolKey) return this.getColonistSprite(colonistId, drafted, bodyVariant, hairVariant, shirtVariant, nameColor, highlight);

        const cacheKey = `${colonistId}:${drafted}:${bodyVariant || ''}:${hairVariant || ''}:${shirtVariant || ''}:${nameColor || ''}:${armorKey || ''}:${helmetKey || ''}:${weaponKey || ''}:${toolKey || ''}${highlight ? ':hl' : ''}`;
        if (this._compositeCache.has(cacheKey)) return this._compositeCache.get(cacheKey);

        const base = this.getColonistSprite(colonistId, drafted, bodyVariant, hairVariant, shirtVariant, nameColor);
        if (!base) return null;

        const armorSprite = armorKey ? this._sprites.get('equipment_worn:' + armorKey) : null;
        const helmetSprite = helmetKey ? this._sprites.get('equipment_worn:' + helmetKey) : null;
        const weaponSprite = weaponKey ? this._sprites.get('equipment_worn:' + weaponKey) : null;
        const toolSprite = toolKey ? this._sprites.get('equipment_worn:' + toolKey) : null;

        if (!armorSprite && !helmetSprite && !weaponSprite && !toolSprite) {
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

        const result = highlight && nameColor ? this._addOutline(canvas, nameColor) : canvas;
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
        this._sprites.clear();
        this._bodyCount = 0;
        this._hairCount = 0;
        this._shirtCount = 0;

        const loaded = await this._tryLoadFromZip(skinName) || await this._tryLoadFromFolder(skinName);
        if (!loaded) return;

        let b = 0; while (this._sprites.has('entities:colonist_body_' + (b + 1))) b++;
        let h = 0; while (this._sprites.has('entities:colonist_hair_' + (h + 1))) h++;
        let s = 0; while (this._sprites.has('entities:colonist_shirt_' + (s + 1))) s++;
        this._bodyCount = b;
        this._hairCount = h;
        this._shirtCount = s;
    }

    async _tryLoadFromZip(skinName) {
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
                                if (img) this._sprites.set(category + ':' + key, img);
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

    async _tryLoadFromFolder(skinName) {
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
                    if (img) this._sprites.set(category + ':' + key, img);
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
