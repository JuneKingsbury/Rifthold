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
        this._patternW = 0;
        this._patternH = 0;
    }

    initWarpMap() {
        const el = document.getElementById('crt-warp-map');
        if (el) el.setAttribute('href', buildCrtWarpMap());
    }

    resize(w, h) {
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
            this.canvas.style.width = w + 'px';
            this.canvas.style.height = h + 'px';
            this._scanlinePattern = null;
        }
    }

    _buildPattern(opacity) {
        const pc = document.createElement('canvas');
        pc.width = 1;
        pc.height = 2;
        const pctx = pc.getContext('2d');
        pctx.clearRect(0, 0, 1, 2);
        pctx.fillStyle = `rgba(0,0,0,${opacity})`;
        pctx.fillRect(0, 1, 1, 1);
        this._scanlinePattern = this.ctx.createPattern(pc, 'repeat');
    }

    render(settings, opacity) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        if (!w || !h) return;
        if (!settings.showCrtScanlines) {
            if (this._hadContent) {
                this.ctx.clearRect(0, 0, w, h);
                this._hadContent = false;
            }
            return;
        }
        const eff = opacity != null ? opacity : 0.18;
        if (!this._scanlinePattern) this._buildPattern(eff);
        this.ctx.clearRect(0, 0, w, h);
        this.ctx.fillStyle = this._scanlinePattern;
        this.ctx.fillRect(0, 0, w, h);
        this._hadContent = true;
    }
}
