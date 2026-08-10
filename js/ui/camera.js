import { CONFIG } from '../core/config.js';

export class Camera {
    constructor() {
        this.x = Math.floor(CONFIG.MAP_WIDTH / 2 - CONFIG.VIEWPORT_WIDTH / 2);
        this.y = Math.floor(CONFIG.MAP_HEIGHT / 2 - CONFIG.VIEWPORT_HEIGHT / 2);
    }

    pan(dx, dy) {
        this.x = Math.max(0, Math.min(CONFIG.MAP_WIDTH - CONFIG.VIEWPORT_WIDTH, this.x + dx));
        this.y = Math.max(0, Math.min(CONFIG.MAP_HEIGHT - CONFIG.VIEWPORT_HEIGHT, this.y + dy));
    }

    centerOn(wx, wy) {
        this.x = Math.max(0, Math.min(CONFIG.MAP_WIDTH - CONFIG.VIEWPORT_WIDTH, wx - Math.floor(CONFIG.VIEWPORT_WIDTH / 2)));
        this.y = Math.max(0, Math.min(CONFIG.MAP_HEIGHT - CONFIG.VIEWPORT_HEIGHT, wy - Math.floor(CONFIG.VIEWPORT_HEIGHT / 2)));
    }

    clamp() {
        this.x = Math.max(0, Math.min(CONFIG.MAP_WIDTH - CONFIG.VIEWPORT_WIDTH, this.x));
        this.y = Math.max(0, Math.min(CONFIG.MAP_HEIGHT - CONFIG.VIEWPORT_HEIGHT, this.y));
    }

    screenToWorld(sx, sy) {
        return { x: sx + this.x, y: sy + this.y };
    }

    worldToScreen(wx, wy) {
        return { x: wx - this.x, y: wy - this.y };
    }

    isVisible(wx, wy) {
        return wx >= this.x && wx < this.x + CONFIG.VIEWPORT_WIDTH &&
               wy >= this.y && wy < this.y + CONFIG.VIEWPORT_HEIGHT;
    }
}
