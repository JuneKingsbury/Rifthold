import { CONFIG, WALL_STRUCTURES, DOOR_STRUCTURES, BUILDINGS, ROOM_QUALITY_TIERS, WORKSHOP_QUALITY_TIERS, STATION_GROUPS, FLOOR_QUALITY_VALUES } from '../core/config.js';

export function detectRooms(map) {
    for (let y = 0; y < CONFIG.MAP_HEIGHT; y++) {
        for (let x = 0; x < CONFIG.MAP_WIDTH; x++) {
            map[y][x].roomId = null;
        }
    }

    let roomId = 0;
    const visited = new Set();

    for (let y = 0; y < CONFIG.MAP_HEIGHT; y++) {
        for (let x = 0; x < CONFIG.MAP_WIDTH; x++) {
            const key = `${x},${y}`;
            if (visited.has(key)) continue;
            const tile = map[y][x];
            if (isWall(tile)) continue;
            if (tile.terrain === 'water' || tile.terrain === 'rock' || tile.terrain === 'tall_rock') continue;
            if (!tile.passable) continue;

            const result = floodFill(map, x, y, visited);
            if (result.enclosed && result.tiles.length <= 100) {
                for (const pos of result.tiles) {
                    map[pos.y][pos.x].roomId = roomId;
                }
                roomId++;
            }
        }
    }

    return roomId;
}

