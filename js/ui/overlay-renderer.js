import { CONFIG, RENDER_CONFIG } from '../core/config.js';

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
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (game.input && (game.input.mode === 'build' || game.input.mode === 'zone')) {
            this._renderBuildGrid(ctx, cw, ch, this.canvas.width, this.canvas.height);
        }

        if (game.settings.showWeatherParticles && game.weather) {
            const now = performance.now();
            const dt = this._lastWeatherTime ? Math.min((now - this._lastWeatherTime) / 1000, 0.1) : 0.016;
            this._lastWeatherTime = now;
            this._updateWeatherParticles(game.weather.currentWeather, this.canvas.width, this.canvas.height, dt);
            this._renderWeatherParticles(ctx);
        } else if (this._weatherParticles.length > 0) {
            this._weatherParticles.length = 0;
        }

        if (game.radiusHighlight && game.selectedColonist) {
            const c = game.selectedColonist;
            if (c.artifact && !c.artifactBroken && c.artifact.pedestal?.radius && c.artifact.pedestal.radius !== 'global') {
                game.radiusHighlight.x = c.x;
                game.radiusHighlight.y = c.y;
            }
        }
        if (game.radiusHighlight) {
            this._renderRadiusHighlight(ctx, game.radiusHighlight, cw, ch, camera);
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

    _updateWeatherParticles(weatherType, canvasWidth, canvasHeight, dt) {
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
            if (p.y > canvasHeight || p.x > canvasWidth || p.x < -20) {
                this._weatherParticles[i] = this._spawnWeatherParticle(weatherType, canvasWidth, canvasHeight, false);
            }
        }
    }

    _getParticleTarget(weatherType) {
        switch (weatherType) {
            case 'rain': return 120;
            case 'thunderstorm': return 180;
            case 'snow': return 60;
            case 'blizzard': return 100;
            default: return 0;
        }
    }

    _spawnWeatherParticle(weatherType, canvasWidth, canvasHeight, randomY) {
        const x = Math.random() * (canvasWidth + 40) - 20;
        const y = randomY ? Math.random() * canvasHeight : -(Math.random() * 20);

        switch (weatherType) {
            case 'rain':
            case 'thunderstorm':
                return { x, y, vx: 30, vy: 250 + Math.random() * 100, type: 'rain' };
            case 'snow':
                return { x, y, vx: 5 + Math.random() * 10, vy: 30 + Math.random() * 20, size: 1.5 + Math.random() * 1.5, type: 'snow' };
            case 'blizzard':
                return { x, y, vx: 40 + Math.random() * 30, vy: 50 + Math.random() * 30, size: 2 + Math.random() * 2, type: 'snow' };
            default:
                return { x, y, vx: 0, vy: 0, size: 0, type: 'none' };
        }
    }

    _renderWeatherParticles(ctx) {
        if (this._weatherParticles.length === 0) return;
        ctx.save();
        let hasRain = false;
        let hasSnow = false;
        for (const p of this._weatherParticles) {
            if (p.type === 'rain') hasRain = true;
            else if (p.type === 'snow') hasSnow = true;
        }
        if (hasRain) {
            ctx.strokeStyle = 'rgba(100, 150, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (const p of this._weatherParticles) {
                if (p.type !== 'rain') continue;
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + 2, p.y + 8);
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
        ctx.restore();
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
        ctx.font = `bold ${overlay.fontSize || 12}px monospace`;
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
        const fontSize = 11;

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
