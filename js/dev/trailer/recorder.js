// Records trailer takes to MP4 (H.264 + AAC) without any external software.
//
// Video: every rendered frame, the world and effects canvases are composited into an offscreen
// canvas at the output size, cropped to the game area and with the director
// camera's fractional-zoom CSS scale applied, so the clip matches the screen.
// The expedition cinema view and the title card are DOM overlays, so they are
// drawn into the composite too, from their live computed styles (which follow
// the CSS fades as they play). Nothing else on the page (panels, cursor,
// notifications) can end up in a clip.
//
// Audio: the game's SFX buses are tapped straight from Web Audio, scaled back
// up to full level so the clip isn't recorded at the quiet monitoring volume.
//
// Files: in Electron, chunks stream to the main process, which writes them to
// ~/Movies/Rifthold Trailer and finishes them with ffmpeg (if installed): a
// re-encode to constant 60 fps by default (recordings are variable frame rate,
// which some editors drift on), or a plain remux. In a browser, the clip downloads.

const MIME = 'video/mp4;codecs=avc1.640033,mp4a.40.2';
const FALLBACK_MIME = 'video/webm;codecs=vp9,opus';

export const RESOLUTIONS = {
    '1080p': [1920, 1080],
    '1440p': [2560, 1440],
    '2160p': [3840, 2160],
    native: null,   // the game area's physical pixel size
};

export class ClipRecorder {
    constructor(director) {
        this.director = director;
        this.active = null;      // { recorder, name, clipId, chunks, done, discard }
        this.canvas = document.createElement('canvas');
        this.ctx2d = this.canvas.getContext('2d', { alpha: false });
        this._audio = null;      // { dest, bus, sources }
        this._images = {};
    }

    get recording() { return !!this.active; }

    static supported() {
        return typeof MediaRecorder !== 'undefined' && (MediaRecorder.isTypeSupported(MIME) || MediaRecorder.isTypeSupported(FALLBACK_MIME));
    }

    // ---- Lifecycle -------------------------------------------------------------

