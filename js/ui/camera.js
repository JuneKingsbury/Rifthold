import { CONFIG } from '../core/config.js';

export class Camera {
    constructor() {
        this.x = Math.floor(CONFIG.MAP_WIDTH / 2 - CONFIG.VIEWPORT_WIDTH / 2);
        this.y = Math.floor(CONFIG.MAP_HEIGHT / 2 - CONFIG.VIEWPORT_HEIGHT / 2);
        this.targetX = this.x;
        this.targetY = this.y;
    }

    pan(dx, dy) {
        this.x = Math.max(0, Math.min(CONFIG.MAP_WIDTH - CONFIG.VIEWPORT_WIDTH, this.x + dx));
        this.y = Math.max(0, Math.min(CONFIG.MAP_HEIGHT - CONFIG.VIEWPORT_HEIGHT, this.y + dy));
        this.targetX = this.x;
        this.targetY = this.y;
    }

    panTarget(dx, dy) {
        this.targetX = Math.max(0, Math.min(CONFIG.MAP_WIDTH - CONFIG.VIEWPORT_WIDTH, this.targetX + dx));
        this.targetY = Math.max(0, Math.min(CONFIG.MAP_HEIGHT - CONFIG.VIEWPORT_HEIGHT, this.targetY + dy));
    }

    // Like panTarget but moves by fractional tile amounts for smooth cinematic glides.
    panSmoothTarget(dx, dy) {
        this.targetX = Math.max(0, Math.min(CONFIG.MAP_WIDTH - CONFIG.VIEWPORT_WIDTH, this.targetX + dx));
        this.targetY = Math.max(0, Math.min(CONFIG.MAP_HEIGHT - CONFIG.VIEWPORT_HEIGHT, this.targetY + dy));
    }

    lerpToward(dt) {
        const SPEED = 12;
        const maxStep = SPEED * dt;
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
            this.x = this.targetX;
            this.y = this.targetY;
            return;
        }
        this.x += Math.sign(dx) * Math.min(Math.abs(dx), maxStep);
        this.y += Math.sign(dy) * Math.min(Math.abs(dy), maxStep);
        this.clamp();
    }

    centerOn(wx, wy) {
        this.x = Math.max(0, Math.min(CONFIG.MAP_WIDTH - CONFIG.VIEWPORT_WIDTH, wx - Math.floor(CONFIG.VIEWPORT_WIDTH / 2)));
        this.y = Math.max(0, Math.min(CONFIG.MAP_HEIGHT - CONFIG.VIEWPORT_HEIGHT, wy - Math.floor(CONFIG.VIEWPORT_HEIGHT / 2)));
        this.targetX = this.x;
        this.targetY = this.y;
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
