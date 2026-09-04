import { CONFIG, RENDER_CONFIG, BUILDINGS, ALL_ITEMS, ROOM_QUALITY_TIERS, TOWN_HALL_QUALITY_TIERS, WORKSHOP_QUALITY_TIERS } from '../core/config.js';

export function spawnParticle(game, props) {
    if (!game.worldParticles) game.worldParticles = [];
    game.worldParticles.push({
        x: props.x, y: props.y,
        vx: props.vx || 0, vy: props.vy || 0,
        ay: props.ay || 0,
        life: 1,
        decay: props.decay || 0.02,
        color: props.color || '#ffffff',
        size: props.size || 3,
        alpha: props.alpha != null ? props.alpha : 1,
        wobble: props.wobble || 0,
        wobblePhase: Math.random() * Math.PI * 2,
        shape: props.shape || 'circle',
        maxY: props.maxY != null ? props.maxY : null,
    });
}

export class OverlayRenderer {
    constructor(container) {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'overlay-canvas';
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.pointerEvents = 'none';
        container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d', { alpha: true });
        this._weatherParticles = [];
        this._lastWeatherTime = 0;
        this._lastParticleTime = 0;
        this._lightningFlash = 0;      // remaining alpha for lightning flash
        this._nextLightning = 0;       // wall-clock time for next lightning strike
        this._activeWeather = null;    // weather type currently being rendered
        this._weatherAlpha = 0;        // current opacity of weather particle layer (0..1)
        this._weatherFading = false;   // true = fading out before switching type
    }

    resize(width, height) {
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
    }

    render(game, charWidth, charHeight, camera) {
        const ctx = this.ctx;
        const cw = charWidth;
        const ch = charHeight;
        const now = performance.now();
        this._uiFontScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-font-scale')) || 1;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (game.input && (game.input.mode === 'build' || game.input.mode === 'zone')) {
            this._renderBuildGrid(ctx, cw, ch, this.canvas.width, this.canvas.height);
        }

        if (game.weather) {
            const dt = this._lastWeatherTime ? Math.min((now - this._lastWeatherTime) / 1000, 0.1) : 0.016;
            this._lastWeatherTime = now;
            const targetWeather = game.settings.showWeatherParticles ? game.weather.currentWeather : 'clear';
            this._updateWeatherParticles(targetWeather, this.canvas.width, this.canvas.height, dt, now);
            if (this._weatherAlpha > 0 && this._weatherParticles.length > 0) {
                ctx.save();
                ctx.globalAlpha = this._weatherAlpha;
                this._renderWeatherParticles(ctx);
                ctx.restore();
            }
            if (this._lightningFlash > 0) {
                ctx.save();
                ctx.globalAlpha = this._lightningFlash;
                ctx.fillStyle = '#ffffee';
                ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                ctx.restore();
            }
        } else if (this._weatherParticles.length > 0) {
            this._weatherParticles.length = 0;
        }

        if (game.settings.showWarmthOverlay) {
            this._renderWarmthOverlay(ctx, game, cw, ch, camera);
        }
        if (game.settings.showDefenseOverlay) {
            this._renderDefenseOverlay(ctx, game, cw, ch, camera);
        }
        if (game.settings.showRoomOverlay) {
            this._renderRoomOverlay(ctx, game, cw, ch, camera);
        }
        if (game.settings.showAuraOverlay) {
            this._renderAuraOverlay(ctx, game, cw, ch, camera);
        }

        if (game.radiusHighlight && game.selectedColonist) {
            const c = game.selectedColonist;
            if (c.trinket && !c.trinketBroken && c.trinket.pedestal?.radius && c.trinket.pedestal.radius !== 'global') {
                game.radiusHighlight.x = c.x;
                game.radiusHighlight.y = c.y;
            }
        }
        if (game.radiusHighlight) {
            this._renderRadiusHighlight(ctx, game.radiusHighlight, cw, ch, camera);
        }

