const CELL_SIZE = 8;

export class SpatialHash {
    constructor() {
        this.cells = new Map();
        this.entityCell = new Map();
    }

    _key(cx, cy) {
        return (cy << 16) | cx;
    }

    _cellCoords(x, y) {
        return { cx: (x / CELL_SIZE) | 0, cy: (y / CELL_SIZE) | 0 };
    }

    clear() {
        this.cells.clear();
        this.entityCell.clear();
    }

    insert(entity) {
        const { cx, cy } = this._cellCoords(entity.x, entity.y);
        const k = this._key(cx, cy);
        let cell = this.cells.get(k);
        if (!cell) {
            cell = [];
            this.cells.set(k, cell);
        }
        cell.push(entity);
        this.entityCell.set(entity, k);
    }

    remove(entity) {
        const k = this.entityCell.get(entity);
        if (k === undefined) return;
        const cell = this.cells.get(k);
        if (cell) {
            const idx = cell.indexOf(entity);
            if (idx >= 0) cell.splice(idx, 1);
            if (cell.length === 0) this.cells.delete(k);
        }
        this.entityCell.delete(entity);
    }

    rebuild(entities) {
        this.cells.clear();
        this.entityCell.clear();
        for (const entity of entities) {
            if (entity.hp > 0) this.insert(entity);
        }
    }

    query(x, y, radius) {
        const results = [];
        const minCx = ((x - radius) / CELL_SIZE) | 0;
        const maxCx = ((x + radius) / CELL_SIZE) | 0;
        const minCy = ((y - radius) / CELL_SIZE) | 0;
        const maxCy = ((y + radius) / CELL_SIZE) | 0;

        for (let cy = minCy; cy <= maxCy; cy++) {
            for (let cx = minCx; cx <= maxCx; cx++) {
                const cell = this.cells.get(this._key(cx, cy));
                if (!cell) continue;
                for (const entity of cell) {
                    if (entity.hp <= 0) continue;
                    results.push(entity);
                }
            }
        }
        return results;
    }

    findNearest(x, y, radius, filter) {
        let nearest = null;
        let minDist = Infinity;
        const minCx = ((x - radius) / CELL_SIZE) | 0;
        const maxCx = ((x + radius) / CELL_SIZE) | 0;
        const minCy = ((y - radius) / CELL_SIZE) | 0;
        const maxCy = ((y + radius) / CELL_SIZE) | 0;

        for (let cy = minCy; cy <= maxCy; cy++) {
            for (let cx = minCx; cx <= maxCx; cx++) {
                const cell = this.cells.get(this._key(cx, cy));
                if (!cell) continue;
                for (const entity of cell) {
                    if (entity.hp <= 0) continue;
                    if (filter && !filter(entity)) continue;
                    const dist = Math.abs(x - entity.x) + Math.abs(y - entity.y);
                    if (dist < minDist) {
                        minDist = dist;
                        nearest = entity;
                    }
                }
            }
        }
        return nearest;
    }

    findNearestDist(x, y, radius, filter) {
        let nearest = null;
        let minDist = Infinity;
        const minCx = ((x - radius) / CELL_SIZE) | 0;
        const maxCx = ((x + radius) / CELL_SIZE) | 0;
        const minCy = ((y - radius) / CELL_SIZE) | 0;
        const maxCy = ((y + radius) / CELL_SIZE) | 0;

        for (let cy = minCy; cy <= maxCy; cy++) {
            for (let cx = minCx; cx <= maxCx; cx++) {
                const cell = this.cells.get(this._key(cx, cy));
                if (!cell) continue;
                for (const entity of cell) {
                    if (entity.hp <= 0) continue;
                    if (filter && !filter(entity)) continue;
                    const dist = Math.abs(x - entity.x) + Math.abs(y - entity.y);
                    if (dist < minDist) {
                        minDist = dist;
                        nearest = entity;
                    }
                }
            }
        }
        return { entity: nearest, dist: minDist };
    }
}
