function buildCrtWarpMap(size = 256) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    const cx = size / 2, cy = size / 2;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const nx = (x - cx) / cx, ny = (y - cy) / cy;
            const r2 = nx * nx + ny * ny;
            const i = (y * size + x) * 4;
            img.data[i]     = Math.min(255, Math.max(0, Math.round(128 + nx * r2 * 0.5 * 127)));
            img.data[i + 1] = Math.min(255, Math.max(0, Math.round(128 + ny * r2 * 0.5 * 127)));
            img.data[i + 2] = 0;
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
}

export class CrtRenderer {
    constructor(container) {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'crt-canvas';
        this.canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:5;';
        container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this._scanlinePattern = null;
        this._patternOpacity = null;
        this._hadContent = false;
        this._w = 0;
        this._h = 0;
        this._dpr = 1;
    }

    initWarpMap() {
        const el = document.getElementById('crt-warp-map');
        if (el) el.setAttribute('href', buildCrtWarpMap());
    }

    // Matches the main game canvas: CSS size w x h, backing store at device
    // resolution (scaled context), so the scanlines are crisp on HiDPI screens
    // and the canvas lines up exactly with the game canvas beneath it.
    resize(w, h, dpr = 1) {
        const bw = Math.round(w * dpr);
        const bh = Math.round(h * dpr);
        if (this.canvas.width !== bw || this.canvas.height !== bh || this._dpr !== dpr) {
            this.canvas.width = bw;
            this.canvas.height = bh;
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            // Scale the 1x2 scanline tile with nearest-neighbour, not a blur.
            this.ctx.imageSmoothingEnabled = false;
            this._dpr = dpr;
            this._scanlinePattern = null;
            this._hadContent = false;
        }
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this._w = w;
        this._h = h;
    }

    // One scanline period built in physical pixels (dark rows then clear rows,
    // about 1 + 1 CSS px at this DPR, rounded to whole device pixels) and mapped
    // back through the context's DPR scale, so lines are evenly spaced even at
    // fractional DPR instead of nearest-neighbour scaling a 1x2 tile.
    _buildPattern(opacity) {
        const dpr = this._dpr;
        const dark = Math.max(1, Math.round(dpr));
        const period = Math.max(dark + 1, Math.round(2 * dpr));
        const pc = document.createElement('canvas');
        pc.width = 1;
        pc.height = period;
        const pctx = pc.getContext('2d');
        pctx.fillStyle = `rgba(0,0,0,${opacity})`;
        pctx.fillRect(0, period - dark, 1, dark);
        this._scanlinePattern = this.ctx.createPattern(pc, 'repeat');
        this._scanlinePattern.setTransform(new DOMMatrix([1 / dpr, 0, 0, 1 / dpr, 0, 0]));
        this._patternOpacity = opacity;
    }

    // The scanlines are static, so they are painted once and left alone until
    // the canvas is resized (which clears it) or the opacity changes.
    render(settings, opacity) {
        const w = this._w;
        const h = this._h;
        if (!w || !h) return;
        if (!settings.showCrtScanlines) {
            if (this._hadContent) {
                this.ctx.clearRect(0, 0, w, h);
                this._hadContent = false;
            }
            return;
        }
        const eff = opacity != null ? opacity : 0.18;
        if (this._hadContent && this._patternOpacity === eff && this._scanlinePattern) return;
        if (!this._scanlinePattern || this._patternOpacity !== eff) this._buildPattern(eff);
        this.ctx.clearRect(0, 0, w, h);
        this.ctx.fillStyle = this._scanlinePattern;
        this.ctx.fillRect(0, 0, w, h);
        this._hadContent = true;
    }
}