        if (game.worldParticles) {
            const dt = this._lastParticleTime ? Math.min((now - this._lastParticleTime) / 1000, 0.1) : 0.016;
            this._lastParticleTime = now;
            this._updateWorldParticles(game.worldParticles, dt);
            if (game.worldParticles.length > 0) {
                this._renderWorldParticles(ctx, game.worldParticles, cw, ch, camera);
            }
        }

        if (game.alertRipple) {
            this._renderAlertRipple(ctx, game.alertRipple, cw, ch, camera);
        }

        if (!game.settings.showOverlays || !game.overlays || game.overlays.length === 0) return;

        const s = game.settings;
        for (const overlay of game.overlays) {
            switch (overlay.type) {
                case 'progress_bar':
                    if (s.showProgressBars) this._renderProgressBar(ctx, overlay, cw, ch, camera);
                    break;
                case 'beam':
                    this._renderBeam(ctx, overlay, cw, ch, camera);
                    break;
                case 'health_bar':
                    if (s.showProgressBars) this._renderHealthBar(ctx, overlay, cw, ch, camera);
                    break;
                case 'glow':
                    this._renderGlow(ctx, overlay, cw, ch, camera);
                    break;
                case 'screenFlash':
                    this._renderScreenFlash(ctx, overlay);
                    break;
                case 'floating_text':
                    this._renderFloatingText(ctx, overlay, cw, ch, camera);
                    break;
                case 'chat_bubble':
                    this._renderChatBubble(ctx, overlay, cw, ch, camera);
                    break;
            }
        }
    }

    _renderBuildGrid(ctx, cw, ch, canvasWidth, canvasHeight) {
        ctx.save();
        ctx.translate(1, 1);
        ctx.strokeStyle = RENDER_CONFIG.buildGridColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        for (let i = 0; i <= Math.ceil(canvasWidth / cw); i++) {
            const x = Math.round(i * cw);
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvasHeight);
        }
        for (let i = 0; i <= Math.ceil(canvasHeight / ch); i++) {
            const y = Math.round(i * ch);
            ctx.moveTo(0, y);
            ctx.lineTo(canvasWidth, y);
        }
        ctx.stroke();
        ctx.restore();
    }

    _updateWeatherParticles(weatherType, canvasWidth, canvasHeight, dt, now) {
        const FADE_SPEED = 0.8;  // alpha units per second (~1.25s fade)
        const hasParticles = this._getParticleTarget(weatherType) > 0;
        const fadingOut = this._activeWeather !== weatherType || !hasParticles;

        if (fadingOut) {
            this._weatherAlpha = Math.max(0, this._weatherAlpha - FADE_SPEED * dt);
            // Keep moving existing particles while fading — don't spawn new ones
            for (let i = this._weatherParticles.length - 1; i >= 0; i--) {
                const p = this._weatherParticles[i];
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                // Remove particles that leave the screen; don't replace them
                if (p.y > canvasHeight || p.x > canvasWidth + 40 || p.x < -40) {
                    this._weatherParticles.splice(i, 1);
                }
            }
            if (this._weatherAlpha === 0) {
                this._activeWeather = weatherType;
                this._weatherParticles.length = 0;
            }
            return;
        }

        // Fade in
        this._weatherAlpha = Math.min(1, this._weatherAlpha + FADE_SPEED * dt);

        const targetCount = this._getParticleTarget(weatherType);
        while (this._weatherParticles.length < targetCount) {
            this._weatherParticles.push(this._spawnWeatherParticle(weatherType, canvasWidth, canvasHeight, true));
        }
        if (this._weatherParticles.length > targetCount) {
            this._weatherParticles.length = targetCount;
        }

        for (let i = this._weatherParticles.length - 1; i >= 0; i--) {
            const p = this._weatherParticles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.y > canvasHeight || p.x > canvasWidth + 40 || p.x < -40) {
                this._weatherParticles[i] = this._spawnWeatherParticle(weatherType, canvasWidth, canvasHeight, false);
            }
        }

        // Lightning flash during thunderstorm
        if (weatherType === 'thunderstorm') {
            if (this._nextLightning === 0) this._nextLightning = now + 5000 + Math.random() * 15000;
            if (now >= this._nextLightning) {
                this._lightningFlash = 0.35;
                this._nextLightning = now + 8000 + Math.random() * 20000;
            }
        } else {
            this._nextLightning = 0;
        }
        if (this._lightningFlash > 0) {
            this._lightningFlash = Math.max(0, this._lightningFlash - dt * 3);
        }
    }

    _getParticleTarget(weatherType) {
        switch (weatherType) {
            case 'rain': return 120;
            case 'thunderstorm': return 180;
            case 'snow': return 60;
            case 'blizzard': return 100;
            case 'windy': return 18;
            case 'cloudy': return 6;
            default: return 0;
        }
    }

    _spawnWeatherParticle(weatherType, canvasWidth, canvasHeight, randomY) {
        const x = randomY ? Math.random() * (canvasWidth + 40) - 20 : -20 - Math.random() * 20;
        const y = randomY ? Math.random() * canvasHeight : Math.random() * canvasHeight;

        switch (weatherType) {
            case 'rain':
            case 'thunderstorm':
                return { x: Math.random() * (canvasWidth + 40) - 20, y: randomY ? Math.random() * canvasHeight : -(Math.random() * 20), vx: 30, vy: 250 + Math.random() * 100, type: 'rain' };
            case 'snow':
                return { x: Math.random() * (canvasWidth + 40) - 20, y: randomY ? Math.random() * canvasHeight : -(Math.random() * 20), vx: 5 + Math.random() * 10, vy: 30 + Math.random() * 20, size: 1.5 + Math.random() * 1.5, type: 'snow' };
            case 'blizzard':
                return { x: Math.random() * (canvasWidth + 40) - 20, y: randomY ? Math.random() * canvasHeight : -(Math.random() * 20), vx: 40 + Math.random() * 30, vy: 50 + Math.random() * 30, size: 2 + Math.random() * 2, type: 'snow' };
            case 'windy':
                return { x, y, vx: 280 + Math.random() * 120, vy: (Math.random() - 0.5) * 20, len: 12 + Math.random() * 20, alpha: 0.12 + Math.random() * 0.12, type: 'wind' };
            case 'cloudy':
                return { x, y, vx: 60 + Math.random() * 40, vy: (Math.random() - 0.5) * 10, len: 6 + Math.random() * 10, alpha: 0.06 + Math.random() * 0.06, type: 'wind' };
            default:
                return { x, y, vx: 0, vy: 0, size: 0, type: 'none' };
        }
    }

    _renderWeatherParticles(ctx) {
        let hasRain = false, hasSnow = false, hasWind = false;
        for (const p of this._weatherParticles) {
            if (p.type === 'rain') hasRain = true;
            else if (p.type === 'snow') hasSnow = true;
            else if (p.type === 'wind') hasWind = true;
        }
        if (hasRain) {
            ctx.strokeStyle = 'rgba(160, 200, 255, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (const p of this._weatherParticles) {
                if (p.type !== 'rain') continue;
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + 3, p.y + 14);
            }
            ctx.stroke();
        }
        if (hasSnow) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            for (const p of this._weatherParticles) {
                if (p.type !== 'snow') continue;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        if (hasWind) {
            ctx.lineWidth = 1;
            for (const p of this._weatherParticles) {
                if (p.type !== 'wind') continue;
                ctx.strokeStyle = `rgba(200, 220, 255, ${p.alpha})`;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x - p.len, p.y);
                ctx.stroke();
            }
        }
    }

    _renderProgressBar(ctx, overlay, cw, ch, camera) {
        const sx = (overlay.x - camera.x) * cw;
        const sy = (overlay.y - camera.y) * ch;
        if (sx < -cw || sx > this.canvas.width || sy < -ch || sy > this.canvas.height) return;

        const barHeight = 3;
        const barWidth = cw * 0.8;
        const barX = sx + (cw - barWidth) / 2;
        const barY = sy + ch - barHeight - 1;

        ctx.fillStyle = overlay.bgColor || '#333333';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        ctx.fillStyle = overlay.color || '#00ff00';
        ctx.fillRect(barX, barY, barWidth * Math.max(0, Math.min(1, overlay.progress)), barHeight);
    }

    _renderBeam(ctx, overlay, cw, ch, camera) {
        const x1 = (overlay.fromX - camera.x) * cw + cw / 2;
        const y1 = (overlay.fromY - camera.y) * ch + ch / 2;
        const x2 = (overlay.toX - camera.x) * cw + cw / 2;
        const y2 = (overlay.toY - camera.y) * ch + ch / 2;

        ctx.save();
        ctx.strokeStyle = overlay.color || '#ff4444';
        ctx.lineWidth = overlay.width || 1.5;
        ctx.globalAlpha = overlay.alpha !== undefined ? overlay.alpha : 0.7;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
    }

    _renderHealthBar(ctx, overlay, cw, ch, camera) {
        const sx = (overlay.x - camera.x) * cw;
        const sy = (overlay.y - camera.y) * ch;
        if (sx < -cw || sx > this.canvas.width || sy < -ch || sy > this.canvas.height) return;

        const barHeight = 2;
        const barWidth = cw * 0.8;
        const barX = sx + (cw - barWidth) / 2;
        const barY = sy - 1;

        const pct = overlay.max > 0 ? overlay.current / overlay.max : 0;
        const colors = RENDER_CONFIG.healthBarColors;

        ctx.fillStyle = '#333333';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        ctx.fillStyle = overlay.color || (pct > RENDER_CONFIG.healthBarGreenThreshold ? colors.green : pct > RENDER_CONFIG.healthBarYellowThreshold ? colors.yellow : colors.red);
        ctx.fillRect(barX, barY, barWidth * Math.max(0, Math.min(1, pct)), barHeight);
    }

    _renderGlow(ctx, overlay, cw, ch, camera) {
        const cx = (overlay.x - camera.x) * cw + cw / 2;
        const cy = (overlay.y - camera.y) * ch + ch / 2;
        const radius = (overlay.radius || 1) * cw;

        ctx.save();
        ctx.globalAlpha = overlay.alpha !== undefined ? overlay.alpha : 0.3;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, overlay.color || '#ffffff');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    _renderScreenFlash(ctx, overlay) {
        ctx.save();
        ctx.globalAlpha = overlay.alpha || 0.2;
        ctx.fillStyle = overlay.color || '#ff0000';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.restore();
    }

    _renderFloatingText(ctx, overlay, cw, ch, camera) {
        const progress = 1 - (overlay.ttl / overlay.maxTtl);
        const floatOffset = progress * 30;
        const alpha = 1 - progress;

        const sx = (overlay.x - camera.x) * cw + cw / 2;
        const sy = (overlay.y - camera.y) * ch - floatOffset;
        if (sx < -100 || sx > this.canvas.width + 100 || sy < -50 || sy > this.canvas.height + 50) return;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${Math.round((overlay.fontSize || 12) * (this._uiFontScale || 1))}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(overlay.text, sx, sy);

        ctx.fillStyle = overlay.color || '#ffffff';
        ctx.fillText(overlay.text, sx, sy);
        ctx.restore();
    }

    _renderChatBubble(ctx, overlay, cw, ch, camera) {
        const progress = 1 - (overlay.ttl / overlay.maxTtl);
        const floatOffset = progress * 20;
        const alpha = 1 - progress;

        const sx = (overlay.x - camera.x) * cw + cw / 2;
        const sy = (overlay.y - camera.y) * ch - ch * 0.8 - floatOffset;
        if (sx < -100 || sx > this.canvas.width + 100 || sy < -50 || sy > this.canvas.height + 50) return;

        const text = overlay.text || '...';
        const fontSize = Math.round(11 * (this._uiFontScale || 1));

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const textW = ctx.measureText(text).width;
        const padX = 5;
        const padY = 3;
        const bubbleW = textW + padX * 2;
        const bubbleH = fontSize + padY * 2;

        // Bubble background
        ctx.fillStyle = '#222233';
        ctx.strokeStyle = overlay.color || '#ffffff';
        ctx.lineWidth = 1.5;
        const bx = sx - bubbleW / 2;
        const by = sy - bubbleH / 2;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(bx, by, bubbleW, bubbleH, 4);
        } else {
            ctx.rect(bx, by, bubbleW, bubbleH);
        }
        ctx.fill();
        ctx.stroke();

        // Text
        ctx.fillStyle = overlay.color || '#ffffff';
        ctx.fillText(text, sx, sy);
        ctx.restore();
    }

    _renderWarmthOverlay(ctx, game, cw, ch, camera) {
        // Collect all active warmth sources: passive (campfire) and powered (ember_heater etc.)
        const sources = [];
        const isWinter = game.weather.season === 'winter';
        const isPowered = game.power.hasPower();

        const allStructures = game.mapIndex.getAllStructurePositions();
        for (const { x, y, type } of allStructures) {
            const bDef = BUILDINGS[type];
            if (!bDef) continue;
            // Non-powered warmth (campfire)
            if (bDef.warmRadius) {
                sources.push({ x, y, radius: bDef.warmRadius, passive: true });
            }
            // Powered warmth — only active when grid is powered; seasonal heaters only in winter
            if (bDef.power?.warmRadius && isPowered) {
                if (!bDef.power.seasonalHeat || isWinter) {
                    sources.push({ x, y, radius: bDef.power.warmRadius, passive: false });
                }
            }
        }

        if (sources.length === 0) return;

        ctx.save();
        for (const src of sources) {
            const r = src.radius;
            // Outer glow fill — warm orange tint, fades toward edge
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const dist = Math.abs(dx) + Math.abs(dy);
                    if (dist > r) continue;
                    const sx = (src.x + dx - camera.x) * cw;
                    const sy = (src.y + dy - camera.y) * ch;
                    if (sx < -cw || sx > this.canvas.width || sy < -ch || sy > this.canvas.height) continue;
                    const falloff = 1 - dist / (r + 1);
                    ctx.globalAlpha = falloff * (src.passive ? 0.18 : 0.22);
                    ctx.fillStyle = src.passive ? '#ff9933' : '#ff6622';
                    ctx.fillRect(sx, sy, cw, ch);
                }
            }
            // Border ring at the edge of the radius
            ctx.globalAlpha = 0.55;
            ctx.strokeStyle = src.passive ? '#ffaa44' : '#ff7733';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.abs(dx) + Math.abs(dy) !== r) continue;
                    const sx = (src.x + dx - camera.x) * cw;
                    const sy = (src.y + dy - camera.y) * ch;
                    if (Math.abs(dx) + Math.abs(dy + 1) > r) { ctx.moveTo(sx, sy + ch); ctx.lineTo(sx + cw, sy + ch); }
                    if (Math.abs(dx) + Math.abs(dy - 1) > r) { ctx.moveTo(sx, sy); ctx.lineTo(sx + cw, sy); }
                    if (Math.abs(dx + 1) + Math.abs(dy) > r) { ctx.moveTo(sx + cw, sy); ctx.lineTo(sx + cw, sy + ch); }
                    if (Math.abs(dx - 1) + Math.abs(dy) > r) { ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + ch); }
                }
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // Shared helper: fills a Manhattan-diamond radius zone and draws its border.
    // fillColor/borderColor are full CSS color strings (include alpha via rgba).
    _drawRadiusZone(ctx, x, y, radius, fillAlpha, fillColor, borderColor, cw, ch, camera) {
        ctx.fillStyle = fillColor;
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (Math.abs(dx) + Math.abs(dy) > radius) continue;
                const sx = (x + dx - camera.x) * cw;
                const sy = (y + dy - camera.y) * ch;
                if (sx < -cw || sx > this.canvas.width || sy < -ch || sy > this.canvas.height) continue;
                ctx.globalAlpha = fillAlpha;
                ctx.fillRect(sx, sy, cw, ch);
            }
        }
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (Math.abs(dx) + Math.abs(dy) > radius) continue;
                const sx = (x + dx - camera.x) * cw;
                const sy = (y + dy - camera.y) * ch;
                if (Math.abs(dx) + Math.abs(dy + 1) > radius) { ctx.moveTo(sx, sy + ch); ctx.lineTo(sx + cw, sy + ch); }
                if (Math.abs(dx) + Math.abs(dy - 1) > radius) { ctx.moveTo(sx, sy); ctx.lineTo(sx + cw, sy); }
                if (Math.abs(dx + 1) + Math.abs(dy) > radius) { ctx.moveTo(sx + cw, sy); ctx.lineTo(sx + cw, sy + ch); }
                if (Math.abs(dx - 1) + Math.abs(dy) > radius) { ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + ch); }
            }
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    _renderDefenseOverlay(ctx, game, cw, ch, camera) {
        if (!game.power.powered) return;
        ctx.save();
        // Arcane sentinels — red
        for (const t of game.power.turrets) {
            this._drawRadiusZone(ctx, t.x, t.y, t.radius, 0.12, '#ff4444', '#ff6666', cw, ch, camera);
        }
        // Void turrets — purple
        for (const t of game.power.voidTurrets) {
            this._drawRadiusZone(ctx, t.x, t.y, t.radius, 0.12, '#aa33ff', '#cc66ff', cw, ch, camera);
        }
        // Inferno wards — orange (damage zone, same as warmth radius)
        for (const w of game.power.aoeWards) {
            this._drawRadiusZone(ctx, w.x, w.y, w.radius, 0.12, '#ff6600', '#ff9933', cw, ch, camera);
        }
        ctx.restore();
    }

    _renderRoomOverlay(ctx, game, cw, ch, camera) {
        // Tier → fill color maps. Index matches tier order (worst to best).
        const bedroomColors  = ['#334466', '#2255aa', '#33aa66', '#aacc33', '#ffdd44'];
        const townhallColors = ['#334466', '#2255aa', '#33aa66', '#ffdd44'];
        const workshopColors = ['#334466', '#2255aa', '#33aa66', '#aacc33', '#ffdd44'];

        const tileIndexOf = (tiers, tierKey) => tiers.findIndex(t => t.key === tierKey);

        ctx.save();
        const map = game.map;
        const camX = camera.x, camY = camera.y;
        const cWidth = this.canvas.width, cHeight = this.canvas.height;

        for (let wy = camY; wy < camY + Math.ceil(cHeight / ch) + 1; wy++) {
            const row = map[wy];
            if (!row) continue;
            for (let wx = camX; wx < camX + Math.ceil(cWidth / cw) + 1; wx++) {
                const tile = row[wx];
                if (!tile || tile.roomId == null) continue;
                const px = (wx - camX) * cw;
                const py = (wy - camY) * ch;

                let color = null;
                let tierIdx = 0;

                const bq = game.roomQualities[tile.roomId];
                const wq = game.workshopQualities[tile.roomId];
                const thq = game.townHallQualities[tile.roomId];

                if (bq) {
                    tierIdx = tileIndexOf(ROOM_QUALITY_TIERS, bq.tier);
                    color = bedroomColors[Math.max(0, tierIdx)];
                } else if (wq) {
                    tierIdx = tileIndexOf(WORKSHOP_QUALITY_TIERS, wq.tier);
                    color = workshopColors[Math.max(0, tierIdx)];
                } else if (thq) {
                    tierIdx = tileIndexOf(TOWN_HALL_QUALITY_TIERS, thq.tier);
                    color = townhallColors[Math.max(0, tierIdx)];
                } else {
                    // Enclosed room with no quality type — neutral tint
                    color = '#444466';
                }

                ctx.globalAlpha = 0.35;
                ctx.fillStyle = color;
                ctx.fillRect(px, py, cw, ch);
            }
        }

        // Room borders: draw edges where roomId changes or tile exits the room
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1.5;
        for (let wy = camY; wy < camY + Math.ceil(cHeight / ch) + 1; wy++) {
            const row = map[wy];
            if (!row) continue;
            for (let wx = camX; wx < camX + Math.ceil(cWidth / cw) + 1; wx++) {
                const tile = row[wx];
                if (!tile || tile.roomId == null) continue;
                const px = (wx - camX) * cw;
                const py = (wy - camY) * ch;
                const id = tile.roomId;

                const bq = game.roomQualities[id];
                const wq = game.workshopQualities[id];
                const thq = game.townHallQualities[id];
                let tierIdx = 0;
                let colors = bedroomColors;
                if (bq) { tierIdx = tileIndexOf(ROOM_QUALITY_TIERS, bq.tier); colors = bedroomColors; }
                else if (wq) { tierIdx = tileIndexOf(WORKSHOP_QUALITY_TIERS, wq.tier); colors = workshopColors; }
                else if (thq) { tierIdx = tileIndexOf(TOWN_HALL_QUALITY_TIERS, thq.tier); colors = townhallColors; }
                ctx.strokeStyle = colors[Math.max(0, tierIdx)] || '#888899';

                const neighborId = (dx, dy) => {
                    const nr = map[wy + dy]; if (!nr) return null;
                    const nt = nr[wx + dx]; return nt ? nt.roomId : null;
                };
                ctx.beginPath();
                if (neighborId(0, -1) !== id) { ctx.moveTo(px, py); ctx.lineTo(px + cw, py); }
                if (neighborId(0,  1) !== id) { ctx.moveTo(px, py + ch); ctx.lineTo(px + cw, py + ch); }
                if (neighborId(-1, 0) !== id) { ctx.moveTo(px, py); ctx.lineTo(px, py + ch); }
                if (neighborId( 1, 0) !== id) { ctx.moveTo(px + cw, py); ctx.lineTo(px + cw, py + ch); }
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    _renderAuraOverlay(ctx, game, cw, ch, camera) {
        ctx.save();
        const isPowered = game.power.hasPower();

        // Mana relay discount zones — purple
        for (const r of game.power.relays) {
            this._drawRadiusZone(ctx, r.x, r.y, r.radius, 0.12, '#9966ff', '#bb88ff', cw, ch, camera);
        }

        // Light radius buildings (candle, glowstone, beacon, campfire light) — yellow
        // Only show buildings that have lightRadius but NOT warmRadius (campfire already on warmth overlay)
        // and NOT power.damage (defense overlay). Use passiveLamps + powered lamps when grid is on.
        const lightSources = [...game.power.passiveLamps];
        if (isPowered) lightSources.push(...game.power.poweredLamps);
        for (const l of lightSources) {
            this._drawRadiusZone(ctx, l.x, l.y, l.radius, 0.10, '#ffee44', '#ffdd55', cw, ch, camera);
        }

        // Artifact pedestals with finite radius — gold
        const allStructures = game.mapIndex.getAllStructurePositions();
        for (const { x, y, type } of allStructures) {
            if (type !== 'artifact_pedestal') continue;
            const tile = game.map[y]?.[x];
            if (!tile?.pedestalArtifact) continue;
            const artDef = ALL_ITEMS[tile.pedestalArtifact];
            if (!artDef?.pedestal?.radius || artDef.pedestal.radius === 'global') continue;
            this._drawRadiusZone(ctx, x, y, artDef.pedestal.radius, 0.14, '#ccaa44', '#eedd66', cw, ch, camera);
        }

        // Colonist-carried trinket pedestals (moving aura sources) — gold, slightly brighter
        for (const c of game.colonists) {
            if (!c.trinket?.pedestal?.radius || c.trinket.pedestal.radius === 'global') continue;
            this._drawRadiusZone(ctx, c.x, c.y, c.trinket.pedestal.radius, 0.14, '#ddbb44', '#ffee77', cw, ch, camera);
        }

        ctx.restore();
    }

    _updateWorldParticles(particles, dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.ay) p.vy += p.ay * dt;
            if (p.wobble) p.wobblePhase = (p.wobblePhase || 0) + p.wobble * dt;
            p.life -= p.decay * dt;
            if (p.maxY != null && p.y > p.maxY) p.life = 0;
            if (p.life <= 0) {
                particles[i] = particles[particles.length - 1];
                particles.length--;
            }
        }
    }

    _renderWorldParticles(ctx, particles, cw, ch, camera) {
        ctx.save();
        for (const p of particles) {
            const sx = (p.x - camera.x) * cw;
            const sy = (p.y - camera.y) * ch;
            if (sx < -20 || sx > this.canvas.width + 20 || sy < -20 || sy > this.canvas.height + 20) continue;
            const wobbleX = p.wobblePhase ? Math.sin(p.wobblePhase) * cw * 0.15 : 0;
            ctx.globalAlpha = Math.max(0, Math.min(1, p.life * (p.alpha || 1)));
            ctx.fillStyle = p.color;
            if (p.shape === 'square') {
                const half = Math.max(0.5, p.size * 0.5);
                ctx.fillRect(sx + wobbleX - half, sy - half, half * 2, half * 2);
            } else {
                ctx.beginPath();
                ctx.arc(sx + wobbleX, sy, Math.max(0.5, p.size * p.life), 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    _renderAlertRipple(ctx, ripple, cw, ch, camera) {
        const now = performance.now();
        const elapsed = now - ripple.startTime;
        if (elapsed > ripple.duration) return;
        const t = elapsed / ripple.duration;
        const sx = (ripple.x - camera.x + 0.5) * cw;
        const sy = (ripple.y - camera.y + 0.5) * ch;
        const maxRadius = 15 * cw;
        ctx.save();
        ctx.strokeStyle = '#ff2222';
        for (let i = 0; i < 3; i++) {
            const ringT = Math.max(0, t - i * 0.12);
            if (ringT <= 0) continue;
            const r = ringT * maxRadius;
            const alpha = Math.max(0, (1 - ringT) * 0.7);
            ctx.globalAlpha = alpha;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    _renderRadiusHighlight(ctx, highlight, cw, ch, camera) {
        const { x, y, radius, color } = highlight;
        ctx.save();
        ctx.fillStyle = color;
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (Math.abs(dx) + Math.abs(dy) > radius) continue;
                const sx = (x + dx - camera.x) * cw;
                const sy = (y + dy - camera.y) * ch;
                if (sx < -cw || sx > this.canvas.width || sy < -ch || sy > this.canvas.height) continue;
                ctx.fillRect(sx, sy, cw, ch);
            }
        }
        const borderColor = color.slice(0, 7) + 'cc';
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (Math.abs(dx) + Math.abs(dy) > radius) continue;
                const sx = (x + dx - camera.x) * cw;
                const sy = (y + dy - camera.y) * ch;
                if (Math.abs(dx) + Math.abs(dy + 1) > radius) { ctx.moveTo(sx, sy + ch); ctx.lineTo(sx + cw, sy + ch); }
                if (Math.abs(dx) + Math.abs(dy - 1) > radius) { ctx.moveTo(sx, sy); ctx.lineTo(sx + cw, sy); }
                if (Math.abs(dx + 1) + Math.abs(dy) > radius) { ctx.moveTo(sx + cw, sy); ctx.lineTo(sx + cw, sy + ch); }
                if (Math.abs(dx - 1) + Math.abs(dy) > radius) { ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + ch); }
            }
        }
        ctx.stroke();
        ctx.restore();
    }
}