function floodFill(map, startX, startY, visited) {
    const tiles = [];
    const queue = [{ x: startX, y: startY }];
    let enclosed = true;
    const localVisited = new Set();

    while (queue.length > 0) {
        const { x, y } = queue.shift();
        const key = `${x},${y}`;
        if (localVisited.has(key)) continue;
        localVisited.add(key);
        visited.add(key);

        if (x <= 0 || x >= CONFIG.MAP_WIDTH - 1 || y <= 0 || y >= CONFIG.MAP_HEIGHT - 1) {
            enclosed = false;
            continue;
        }

        const tile = map[y][x];
        tiles.push({ x, y });

        const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        for (const [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            const nKey = `${nx},${ny}`;
            if (localVisited.has(nKey)) continue;
            if (nx < 0 || nx >= CONFIG.MAP_WIDTH || ny < 0 || ny >= CONFIG.MAP_HEIGHT) {
                enclosed = false;
                continue;
            }
            const neighbor = map[ny][nx];
            if (isWall(neighbor)) continue;
            if (neighbor.terrain === 'tall_rock') continue;
            if (DOOR_STRUCTURES.has(neighbor.structure)) {
                localVisited.add(nKey);
                visited.add(nKey);
                tiles.push({ x: nx, y: ny });
                continue;
            }
            if (neighbor.terrain === 'water') continue;
            if (neighbor.terrain === 'rock') {
                enclosed = false;
                continue;
            }
            queue.push({ x: nx, y: ny });
        }
    }

    return { enclosed, tiles };
}

function isWall(tile) {
    return WALL_STRUCTURES.has(tile.structure);
}

export function getRoomContents(map, roomId) {
    const contents = { beds: [], stations: [], size: 0 };
    for (let y = 0; y < CONFIG.MAP_HEIGHT; y++) {
        for (let x = 0; x < CONFIG.MAP_WIDTH; x++) {
            if (map[y][x].roomId !== roomId) continue;
            contents.size++;
            if (map[y][x].structure === 'bed') contents.beds.push({ x, y });
            if (map[y][x].structure === 'workbench') contents.stations.push({ x, y, type: 'workbench' });
            if (map[y][x].structure === 'cauldron') contents.stations.push({ x, y, type: 'cauldron' });
            if (map[y][x].structure === 'anvil') contents.stations.push({ x, y, type: 'anvil' });
            if (map[y][x].structure === 'alchemy_table') contents.stations.push({ x, y, type: 'alchemy_table' });
            if (map[y][x].structure === 'scriptorium') contents.stations.push({ x, y, type: 'scriptorium' });
            if (map[y][x].structure === 'enchanting_table') contents.stations.push({ x, y, type: 'enchanting_table' });
            if (map[y][x].structure === 'research_desk') contents.stations.push({ x, y, type: 'research_desk' });
        }
    }
    return contents;
}

export function calculateRoomQualities(map, roomCount) {
    const roomQualities = {};
    const workshopQualities = {};

    // Single pass over the grid: bucket tiles by room and collect light sources
    // at the same time, instead of rescanning the whole map once per room.
    const lightSources = [];
    const tilesByRoom = new Map();
    for (let y = 0; y < CONFIG.MAP_HEIGHT; y++) {
        for (let x = 0; x < CONFIG.MAP_WIDTH; x++) {
            const t = map[y][x];
            if (t.structure && BUILDINGS[t.structure] && BUILDINGS[t.structure].lightRadius) {
                lightSources.push({ x, y, radius: BUILDINGS[t.structure].lightRadius });
            }
            const id = t.roomId;
            if (id === undefined || id === null || id < 0) continue;
            let tiles = tilesByRoom.get(id);
            if (!tiles) tilesByRoom.set(id, tiles = []);
            tiles.push({ x, y, tile: t });
        }
    }

    for (let id = 0; id < roomCount; id++) {
        const tiles = tilesByRoom.get(id);
        if (!tiles || tiles.length === 0) continue;

        const analysis = analyzeRoom(map, tiles, lightSources);

        if (analysis.bedCount > 0) {
            roomQualities[id] = computeBedroomQuality(analysis);
        }
        if (analysis.stationTypes.size > 0) {
            workshopQualities[id] = computeWorkshopQuality(analysis);
        }
    }

    return { roomQualities, workshopQualities };
}

function analyzeRoom(map, tiles, lightSources) {
    let bedCount = 0;
    let stationCount = 0;
    let flooredTiles = 0;
    let litTiles = 0;
    const floorTypes = {};
    const decorations = {};
    const workshopSupport = {};
    const stationTypes = new Set();
    const wallTypes = new Set();
    let allWallsSturdy = true;

    for (const { x, y, tile } of tiles) {
        if (tile.structure === 'bed') bedCount++;

        if (tile.floor) {
            if (FLOOR_QUALITY_VALUES[tile.floor]) {
                flooredTiles++;
                floorTypes[tile.floor] = (floorTypes[tile.floor] || 0) + 1;
            } else if (tile.floor === 'rug') {
                flooredTiles++;
                floorTypes['rug'] = (floorTypes['rug'] || 0) + 1;
            }
        }

        if (tile.structure && STATION_GROUPS[tile.structure]) {
            stationTypes.add(tile.structure);
            stationCount++;
        }

        const bDef = tile.structure && BUILDINGS[tile.structure];
        if (bDef && bDef.roomQuality) {
            decorations[tile.structure] = (decorations[tile.structure] || 0) + 1;
        }
        if (bDef && bDef.workshopBonus) {
            workshopSupport[tile.structure] = (workshopSupport[tile.structure] || 0) + 1;
        }

        let isLit = false;
        for (const src of lightSources) {
            const dist = Math.abs(src.x - x) + Math.abs(src.y - y);
            if (dist <= src.radius) { isLit = true; break; }
        }
        if (isLit) litTiles++;
    }

    for (const { x, y, tile } of tiles) {
        const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        for (const [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= CONFIG.MAP_WIDTH || ny < 0 || ny >= CONFIG.MAP_HEIGHT) continue;
            const neighbor = map[ny][nx];
            if (WALL_STRUCTURES.has(neighbor.structure)) {
                wallTypes.add(neighbor.structure);
                if (neighbor.structure === 'wood_wall' || neighbor.structure === 'fence') {
                    allWallsSturdy = false;
                }
            }
        }
    }

    const size = tiles.length;
    const floorCoverage = size > 0 ? flooredTiles / size : 0;
    const litRatio = size > 0 ? litTiles / size : 0;

    const floorTypeNames = Object.keys(floorTypes).filter(f => f !== 'rug');
    const uniformFloor = floorTypeNames.length === 1;

    return {
        size, bedCount, stationCount, flooredTiles, floorCoverage, litTiles, litRatio,
        floorTypes, decorations, workshopSupport, stationTypes,
        wallTypes, allWallsSturdy, uniformFloor, floorTypeNames,
    };
}

function computeBedroomQuality(a) {
    let sizeScore = 0;
    if (a.bedCount > 0) {
        const tilesPerBed = a.size / a.bedCount;
        if (tilesPerBed < 4) sizeScore = 0;
        else if (tilesPerBed <= 5) sizeScore = 10;
        else if (tilesPerBed <= 12) sizeScore = 20;
        else if (tilesPerBed <= 16) sizeScore = 15;
        else if (tilesPerBed <= 20) sizeScore = 10;
        else sizeScore = 5;
    }

    let floorScore = 0;
    if (a.floorCoverage > 0) {
        const floorEntries = Object.entries(a.floorTypes);
        let totalValue = 0;
        let totalTiles = 0;
        for (const [type, count] of floorEntries) {
            const value = type === 'rug' ? 20 : (FLOOR_QUALITY_VALUES[type] || 0);
            totalValue += value * count;
            totalTiles += count;
        }
        const avgValue = totalTiles > 0 ? totalValue / totalTiles : 0;
        floorScore = Math.min(25, Math.round(a.floorCoverage * avgValue));
    }

    let lightScore = 0;
    if (a.litRatio >= 0.8) lightScore = 20;
    else if (a.litRatio >= 0.5) lightScore = 15;
    else if (a.litRatio >= 0.3) lightScore = 10;
    else if (a.litRatio > 0) lightScore = 5;

    let decorScore = 0;
    const decorList = [];
    for (const [type, count] of Object.entries(a.decorations)) {
        const bDef = BUILDINGS[type];
        if (!bDef || !bDef.roomQuality) continue;
        const firstValue = bDef.roomQuality;
        decorScore += firstValue;
        decorList.push(bDef.description ? type : type);
        if (count > 1) {
            decorScore += Math.floor(firstValue * 0.5) * (count - 1);
        }
    }
    decorScore = Math.min(25, decorScore);

    let coherenceScore = 0;
    if (a.uniformFloor && a.floorCoverage >= 0.8) coherenceScore += 5;
    if (a.allWallsSturdy && a.wallTypes.size > 0) coherenceScore += 5;

    const total = Math.min(100, sizeScore + floorScore + lightScore + decorScore + coherenceScore);

    let tier = ROOM_QUALITY_TIERS[0];
    for (let i = ROOM_QUALITY_TIERS.length - 1; i >= 0; i--) {
        if (total >= ROOM_QUALITY_TIERS[i].minScore) { tier = ROOM_QUALITY_TIERS[i]; break; }
    }

    return {
        total, tier: tier.key, tierName: tier.name,
        moodEffect: tier.moodEffect, duration: tier.duration,
        breakdown: { size: sizeScore, floor: floorScore, light: lightScore, decor: decorScore, coherence: coherenceScore },
        decorList: Object.keys(a.decorations),
    };
}

function computeWorkshopQuality(a) {
    const tilesPerStation = a.size / Math.max(1, a.stationCount);

    let sizeScore = 0;
    if (tilesPerStation < 5) sizeScore = 0;
    else if (tilesPerStation <= 7) sizeScore = 8;
    else if (tilesPerStation <= 15) sizeScore = 15;
    else if (tilesPerStation <= 20) sizeScore = 10;
    else sizeScore = 5;

    let floorScore = 0;
    if (a.floorCoverage > 0) {
        const floorEntries = Object.entries(a.floorTypes);
        let totalValue = 0;
        let totalTiles = 0;
        for (const [type, count] of floorEntries) {
            const value = type === 'rug' ? 15 : (FLOOR_QUALITY_VALUES[type] || 0);
            const workshopValue = type === 'wood_floor' ? 12 : (type === 'stone_floor' ? 17 : (type === 'brick_floor' ? 20 : value));
            totalValue += workshopValue * count;
            totalTiles += count;
        }
        const avgValue = totalTiles > 0 ? totalValue / totalTiles : 0;
        floorScore = Math.min(20, Math.round(a.floorCoverage * avgValue));
    }

    let lightScore = 0;
    if (a.litRatio >= 0.8) lightScore = 15;
    else if (a.litRatio >= 0.5) lightScore = 10;
    else if (a.litRatio >= 0.3) lightScore = 7;
    else if (a.litRatio > 0) lightScore = 3;

    const groups = new Set();
    for (const type of a.stationTypes) {
        if (STATION_GROUPS[type]) groups.add(STATION_GROUPS[type]);
    }
    let focusScore = 0;
    let focusGroup = null;
    if (groups.size === 1) { focusScore = 25; focusGroup = [...groups][0]; }
    else if (groups.size === 2) { focusScore = 12; focusGroup = [...groups].join('/'); }

    let supportScore = 0;
    const supportList = [];
    for (const [type, count] of Object.entries(a.workshopSupport)) {
        const bDef = BUILDINGS[type];
        if (!bDef || !bDef.workshopBonus) continue;
        supportScore += bDef.workshopBonus;
        supportList.push(type);
        if (count > 1) {
            supportScore += Math.floor(bDef.workshopBonus * 0.5) * (count - 1);
        }
    }
    supportScore = Math.min(25, supportScore);

    const total = Math.min(100, sizeScore + floorScore + lightScore + focusScore + supportScore);

    let tier = WORKSHOP_QUALITY_TIERS[0];
    for (let i = WORKSHOP_QUALITY_TIERS.length - 1; i >= 0; i--) {
        if (total >= WORKSHOP_QUALITY_TIERS[i].minScore) { tier = WORKSHOP_QUALITY_TIERS[i]; break; }
    }

    return {
        total, tier: tier.key, tierName: tier.name,
        speedMult: tier.speedMult, qualityBonus: tier.qualityBonus,
        breakdown: { size: sizeScore, floor: floorScore, light: lightScore, focus: focusScore, support: supportScore },
        focusGroup, supportList,
    };
}
