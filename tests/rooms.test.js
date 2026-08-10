// Guards room detection + quality scoring. detectRooms flood-fills enclosed,
// walkable areas (<=100 tiles); calculateRoomQualities scores bedrooms and
// workshops. Protects the Phase-3a single-pass rewrite of calculateRoomQualities.
import { describe, it, expect } from 'vitest';
import { detectRooms, calculateRoomQualities } from '../js/world/rooms.js';
import { makeMap, enclose } from './helpers.js';

describe('detectRooms', () => {
    it('finds a single enclosed room and assigns its interior a roomId', () => {
        const map = makeMap();
        const inner = enclose(map, 5, 5, 12, 12);
        const count = detectRooms(map);
        expect(count).toBe(1);
        expect(map[inner.y0][inner.x0].roomId).toBe(0);
        // A wall tile is not part of the room interior.
        expect(map[5][5].roomId).toBeNull();
    });

    it('does not create a room for an open (unenclosed) area', () => {
        const map = makeMap();
        expect(detectRooms(map)).toBe(0);
    });

    it('detects two separate enclosed rooms', () => {
        const map = makeMap();
        enclose(map, 3, 3, 8, 8);
        enclose(map, 20, 20, 26, 26);
        expect(detectRooms(map)).toBe(2);
    });
});

describe('calculateRoomQualities', () => {
    it('scores a bedroom when the enclosed room contains a bed', () => {
        const map = makeMap();
        const inner = enclose(map, 5, 5, 12, 12);
        map[inner.y0][inner.x0].structure = 'bed';
        const count = detectRooms(map);
        const { roomQualities } = calculateRoomQualities(map, count);
        expect(roomQualities[0]).toBeDefined();
    });

    it('returns empty quality maps when there are no rooms', () => {
        const map = makeMap();
        const { roomQualities, workshopQualities } = calculateRoomQualities(map, detectRooms(map));
        expect(Object.keys(roomQualities)).toHaveLength(0);
        expect(Object.keys(workshopQualities)).toHaveLength(0);
    });
});
