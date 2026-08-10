export class MapIndex {
    constructor() {
        this.structures = new Map();
        this.zones = new Set();
        this.fires = new Set();
    }

    clear() {
        this.structures.clear();
        this.zones.clear();
        this.fires.clear();
    }

    _key(x, y) {
        return (y << 16) | x;
    }

    rebuild(map) {
        this.structures.clear();
        this.zones.clear();
        this.fires.clear();

        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < map[y].length; x++) {
                const tile = map[y][x];
                const k = this._key(x, y);
                if (tile.structure) {
                    let set = this.structures.get(tile.structure);
                    if (!set) {
                        set = new Set();
                        this.structures.set(tile.structure, set);
                    }
                    set.add(k);
                }
                if (tile.zone) {
                    this.zones.add(k);
                }
                if (tile.onFire) {
                    this.fires.add(k);
                }
            }
        }
    }

    addStructure(x, y, type) {
        const k = this._key(x, y);
        let set = this.structures.get(type);
        if (!set) {
            set = new Set();
            this.structures.set(type, set);
        }
        set.add(k);
    }

    removeStructure(x, y, type) {
        const k = this._key(x, y);
        const set = this.structures.get(type);
        if (set) {
            set.delete(k);
            if (set.size === 0) this.structures.delete(type);
        }
    }

    addZone(x, y) {
        this.zones.add(this._key(x, y));
    }

    removeZone(x, y) {
        this.zones.delete(this._key(x, y));
    }

    addFire(x, y) {
        this.fires.add(this._key(x, y));
    }

    removeFire(x, y) {
        this.fires.delete(this._key(x, y));
    }

    getStructurePositions(type) {
        return this.structures.get(type) || new Set();
    }

    getAllStructurePositions() {
        const results = [];
        for (const [type, set] of this.structures) {
            for (const k of set) {
                results.push({ x: k & 0xFFFF, y: k >> 16, type });
            }
        }
        return results;
    }

    getZonePositions() {
        const results = [];
        for (const k of this.zones) {
            results.push({ x: k & 0xFFFF, y: k >> 16 });
        }
        return results;
    }

    getFirePositions() {
        const results = [];
        for (const k of this.fires) {
            results.push({ x: k & 0xFFFF, y: k >> 16 });
        }
        return results;
    }

    findFirst(type) {
        const set = this.structures.get(type);
        if (!set || set.size === 0) return null;
        const k = set.values().next().value;
        return { x: k & 0xFFFF, y: k >> 16 };
    }

    findNearest(type, x, y) {
        const set = this.structures.get(type);
        if (!set || set.size === 0) return null;
        let best = null;
        let bestDist = Infinity;
        for (const k of set) {
            const sx = k & 0xFFFF;
            const sy = k >> 16;
            const dist = Math.abs(x - sx) + Math.abs(y - sy);
            if (dist < bestDist) {
                bestDist = dist;
                best = { x: sx, y: sy };
            }
        }
        return best;
    }

    // Returns all positions of a given structure type as an array of {x, y}.
    findAll(type) {
        const set = this.structures.get(type);
        if (!set || set.size === 0) return [];
        const results = [];
        for (const k of set) {
            results.push({ x: k & 0xFFFF, y: k >> 16 });
        }
        return results;
    }
}