    async start(name, { resolution = '1080p', fps = 60, mbps = 30, recordLevel = 100, constantFps = true } = {}) {
        if (this.active) await this.stop({ discard: true });
        this._sizeCanvas(resolution);
        this._loadImages();
        this.drawFrame();

        const mime = MediaRecorder.isTypeSupported(MIME) ? MIME : FALLBACK_MIME;
        const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
        const stream = this.canvas.captureStream(fps);
        const audioTrack = this._audioTrack(recordLevel);
        if (audioTrack) stream.addTrack(audioTrack);
        // Scale the bitrate with the pixel count so 1440p/4K keep the same quality.
        const pixels = this.canvas.width * this.canvas.height;
        const bitrate = Math.round(mbps * 1e6 * Math.max(1, pixels / (1920 * 1080)));
        const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate, audioBitsPerSecond: 256000 });

        const fileName = `${name}.${ext}`;
        const api = window.electronAPI?.trailer;
        let clipId = null;
        if (api) {
            try { clipId = await api.beginClip(fileName); } catch (e) { console.warn('[trailer] clip saving via Electron unavailable, falling back to download', e); }
        }
        const take = { recorder, fileName, clipId, chunks: [], pending: Promise.resolve(), discard: false, endOpts: { constantFps, fps } };
        take.done = new Promise(resolve => { take.resolveDone = resolve; });
        recorder.ondataavailable = (e) => {
            if (!e.data || !e.data.size) return;
            if (take.clipId) {
                // Stream to disk in order so long takes don't sit in memory.
                take.pending = take.pending.then(async () => api.appendClip(take.clipId, new Uint8Array(await e.data.arrayBuffer())));
            } else {
                take.chunks.push(e.data);
            }
        };
        recorder.onstop = () => this._finish(take);
        recorder.start(1000);
        this.active = take;
        return fileName;
    }

    // Stops the current take. Resolves with { path } of the saved file, or null
    // if discarded / nothing was recording.
    async stop({ discard = false } = {}) {
        const take = this.active;
        if (!take) return null;
        this.active = null;
        take.discard = discard;
        if (take.recorder.state !== 'inactive') take.recorder.stop();
        return take.done;
    }

    async _finish(take) {
        const api = window.electronAPI?.trailer;
        try {
            if (take.clipId) {
                await take.pending;
                if (take.discard) { await api.discardClip(take.clipId); take.resolveDone(null); return; }
                take.resolveDone(await api.endClip(take.clipId, take.endOpts));
                return;
            }
            if (take.discard) { take.resolveDone(null); return; }
            const blob = new Blob(take.chunks, { type: take.recorder.mimeType });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = take.fileName;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 10000);
            take.resolveDone({ path: `Downloads/${take.fileName}` });
        } catch (e) {
            console.error('[trailer] saving clip failed', e);
            take.resolveDone({ error: e.message || String(e) });
        }
    }

    // ---- Audio ---------------------------------------------------------------

    _audioTrack(recordLevel) {
        const sm = window.soundManager;
        const ac = sm?.ctx;
        if (!ac || !sm.sfxGain) return null;
        if (!this._audio || this._audio.ctx !== ac) {
            const dest = ac.createMediaStreamDestination();
            const bus = ac.createGain();
            bus.connect(dest);
            sm.sfxGain.connect(bus);
            sm.expeditionSfxGain?.connect(bus);
            this._audio = { ctx: ac, dest, bus };
        }
        this._recordLevel = recordLevel;
        this._updateAudioLevel();
        return this._audio.dest.stream.getAudioTracks()[0] || null;
    }

    // The buses carry the monitoring volume (sfxVolume); undo it so the clip
    // gets `recordLevel`% of full level. Expedition ducking is kept.
    _updateAudioLevel() {
        if (!this._audio) return;
        const vol = (window.soundManager?.sfxVolume ?? 100) / 100;
        this._audio.bus.gain.value = vol > 0.001 ? (this._recordLevel / 100) / vol : 0;
    }

    // ---- Video ---------------------------------------------------------------

    _sizeCanvas(resolution) {
        let size = RESOLUTIONS[resolution];
        if (!size) {
            const area = document.getElementById('game-area');
            const dpr = window.devicePixelRatio || 1;
            const r = area?.getBoundingClientRect();
            size = r ? [r.width * dpr, r.height * dpr] : [1920, 1080];
        }
        // H.264 needs even dimensions.
        this.canvas.width = Math.max(2, Math.round(size[0] / 2) * 2);
        this.canvas.height = Math.max(2, Math.round(size[1] / 2) * 2);
    }

    _loadImages() {
        for (const [key, src] of [['emblem', 'icons/RiftholdIcon2.png'], ['tile', 'icons/splashBackgroundTile.png']]) {
            if (this._images[key]) continue;
            const img = new Image();
            img.src = src;
            this._images[key] = img;
        }
    }

    // Called after every game render while recording.
    drawFrame() {
        const ctx = this.ctx2d;
        const W = this.canvas.width, H = this.canvas.height;
        this._updateAudioLevel();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        this._drawGame(ctx, W, H);
        this._drawCinema(ctx, W, H);
        this._drawTitleCard(ctx, W, H);
    }

    // Game canvas. With the director camera active, the clip is the exact
    // framing the camera asks for: a region of the canvas centered on the shot
    // center, sized from the requested zoom. That ignores where the canvas sits
    // and how big it is, which jump by up to a tile whenever the font steps.
    _drawGame(ctx, W, H) {
        const canvas = document.getElementById('game-canvas');
        if (!canvas || !canvas.width) return;
        const cssW = canvas.clientWidth || canvas.width / (window.devicePixelRatio || 1);
        const toPx = canvas.width / cssW;   // canvas CSS px -> backing px
        const v = this.director.cine.active ? this.director.cine.view : null;
        let sw, sh, cx, cy;
        if (v) {
            // Game-area pixels shown, converted to canvas CSS pixels, then
            // cropped (cover) to the clip's aspect ratio.
            sw = v.areaW / v.scale;
            sh = v.areaH / v.scale;
            if (sw / sh > W / H) sw = sh * (W / H); else sh = sw * (H / W);
            cx = v.px; cy = v.py;
        } else {
            // No director camera: the whole canvas, cropped to the clip's aspect.
            const cssH = canvas.clientHeight || canvas.height / toPx;
            sw = cssW; sh = cssH;
            if (sw / sh > W / H) sw = sh * (W / H); else sh = sw * (H / W);
            cx = cssW / 2; cy = cssH / 2;
        }
        // Nearest-neighbor keeps pixel art crisp when scaling up; smooth when
        // scaling down so panning doesn't shimmer.
        ctx.imageSmoothingEnabled = W < sw * toPx;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(canvas, (cx - sw / 2) * toPx, (cy - sh / 2) * toPx, sw * toPx, sh * toPx, 0, 0, W, H);
        // Effects layer (particles, weather, floating text, flashes): same size
        // and position as the world canvas, so the same crop lines it up.
        const fx = document.getElementById('overlay-canvas');
        if (fx?.width) {
            const fxPx = fx.width / (fx.clientWidth || cssW);
            ctx.drawImage(fx, (cx - sw / 2) * fxPx, (cy - sh / 2) * fxPx, sw * fxPx, sh * fxPx, 0, 0, W, H);
        }

        // CRT scanlines: a screen-space overlay that doesn't zoom with the
        // camera, so it's mapped by game-area pixels (unscaled), centered.
        const crt = document.getElementById('crt-canvas');
        if (this.director.settings.crtScanlines && crt?.width) {
            const crtCssW = crt.clientWidth || cssW;
            const k = crt.width / crtCssW;
            let cw = v ? v.areaW : crtCssW, ch = v ? v.areaH : (crt.clientHeight || crt.height / k);
            if (cw / ch > W / H) cw = ch * (W / H); else ch = cw * (H / W);
            const ccx = (crt.clientWidth || cw) / 2, ccy = (crt.clientHeight || ch) / 2;
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(crt, (ccx - cw / 2) * k, (ccy - ch / 2) * k, cw * k, ch * k, 0, 0, W, H);
            ctx.restore();
        }
    }

    _drawCinema(ctx, W, H) {
        const wrap = document.getElementById('trailer-exp-cinema');
        const src = wrap?.querySelector('canvas');
        if (!wrap || !src) return;
        const alpha = parseFloat(getComputedStyle(wrap).opacity) || 0;
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        const w = W * 0.96, h = w * (src.height / src.width);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(src, (W - w) / 2, (H - h) / 2, w, h);
        ctx.restore();
    }

    // Redraws the title card from its live layout and computed styles: each
    // element's on-screen rect is mapped into the frame (the card is
    // full-window, so map by height and center horizontally), and opacities
    // follow the CSS fades as they play.
    _drawTitleCard(ctx, W, H) {
        const card = document.getElementById('trailer-title-card');
        if (!card) return;
        const el = (sel) => card.querySelector(sel);
        const opacity = (e) => (e ? parseFloat(getComputedStyle(e).opacity) || 0 : 0);
        const cardAlpha = opacity(card);
        if (cardAlpha <= 0) return;
        const s = H / window.innerHeight;
        const dx = W / 2 - (window.innerWidth / 2) * s;
        const map = (r) => ({ x: dx + r.left * s, y: r.top * s, w: r.width * s, h: r.height * s });
        const px = (e) => parseFloat(getComputedStyle(e).fontSize) * s;

        ctx.save();
        ctx.globalAlpha = cardAlpha;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);

        const tile = this._images.tile;
        const bgAlpha = opacity(el('.ttc-bg'));
        if (bgAlpha > 0 && tile?.complete && tile.naturalWidth) {
            ctx.save();
            ctx.globalAlpha = cardAlpha * bgAlpha;
            ctx.imageSmoothingEnabled = false;
            const t = 64 * s;
            const scroll = ((performance.now() / 16000) % 1) * t;
            ctx.translate(scroll - t, scroll - t);
            const pattern = ctx.createPattern(tile, 'repeat');
            pattern.setTransform(new DOMMatrix().scale(t / tile.naturalWidth));
            ctx.fillStyle = pattern;
            ctx.fillRect(0, 0, W + 2 * t, H + 2 * t);
            ctx.restore();
        }
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.15, W / 2, H / 2, Math.max(W, H) * 0.6);
        g.addColorStop(0, 'rgba(0,0,0,0.25)');
        g.addColorStop(1, 'rgba(0,0,0,0.92)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const emblemEl = el('.ttc-emblem');
        const emblem = this._images.emblem;
        if (emblemEl && opacity(emblemEl) > 0 && emblem?.complete && emblem.naturalWidth) {
            const r = map(emblemEl.getBoundingClientRect());   // includes the scale-in transform
            ctx.save();
            ctx.globalAlpha = cardAlpha * opacity(emblemEl);
            ctx.imageSmoothingEnabled = false;
            ctx.shadowColor = 'rgba(255, 204, 0, 0.35)';
            ctx.shadowBlur = 24 * s;
            ctx.drawImage(emblem, r.x, r.y, r.w, r.h);
            ctx.restore();
        }

        const text = (e, color, { shadow = null, weight = 400 } = {}) => {
            if (!e || opacity(e) <= 0) return;
            const r = map(e.getBoundingClientRect());
            const cs = getComputedStyle(e);
            ctx.save();
            ctx.globalAlpha = cardAlpha * opacity(e);
            ctx.font = `${weight} ${px(e)}px "Pixelify Sans"`;
            if (cs.letterSpacing && cs.letterSpacing !== 'normal') ctx.letterSpacing = `${parseFloat(cs.letterSpacing) * s}px`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (shadow) { ctx.shadowColor = shadow; ctx.shadowBlur = 24 * s; }
            ctx.fillStyle = color;
            ctx.fillText(e.textContent, r.x + r.w / 2, r.y + r.h / 2);
            ctx.restore();
        };
        text(el('.ttc-title'), '#ffcc00', { shadow: '#ffcc0055', weight: 700 });
        text(el('.ttc-subtitle'), '#d8c8ff');

        const cta = el('.ttc-cta');
        if (cta && opacity(cta) > 0) {
            const r = map(cta.getBoundingClientRect());
            ctx.save();
            ctx.globalAlpha = cardAlpha * opacity(cta);
            ctx.fillStyle = 'rgba(40, 20, 70, 0.6)';
            ctx.strokeStyle = '#ffffffaa';
            ctx.lineWidth = parseFloat(getComputedStyle(cta).borderTopWidth) * s;
            ctx.beginPath();
            ctx.roundRect(r.x, r.y, r.w, r.h, parseFloat(getComputedStyle(cta).borderTopLeftRadius) * s);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
            // Same breathing glow as the on-screen CTA (splash-glow, 2.4s).
            const pulse = (Math.sin((performance.now() / 2400) * Math.PI * 2) + 1) / 2;
            text(cta, '#fff', { shadow: `rgba(255,255,255,${(0.2 + 0.3 * pulse).toFixed(2)})` });
        }
        ctx.restore();
    }
}
