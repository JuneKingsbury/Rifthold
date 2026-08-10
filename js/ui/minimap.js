import { CONFIG, TILE_COLORS, BUILDINGS } from '../core/config.js';

const SCALE_X = 2;
const SCALE_Y = 2;

export class Minimap {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.game = game;
        this.ctx = canvas.getContext('2d');

        canvas.width = CONFIG.MAP_WIDTH * SCALE_X;
        canvas.height = CONFIG.MAP_HEIGHT * SCALE_Y;
        canvas.style.maxHeight = '100%';
        canvas.style.maxWidth = '100%';
        canvas.style.width = 'auto';
        canvas.style.height = 'auto';

        canvas.addEventListener('mousedown', (e) => { e.stopPropagation(); this.onClick(e); });
        canvas.addEventListener('mousemove', (e) => {
            if (e.buttons === 1) { e.stopPropagation(); this.onClick(e); }
        });
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.onTouch(e); }, { passive: false });
        canvas.addEventListener('touchmove', (e) => { e.preventDefault(); e.stopPropagation(); this.onTouch(e); }, { passive: false });
    }

    onTouch(e) {
        if (e.touches.length !== 1) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = Math.floor((e.touches[0].clientX - rect.left) * scaleX / SCALE_X);
        const y = Math.floor((e.touches[0].clientY - rect.top) * scaleY / SCALE_Y);
        this.game.camera.centerOn(x, y);
    }

    onClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX / SCALE_X);
        const y = Math.floor((e.clientY - rect.top) * scaleY / SCALE_Y);
        this.game.camera.centerOn(x, y);
    }

    render() {
        const { map, colonists, entities, raiders, camera, weather } = this.game;
        const ctx = this.ctx;
        const w = CONFIG.MAP_WIDTH * SCALE_X;
        const h = CONFIG.MAP_HEIGHT * SCALE_Y;
        const imageData = ctx.createImageData(w, h);
        const data = imageData.data;

        for (let y = 0; y < CONFIG.MAP_HEIGHT; y++) {
            for (let x = 0; x < CONFIG.MAP_WIDTH; x++) {
                const tile = map[y][x];
                const color = this.getTileColor(tile, weather.season);

                for (let dy = 0; dy < SCALE_Y; dy++) {
                    for (let dx = 0; dx < SCALE_X; dx++) {
                        const px = x * SCALE_X + dx;
                        const py = y * SCALE_Y + dy;
                        const idx = (py * w + px) * 4;
                        data[idx] = color[0];
                        data[idx + 1] = color[1];
                        data[idx + 2] = color[2];
                        data[idx + 3] = 255;
                    }
                }
            }
        }

        for (const c of colonists) {
            if (c.hp <= 0) continue;
            this.drawDot(data, c.x, c.y, [255, 255, 0]);
        }
        for (const e of entities) {
            if (e.hp <= 0) continue;
            if (e.tamed) {
                this.drawDot(data, e.x, e.y, [100, 200, 100]);
            } else if (e.category === 'animal') {
                this.drawDot(data, e.x, e.y, e.hostile ? [180, 50, 50] : [150, 120, 80]);
            }
        }
        for (const r of raiders) {
            if (r.hp <= 0) continue;
            this.drawDot(data, r.x, r.y, [255, 50, 50]);
        }

        ctx.putImageData(imageData, 0, 0);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(
            camera.x * SCALE_X + 0.5,
            camera.y * SCALE_Y + 0.5,
            CONFIG.VIEWPORT_WIDTH * SCALE_X - 1,
            CONFIG.VIEWPORT_HEIGHT * SCALE_Y - 1
        );
    }

    drawDot(data, x, y, color) {
        const w = CONFIG.MAP_WIDTH * SCALE_X;
        const h = CONFIG.MAP_HEIGHT * SCALE_Y;
        for (let dy = 0; dy < SCALE_Y; dy++) {
            for (let dx = 0; dx < SCALE_X; dx++) {
                const px = x * SCALE_X + dx;
                const py = y * SCALE_Y + dy;
                if (px < 0 || px >= w || py < 0 || py >= h) continue;
                const idx = (py * w + px) * 4;
                data[idx] = color[0];
                data[idx + 1] = color[1];
                data[idx + 2] = color[2];
                data[idx + 3] = 255;
            }
        }
    }

    getTileColor(tile, season) {
        if (tile.onFire) return [255, 68, 0];
        if (tile.structure) {
            const bDef = BUILDINGS[tile.structure];
            if (bDef) {
                const type = bDef.structureType;
                if (type === 'wall') return [180, 180, 180];
                if (type === 'door') return [150, 120, 60];
            }
            return [120, 100, 60];
        }
        if (tile.floor) return [80, 80, 80];
        if (tile.zone) {
            if (tile.zone.state === 'ready') return [220, 200, 0];
            if (tile.zone.state === 'growing') return [60, 150, 30];
            return [80, 60, 0];
        }
        if (tile.resource) {
            if (tile.resource.type === 'tree') return season === 'autumn' ? [180, 120, 30] : [30, 100, 30];
            return [130, 130, 130];
        }
        if (tile.snowCovered) return [200, 200, 210];
        switch (tile.terrain) {
            case 'grass': return [50, 100, 40];
            case 'dirt': return [120, 80, 40];
            case 'rock': return [80, 80, 80];
            case 'tall_rock': return [55, 55, 55];
            case 'water': return [40, 80, 180];
            default: return [30, 30, 30];
        }
    }
}
