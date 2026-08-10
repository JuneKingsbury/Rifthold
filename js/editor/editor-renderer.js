const FONT_HEIGHT_MULT = 1.15;
const BLOCK_CHARS = new Set(['█', '▓', '▒']);
const GRID_LINE_COLOR = '#333333';
const BG_COLOR = '#111111';
const HOVER_COLOR = 'rgba(255,255,255,0.15)';
const SELECTED_COLOR = 'rgba(68,170,255,0.25)';
const CORE_COLOR = 'rgba(255,204,0,0.35)';

export class EditorRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.fontSize = 14;
        this.charWidth = 0;
        this.charHeight = 0;
        this._textWidth = 0;
        this._textOffsetX = 0;
        this.measureFont(this.fontSize);
    }

    measureFont(fontSize) {
        this.fontSize = fontSize;
        this.ctx.font = `${fontSize}px 'Courier New', monospace`;
        const metrics = this.ctx.measureText('M');
        this._textWidth = Math.ceil(metrics.width);
        this.charHeight = Math.ceil(fontSize * FONT_HEIGHT_MULT);
        this.charWidth = this.charHeight;
        this._textOffsetX = Math.floor((this.charWidth - this._textWidth) / 2);
    }

    getViewportSize() {
        return {
            cols: Math.floor(this.canvas.width / this.charWidth),
            rows: Math.floor(this.canvas.height / this.charHeight)
        };
    }

    render(state) {
        const { grid, gridWidth, gridHeight, camera, hoveredCell, selectedCell, coreCell, buildings } = state;
        const ctx = this.ctx;
        const cw = this.charWidth;
        const ch = this.charHeight;
        const { cols, rows } = this.getViewportSize();

        ctx.fillStyle = BG_COLOR;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.font = `${this.fontSize}px 'Courier New', monospace`;
        ctx.textBaseline = 'top';

        for (let sy = 0; sy < rows; sy++) {
            for (let sx = 0; sx < cols; sx++) {
                const wx = camera.x + sx;
                const wy = camera.y + sy;
                if (wx < 0 || wx >= gridWidth || wy < 0 || wy >= gridHeight) continue;

                const px = sx * cw;
                const py = sy * ch;
                const cell = grid[wy]?.[wx];

                if (cell) {
                    // Render floor background first
                    if (cell.floorKey) {
                        const floorDef = cell.floorKey.isCustom ? cell.floorKey.customDef : buildings[cell.floorKey.buildingKey];
                        if (floorDef && floorDef.bg) {
                            ctx.fillStyle = floorDef.bg;
                            ctx.fillRect(px, py, cw, ch);
                        }
                    }
                    const def = cell.isCustom ? cell.customDef : buildings[cell.buildingKey];
                    if (def) {
                        if (!cell.floorKey && def.bg) {
                            ctx.fillStyle = def.bg;
                            ctx.fillRect(px, py, cw, ch);
                        }
                        const char = def.char;
                        const color = def.color;
                        if (BLOCK_CHARS.has(char)) {
                            ctx.fillStyle = color;
                            ctx.fillRect(px, py, cw, ch);
                        } else {
                            ctx.fillStyle = color;
                            ctx.fillText(char, px + this._textOffsetX, py);
                        }
                    }
                }

                // Grid lines
                ctx.strokeStyle = GRID_LINE_COLOR;
                ctx.lineWidth = 0.5;
                ctx.strokeRect(px, py, cw, ch);
            }
        }

        // Highlights
        if (coreCell && coreCell.x >= camera.x && coreCell.x < camera.x + cols &&
            coreCell.y >= camera.y && coreCell.y < camera.y + rows) {
            const px = (coreCell.x - camera.x) * cw;
            const py = (coreCell.y - camera.y) * ch;
            ctx.fillStyle = CORE_COLOR;
            ctx.fillRect(px, py, cw, ch);
            ctx.fillStyle = '#ffcc00';
            ctx.font = `${Math.max(8, this.fontSize - 4)}px 'Courier New', monospace`;
            ctx.fillText('★', px + 1, py + 1);
            ctx.font = `${this.fontSize}px 'Courier New', monospace`;
        }

        if (selectedCell && selectedCell.x >= camera.x && selectedCell.x < camera.x + cols &&
            selectedCell.y >= camera.y && selectedCell.y < camera.y + rows) {
            const px = (selectedCell.x - camera.x) * cw;
            const py = (selectedCell.y - camera.y) * ch;
            ctx.fillStyle = SELECTED_COLOR;
            ctx.fillRect(px, py, cw, ch);
            ctx.strokeStyle = '#44aaff';
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 1, py + 1, cw - 2, ch - 2);
        }

        if (hoveredCell && hoveredCell.x >= camera.x && hoveredCell.x < camera.x + cols &&
            hoveredCell.y >= camera.y && hoveredCell.y < camera.y + rows) {
            const px = (hoveredCell.x - camera.x) * cw;
            const py = (hoveredCell.y - camera.y) * ch;
            ctx.fillStyle = HOVER_COLOR;
            ctx.fillRect(px, py, cw, ch);
        }

        // Grid boundary indicator
        const boundaryRight = Math.min(gridWidth - camera.x, cols);
        const boundaryBottom = Math.min(gridHeight - camera.y, rows);
        if (boundaryRight < cols || boundaryBottom < rows) {
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            if (boundaryRight < cols) {
                const bx = boundaryRight * cw;
                ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx, this.canvas.height); ctx.stroke();
            }
            if (boundaryBottom < rows) {
                const by = boundaryBottom * ch;
                ctx.beginPath(); ctx.moveTo(0, by); ctx.lineTo(this.canvas.width, by); ctx.stroke();
            }
            ctx.setLineDash([]);
        }
    }

    screenToGrid(screenX, screenY, camera) {
        const gx = camera.x + Math.floor(screenX / this.charWidth);
        const gy = camera.y + Math.floor(screenY / this.charHeight);
        return { x: gx, y: gy };
    }
}
