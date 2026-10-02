import { RESEARCH, RESEARCH_TABS, DEMO_LOCKED_RESEARCH, BUILDINGS } from '../core/config.js';

export function installResearchPanel(UI) {
    Object.assign(UI.prototype, researchMethods);
}

const MIN_SCALE = 0.35;
const MAX_SCALE = 1.5;

const researchMethods = {
    toggleResearchPanel() {
        const opening = !this.researchPanelVisible;
        this._closeAllPanels();
        this.researchPanelVisible = opening;
        this._panelPause(opening);
        this.elements.researchPanel.style.display = opening ? 'block' : 'none';
        if (opening) {
            this.updateResearchPanel();
            this._initResearchKeyboard();
        } else {
            this._removeResearchKeyboard();
        }
        window.soundManager?.playSFXPitched('open_close_click', opening ? 3 : -3);
        this._updateOverlay();
    },

    updateResearchPanel() {
        const research = this.game.research;
        const activeTab = this._researchTab || 'foundations';
        if (!this._researchTabScrolls) this._researchTabScrolls = {};
        const tabsContainer = this.elements.researchPanel.querySelector('.research-tabs');
        if (tabsContainer) {
            this._researchTabsScroll = tabsContainer.scrollLeft;
        }
        // Save current transform before re-render
        const oldWorld = this.elements.researchPanel.querySelector('.research-world');
        if (oldWorld) {
            if (!this._researchTreeTransforms) this._researchTreeTransforms = {};
            this._researchTreeTransforms[activeTab] = oldWorld.dataset.transform
                ? JSON.parse(oldWorld.dataset.transform)
                : null;
        }

        let html = '<div class="research-drag-handle"></div><div class="panel-close" data-panel-close="research">&times;</div><h3>Research</h3>';

        if (research.activeResearch) {
            const activeTech = RESEARCH[research.activeResearch];
            const prog = research.getProgress(research.activeResearch);
            const pct = Math.min(100, Math.floor((prog / activeTech.cost) * 100));
            html += `<div class="info-row" style="color:#aa88ff; font-weight:bold; margin-bottom:6px;">`;
            html += `Researching: ${activeTech.name} (${Math.floor(prog)}/${activeTech.cost})`;
            html += `<button style="margin-left:8px;font-size:10px;padding:1px 6px;cursor:pointer;" onclick="window.game.cancelResearch()">Cancel</button>`;
            html += `</div>`;
            html += `<div style="background:#333;border-radius:3px;height:6px;margin-bottom:8px;"><div style="background:#aa88ff;height:100%;border-radius:3px;width:${pct}%;transition:width 0.3s;"></div></div>`;
        } else {
            const hasAvail = research.hasAvailableResearch();
            html += `<div class="info-row" style="color:${hasAvail ? '#ffcc44' : '#888'}; font-weight:bold; margin-bottom:6px;">`;
            html += hasAvail ? 'No research selected — tome study speed doubled' : 'All available research complete';
            html += `</div>`;
        }

        // Tab bar with progress pills
        html += '<div class="research-tabs">';
        for (const tab of RESEARCH_TABS) {
            const tabKeys = Object.keys(RESEARCH).filter(k => RESEARCH[k].tab === tab.key);
            const done = tabKeys.filter(k => research.completed.has(k)).length;
            const total = tabKeys.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const active = tab.key === activeTab ? ' active' : '';
            html += `<button class="research-tab-btn${active}" data-research-tab="${tab.key}">`;
            html += `${tab.name}`;
            html += `<span class="research-tab-pill"><span class="research-tab-pill-fill" style="width:${pct}%"></span><span class="research-tab-pill-text">${done}/${total}</span></span>`;
            html += `</button>`;
        }
        // Hide-completed toggle
        const hideCompleted = this._researchHideCompleted || false;
        html += `<button class="research-tab-btn research-hide-toggle${hideCompleted ? ' active' : ''}" data-research-hide-toggle>`;
        html += hideCompleted ? 'Show all' : 'Hide done';
        html += `</button>`;
        html += '</div>';

        const tabKeys = Object.keys(RESEARCH).filter(k => RESEARCH[k].tab === activeTab);
        const layers = this._buildResearchLayers(tabKeys);
        html += `<div class="research-tree">`;
        html += `<div class="research-world">`;
        html += `<svg class="research-lines" id="research-lines"></svg>`;
        for (let depth = 0; depth < layers.length; depth++) {
            html += `<div class="research-layer">`;
            for (const key of layers[depth]) {
                const tech = RESEARCH[key];
                const completed = research.completed.has(key);
                if (hideCompleted && completed) continue;
                const demoLocked = this.game.settings.demoMode && DEMO_LOCKED_RESEARCH.has(key);
                const prereqsMet = tech.requires.every(r => research.completed.has(r));
                const gatesMet = prereqsMet && research._checkGates(tech);
                const available = !completed && !demoLocked && prereqsMet && gatesMet;
                const isActive = research.activeResearch === key;
                const prog = research.getProgress(key);
                let cls = 'research-node';
                if (demoLocked) cls += ' demo-locked';
                else if (completed) cls += ' completed';
                else if (isActive) cls += ' affordable';
                else if (available) cls += ' available';
                else cls += ' locked';
                const sameTabReqs = tech.requires.filter(r => RESEARCH[r]?.tab === activeTab);

                // Build tooltip text (used on hover for all nodes)
                const tooltipLines = [tech.description];
                if (!completed && !demoLocked) {
                    tooltipLines.push(`Cost: ${tech.cost} pts`);
                    if (tech.unlocks?.buildings?.length) tooltipLines.push(`Unlocks: ${tech.unlocks.buildings.map(b => b.replace(/_/g, ' ')).join(', ')}`);
                    if (tech.unlocks?.recipes?.length) tooltipLines.push(`Recipes: ${tech.unlocks.recipes.map(r => r.replace(/_/g, ' ')).join(', ')}`);
                    if (tech.unlocks?.crops?.length) tooltipLines.push(`Crops: ${tech.unlocks.crops.map(c => c.replace(/_/g, ' ')).join(', ')}`);
                }
                const tooltip = tooltipLines.join(' | ');

                const clickHandler = available && !isActive ? `onclick="window.game.selectResearch('${key}')"` : isActive ? `onclick="window.game.cancelResearch()"` : '';
                html += `<div class="${cls}" data-key="${key}" data-requires="${sameTabReqs.join(',')}" data-tip="${tooltip.replace(/"/g, '&quot;')}" ${clickHandler}>`;
                html += `<div class="research-node-name">${tech.name}</div>`;
                html += `<div class="research-node-desc">${tech.description}</div>`;
                if (demoLocked) {
                    html += `<div class="research-node-cost" style="color:#ff6666;">Available in Full Version</div>`;
                } else if (completed) {
                    html += `<div class="research-node-cost">Researched</div>`;
                } else if (isActive) {
                    const pct = Math.min(100, Math.floor((prog / tech.cost) * 100));
                    html += `<div class="research-node-cost">${Math.floor(prog)}/${tech.cost} pts (${pct}%)</div>`;
                    html += `<div class="research-node-progress"><div class="research-node-progress-fill" style="width:${pct}%"></div></div>`;
                } else if (prog > 0) {
                    const pct = Math.min(100, Math.floor((prog / tech.cost) * 100));
                    html += `<div class="research-node-cost">${Math.floor(prog)}/${tech.cost} pts (paused)</div>`;
                    html += `<div class="research-node-progress"><div class="research-node-progress-fill research-node-progress-paused" style="width:${pct}%"></div></div>`;
                } else {
                    html += `<div class="research-node-cost">${tech.cost} pts</div>`;
                }
                // Gate requirements. Show on locked nodes too so players can plan ahead.
                if (!completed && !demoLocked) {
                    const gateLines = this._getGateRequirements(tech, research);
                    if (gateLines.length > 0) {
                        html += '<div class="research-gates">';
                        for (const gate of gateLines) {
                            const color = gate.met ? '#66cc66' : '#cc8844';
                            const pct = gate.required > 0 ? Math.round((gate.current / gate.required) * 100) : 100;
                            const countText = gate.required > 1 ? ` ${gate.current}/${gate.required}` : '';
                            html += `<div class="research-gate">` +
                                `<div class="gate-bar-label" style="color:${color};">${gate.label}${countText}</div>` +
                                `<div class="gate-bar"><div class="gate-bar-fill${gate.met ? ' gate-bar-met' : ''}" style="width:${pct}%"></div></div>` +
                                `</div>`;
                        }
                        html += '</div>';
                    }
                }
                const crossTabReqs = tech.requires.filter(r => RESEARCH[r]?.tab !== activeTab && !research.completed.has(r));
                if (crossTabReqs.length > 0) {
                    html += '<div class="research-cross-tab-row">';
                    for (const req of crossTabReqs) {
                        const reqTech = RESEARCH[req];
                        const reqTab = RESEARCH_TABS.find(t => t.key === reqTech.tab);
                        const reqCompleted = research.completed.has(req);
                        const reqAvailable = !reqCompleted && reqTech.requires.every(r => research.completed.has(r));
                        const badgeColor = reqCompleted ? '#66cc66' : reqAvailable ? '#cc8833' : '#666';
                        html += `<span class="research-cross-tab" data-jump-tab="${reqTech.tab}" style="border-color:${badgeColor}; color:${badgeColor}">${reqTech.name} (${reqTab.name} →)</span>`;
                    }
                    html += '</div>';
                }
                if (available && !isActive) {
                    html += `<button class="research-node-btn" onclick="event.stopPropagation();window.game.selectResearch('${key}')">Select</button>`;
                } else if (isActive) {
                    html += `<button class="research-node-btn" onclick="event.stopPropagation();window.game.cancelResearch()" style="background:#663333;">Cancel</button>`;
                }
                html += `</div>`;
            }
            html += `</div>`;
        }
        html += `</div>`; // .research-world
        html += `<div class="research-zoom-controls">`;
        html += `<button class="research-zoom-btn" data-zoom="in" title="Zoom in">+</button>`;
        html += `<button class="research-zoom-btn" data-zoom="reset" title="Reset view">&#8635;</button>`;
        html += `<button class="research-zoom-btn" data-zoom="out" title="Zoom out">&minus;</button>`;
        html += `</div>`;
        html += `</div>`; // .research-tree

        if (html !== this._lastResearchHtml) {
            this._lastResearchHtml = html;
            this.elements.researchPanel.innerHTML = html;
            const tabsContainer = this.elements.researchPanel.querySelector('.research-tabs');
            if (tabsContainer && this._researchTabsScroll) {
                tabsContainer.scrollLeft = this._researchTabsScroll;
            }
            requestAnimationFrame(() => {
                this._initResearchPanZoom(activeTab);
                this._drawResearchLines();
            });
            this._initResearchHover();
            this._initResearchTouch();
        }
    },

    _initResearchKeyboard() {
        this._removeResearchKeyboard();
        this._researchKeydownHandler = (e) => {
            if (!this.researchPanelVisible) return;
            const el = document.activeElement;
            if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
            if (e.key === 'Escape') {
                this.toggleResearchPanel();
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                const tabs = RESEARCH_TABS;
                const idx = tabs.findIndex(t => t.key === (this._researchTab || 'foundations'));
                const next = e.key === 'ArrowRight'
                    ? tabs[(idx + 1) % tabs.length]
                    : tabs[(idx - 1 + tabs.length) % tabs.length];
                this._researchTab = next.key;
                this._lastResearchHtml = null;
                this.updateResearchPanel();
            }
        };
        document.addEventListener('keydown', this._researchKeydownHandler);
    },

    _removeResearchKeyboard() {
        if (this._researchKeydownHandler) {
            document.removeEventListener('keydown', this._researchKeydownHandler);
            this._researchKeydownHandler = null;
        }
    },

    _applyResearchTransform(world, x, y, scale) {
        scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
        world.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
        world.dataset.transform = JSON.stringify({ x, y, scale });
        return scale;
    },

    _initResearchPanZoom(activeTab) {
        const tree = this.elements.researchPanel.querySelector('.research-tree');
        const world = tree?.querySelector('.research-world');
        if (!tree || !world) return;

        // Determine initial scale for narrow screens
        const treeW = tree.clientWidth;
        const worldW = world.scrollWidth;
        const defaultScale = worldW > 0 ? Math.min(1, Math.max(MIN_SCALE, (treeW - 16) / worldW)) : 1;

        // Restore saved transform or use default
        const saved = this._researchTreeTransforms?.[activeTab];
        let { x, y, scale } = saved || { x: 0, y: 0, scale: defaultScale };

        // If no saved state, center the world horizontally in the viewport
        if (!saved) {
            const scaledW = worldW * scale;
            x = Math.max(0, (treeW - scaledW) / 2);
            y = 0;
        }

        scale = this._applyResearchTransform(world, x, y, scale);

        const saveTransform = () => {
            if (!this._researchTreeTransforms) this._researchTreeTransforms = {};
            this._researchTreeTransforms[activeTab] = JSON.parse(world.dataset.transform);
        };

        // --- Zoom buttons ---
        tree.querySelectorAll('.research-zoom-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const t = JSON.parse(world.dataset.transform);
                const treeRect = tree.getBoundingClientRect();
                const cx = treeRect.width / 2;
                const cy = treeRect.height / 2;
                let newScale = t.scale;
                if (btn.dataset.zoom === 'in') newScale *= 1.15;
                else if (btn.dataset.zoom === 'out') newScale *= 1 / 1.15;
                else {
                    // reset: recalc default and re-center
                    const w = world.scrollWidth;
                    newScale = Math.min(1, Math.max(MIN_SCALE, (tree.clientWidth - 16) / w));
                    const nx = Math.max(0, (tree.clientWidth - w * newScale) / 2);
                    this._applyResearchTransform(world, nx, 0, newScale);
                    saveTransform();
                    this._drawResearchLines();
                    return;
                }
                // Zoom toward center
                const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
                const nx = cx - (cx - t.x) * (clampedScale / t.scale);
                const ny = cy - (cy - t.y) * (clampedScale / t.scale);
                this._applyResearchTransform(world, nx, ny, clampedScale);
                saveTransform();
                this._drawResearchLines();
            });
        });

        // --- Mouse wheel zoom ---
        tree.addEventListener('wheel', (e) => {
            e.preventDefault();
            const t = JSON.parse(world.dataset.transform);
            const treeRect = tree.getBoundingClientRect();
            const mx = e.clientX - treeRect.left;
            const my = e.clientY - treeRect.top;
            const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
            const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, t.scale * factor));
            const nx = mx - (mx - t.x) * (newScale / t.scale);
            const ny = my - (my - t.y) * (newScale / t.scale);
            this._applyResearchTransform(world, nx, ny, newScale);
            saveTransform();
            this._drawResearchLines();
        }, { passive: false });

        // --- Pointer (mouse) pan ---
        let panActive = false;
        let panStartX = 0, panStartY = 0;
        let panOriginX = 0, panOriginY = 0;

        tree.addEventListener('pointerdown', (e) => {
            // Only single-finger / left-button drag; ignore zoom buttons and interactive elements
            if (e.target.closest('.research-zoom-btn')) return;
            if (e.target.closest('.research-node-btn')) return;
            if (e.target.closest('.research-cross-tab')) return;
            if (e.pointerType === 'touch') return; // handled by touch handler
            if (e.button !== 0) return;
            panActive = true;
            panStartX = e.clientX;
            panStartY = e.clientY;
            const t = JSON.parse(world.dataset.transform);
            panOriginX = t.x;
            panOriginY = t.y;
            tree.classList.add('panning');
            tree.setPointerCapture(e.pointerId);
        });

        tree.addEventListener('pointermove', (e) => {
            if (!panActive || e.pointerType === 'touch') return;
            const t = JSON.parse(world.dataset.transform);
            const nx = panOriginX + (e.clientX - panStartX);
            const ny = panOriginY + (e.clientY - panStartY);
            this._applyResearchTransform(world, nx, ny, t.scale);
        });

        const endPan = (e) => {
            if (!panActive || e.pointerType === 'touch') return;
            panActive = false;
            tree.classList.remove('panning');
            saveTransform();
            this._drawResearchLines();
        };
        tree.addEventListener('pointerup', endPan);
        tree.addEventListener('pointercancel', endPan);

        // --- Touch pan + pinch ---
        let activeTouches = {};

        tree.addEventListener('touchstart', (e) => {
            for (const t of e.changedTouches) activeTouches[t.identifier] = { x: t.clientX, y: t.clientY };
        }, { passive: true });

        tree.addEventListener('touchmove', (e) => {
            const ids = Object.keys(activeTouches);
            if (ids.length === 0) return;

            if (e.touches.length === 2) {
                // Pinch-to-zoom
                e.preventDefault();
                const t0 = e.touches[0], t1 = e.touches[1];
                const prevT0 = activeTouches[t0.identifier];
                const prevT1 = activeTouches[t1.identifier];
                if (!prevT0 || !prevT1) return;

                const prevDist = Math.hypot(prevT0.x - prevT1.x, prevT0.y - prevT1.y);
                const currDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
                const factor = currDist / (prevDist || 1);

                const midX = (t0.clientX + t1.clientX) / 2;
                const midY = (t0.clientY + t1.clientY) / 2;
                const prevMidX = (prevT0.x + prevT1.x) / 2;
                const prevMidY = (prevT0.y + prevT1.y) / 2;
                const treeRect = tree.getBoundingClientRect();
                const mx = midX - treeRect.left;
                const my = midY - treeRect.top;

                const tr = JSON.parse(world.dataset.transform);
                const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, tr.scale * factor));
                const nx = mx - (mx - tr.x) * (newScale / tr.scale) + (midX - prevMidX);
                const ny = my - (my - tr.y) * (newScale / tr.scale) + (midY - prevMidY);
                this._applyResearchTransform(world, nx, ny, newScale);

                activeTouches[t0.identifier] = { x: t0.clientX, y: t0.clientY };
                activeTouches[t1.identifier] = { x: t1.clientX, y: t1.clientY };
            } else if (e.touches.length === 1) {
                // Single-finger pan
                const t = e.touches[0];
                const prev = activeTouches[t.identifier];
                if (!prev) return;
                const tr = JSON.parse(world.dataset.transform);
                const nx = tr.x + (t.clientX - prev.x);
                const ny = tr.y + (t.clientY - prev.y);
                this._applyResearchTransform(world, nx, ny, tr.scale);
                activeTouches[t.identifier] = { x: t.clientX, y: t.clientY };
            }
        }, { passive: false });

        tree.addEventListener('touchend', (e) => {
            for (const t of e.changedTouches) delete activeTouches[t.identifier];
            if (e.touches.length === 0) {
                saveTransform();
                this._drawResearchLines();
            }
        }, { passive: true });

        tree.addEventListener('touchcancel', (e) => {
            for (const t of e.changedTouches) delete activeTouches[t.identifier];
            saveTransform();
        }, { passive: true });
    },

    _initResearchTouch() {
        const tree = this.elements.researchPanel.querySelector('.research-tree');
        if (!tree) return;

        // Swipe left/right on tree switches tabs (single-finger, mostly horizontal)
        let touchStartX = null;
        let touchStartY = null;
        let touchMoved = false;

        tree.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchMoved = false;
        }, { passive: true });

        tree.addEventListener('touchmove', (e) => {
            if (e.touches.length !== 1) return;
            const dx = Math.abs(e.touches[0].clientX - touchStartX);
            const dy = Math.abs(e.touches[0].clientY - touchStartY);
            if (dx > 8 || dy > 8) touchMoved = true;
        }, { passive: true });

        tree.addEventListener('touchend', (e) => {
            if (touchStartX === null) return;
            const dx = e.changedTouches[0].clientX - touchStartX;
            const dy = e.changedTouches[0].clientY - touchStartY;
            touchStartX = null;
            touchStartY = null;
            // Only count as a tab-switch swipe if mostly horizontal, long enough, and not a node tap
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                const tabs = RESEARCH_TABS;
                const idx = tabs.findIndex(t => t.key === (this._researchTab || 'foundations'));
                const next = dx < 0
                    ? tabs[(idx + 1) % tabs.length]
                    : tabs[(idx - 1 + tabs.length) % tabs.length];
                this._researchTab = next.key;
                this._lastResearchHtml = null;
                this.updateResearchPanel();
            }
        }, { passive: true });

        // Tap-to-highlight: first tap highlights family chain, second tap on same node selects
        let tappedKey = null;
        tree.addEventListener('touchend', (e) => {
            if (touchMoved) return;
            const node = e.target.closest('.research-node[data-key]');
            if (!node) { tappedKey = null; this._clearResearchHighlight(); return; }
            const key = node.dataset.key;
            if (key === tappedKey) {
                // Second tap. If selectable, select it.
                const research = this.game.research;
                const tech = RESEARCH[key];
                const completed = research.completed.has(key);
                const prereqsMet = tech.requires.every(r => research.completed.has(r));
                const gatesMet = prereqsMet && research._checkGates(tech);
                const available = !completed && prereqsMet && gatesMet;
                const isActive = research.activeResearch === key;
                if (available && !isActive) this.game.selectResearch(key);
                else if (isActive) this.game.cancelResearch();
                tappedKey = null;
                this._clearResearchHighlight();
            } else {
                tappedKey = key;
                this._highlightResearchNode(key);
            }
        }, { passive: true });
    },

    _initResearchHover() {
        const tree = this.elements.researchPanel.querySelector('.research-tree');
        if (!tree) return;

        // Delegate tooltip to the existing #ui-tooltip via data-tip
        const uiTooltip = document.getElementById('ui-tooltip');
        if (uiTooltip) {
            tree.addEventListener('mouseover', (e) => {
                const node = e.target.closest('.research-node[data-tip]');
                if (!node) return;
                uiTooltip.textContent = node.dataset.tip;
                uiTooltip.style.opacity = '1';
                const rect = node.getBoundingClientRect();
                let left = rect.left + rect.width / 2 - uiTooltip.offsetWidth / 2;
                let top = rect.top - uiTooltip.offsetHeight - 8;
                if (top < 4) top = rect.bottom + 8;
                if (left < 4) left = 4;
                if (left + uiTooltip.offsetWidth > window.innerWidth - 4) {
                    left = window.innerWidth - uiTooltip.offsetWidth - 4;
                }
                uiTooltip.style.left = left + 'px';
                uiTooltip.style.top = top + 'px';
            });
            tree.addEventListener('mouseout', (e) => {
                const node = e.target.closest('.research-node[data-tip]');
                if (!node) return;
                const related = e.relatedTarget;
                if (related && related.closest && related.closest('.research-node[data-tip]')) return;
                uiTooltip.style.opacity = '0';
            });
        }

        let currentKey = null;
        tree.addEventListener('mouseover', (e) => {
            const node = e.target.closest('.research-node[data-key]');
            const key = node?.dataset.key || null;
            if (key !== currentKey) {
                currentKey = key;
                if (key) this._highlightResearchNode(key);
                else this._clearResearchHighlight();
            }
        });
        tree.addEventListener('mouseleave', () => {
            currentKey = null;
            this._clearResearchHighlight();
            if (uiTooltip) uiTooltip.style.opacity = '0';
        });
    },

    _getResearchFamily(key) {
        const activeTab = this._researchTab || 'foundations';
        const family = new Set([key]);
        const findAncestors = (k) => {
            const tech = RESEARCH[k];
            if (!tech) return;
            for (const req of tech.requires) {
                if (RESEARCH[req]?.tab !== activeTab) continue;
                family.add(req);
                findAncestors(req);
            }
        };
        findAncestors(key);
        const findDescendants = (k) => {
            for (const [childKey, childTech] of Object.entries(RESEARCH)) {
                if (childTech.tab !== activeTab) continue;
                if (childTech.requires.includes(k) && !family.has(childKey)) {
                    family.add(childKey);
                    findDescendants(childKey);
                }
            }
        };
        findDescendants(key);
        return family;
    },

    _highlightResearchNode(key) {
        const tree = this.elements.researchPanel.querySelector('.research-tree');
        if (!tree) return;
        const family = this._getResearchFamily(key);
        const nodes = tree.querySelectorAll('.research-node[data-key]');
        for (const node of nodes) {
            node.classList.toggle('dimmed', !family.has(node.dataset.key));
            node.classList.toggle('highlighted', node.dataset.key === key);
        }
        const svg = document.getElementById('research-lines');
        if (svg) {
            for (const path of svg.querySelectorAll('path')) {
                path.classList.add('dimmed');
            }
            this._highlightResearchPaths(tree, family);
        }
    },

    _highlightResearchPaths(tree, family) {
        const svg = document.getElementById('research-lines');
        if (!svg) return;
        const paths = svg.querySelectorAll('path');
        const nodes = tree.querySelectorAll('.research-node[data-key]');
        let idx = 0;
        for (const node of nodes) {
            const key = node.dataset.key;
            const requires = node.dataset.requires;
            if (!requires) continue;
            for (const req of requires.split(',')) {
                if (!req) { idx++; continue; }
                if (family.has(key) && family.has(req)) {
                    paths[idx]?.classList.remove('dimmed');
                    paths[idx]?.classList.add('highlighted');
                }
                idx++;
            }
        }
    },

    _clearResearchHighlight() {
        const tree = this.elements.researchPanel.querySelector('.research-tree');
        if (!tree) return;
        const nodes = tree.querySelectorAll('.research-node[data-key]');
        for (const node of nodes) {
            node.classList.remove('dimmed', 'highlighted');
        }
        const svg = document.getElementById('research-lines');
        if (svg) {
            for (const path of svg.querySelectorAll('path')) {
                path.classList.remove('dimmed', 'highlighted');
            }
        }
    },

    _getGateRequirements(tech, research) {
        const gates = [];
        const game = this.game;

        if (tech.requiresBuildings) {
            for (const [building, count] of Object.entries(tech.requiresBuildings)) {
                const found = game.mapIndex ? game.mapIndex.getStructurePositions(building).size : 0;
                const label = count > 1
                    ? `Build ${count}x ${building.replace(/_/g, ' ')}`
                    : `Build ${building.replace(/_/g, ' ')}`;
                gates.push({ label, met: found >= count, current: Math.min(found, count), required: count });
            }
        }

        if (tech.requiresMilestone) {
            const { stat, min } = tech.requiresMilestone;
            const current = game.stats?.[stat] || 0;
            const labels = {
                raidsDefeated: 'Survive a raid',
                wavesCompleted: 'Complete void waves',
                expeditionsCompleted: 'Complete an expedition',
                superiorItemsCrafted: 'Craft a Superior item',
                itemsEnchanted: `Enchant items`,
            };
            gates.push({ label: labels[stat] || stat, met: current >= min, current: Math.min(current, min), required: min });
        }

        if (tech.requiresTabCount) {
            let tabCompleted = 0;
            for (const [k, t] of Object.entries(RESEARCH)) {
                if (t.tab === tech.tab && research.completed.has(k)) tabCompleted++;
            }
            gates.push({
                label: `Techs in tab`,
                met: tabCompleted >= tech.requiresTabCount,
                current: Math.min(tabCompleted, tech.requiresTabCount),
                required: tech.requiresTabCount,
            });
        }

        return gates;
    },

    _buildResearchLayers(tabKeys) {
        const tabSet = new Set(tabKeys);
        const depths = {};
        function getDepth(key) {
            if (depths[key] !== undefined) return depths[key];
            const tech = RESEARCH[key];
            if (!tech) { depths[key] = 0; return 0; }
            const sameTabReqs = tech.requires.filter(r => tabSet.has(r));
            if (sameTabReqs.length === 0) {
                depths[key] = 0;
                return 0;
            }
            const d = 1 + Math.max(...sameTabReqs.map(r => getDepth(r)));
            depths[key] = d;
            return d;
        }
        for (const key of tabKeys) getDepth(key);
        const maxDepth = Math.max(...tabKeys.map(k => depths[k] || 0), 0);
        const layers = [];
        for (let i = 0; i <= maxDepth; i++) layers.push([]);
        for (const key of tabKeys) layers[depths[key] || 0].push(key);

        for (let i = 1; i < layers.length; i++) {
            const allPositions = {};
            for (let l = 0; l < i; l++) {
                for (let j = 0; j < layers[l].length; j++) {
                    allPositions[layers[l][j]] = layers[l].length > 1 ? j / (layers[l].length - 1) : 0.5;
                }
            }
            layers[i].sort((a, b) => {
                const aReqs = RESEARCH[a].requires.filter(r => allPositions[r] !== undefined);
                const bReqs = RESEARCH[b].requires.filter(r => allPositions[r] !== undefined);
                const aCenter = aReqs.length > 0 ? aReqs.reduce((s, r) => s + allPositions[r], 0) / aReqs.length : 0.5;
                const bCenter = bReqs.length > 0 ? bReqs.reduce((s, r) => s + allPositions[r], 0) / bReqs.length : 0.5;
                return aCenter - bCenter;
            });
        }

        return layers;
    },

    _drawResearchLines() {
        const tree = this.elements.researchPanel?.querySelector('.research-tree');
        const world = tree?.querySelector('.research-world');
        const svg = document.getElementById('research-lines');
        if (!svg || !world) return;
        svg.setAttribute('width', world.scrollWidth);
        svg.setAttribute('height', world.scrollHeight);
        const worldRect = world.getBoundingClientRect();
        // Get current scale from transform to correct for getBoundingClientRect scaling
        let scale = 1;
        try {
            const t = JSON.parse(world.dataset.transform || '{}');
            scale = t.scale || 1;
        } catch (_) {}
        let paths = '';
        const nodes = world.querySelectorAll('.research-node[data-key]');
        const nodeRects = {};
        for (const node of nodes) {
            const r = node.getBoundingClientRect();
            // Divide by scale to get positions in world (unscaled) space
            nodeRects[node.dataset.key] = {
                cx: (r.left + r.width / 2 - worldRect.left) / scale,
                top: (r.top - worldRect.top) / scale,
                bottom: (r.bottom - worldRect.top) / scale,
            };
        }
        for (const node of nodes) {
            const key = node.dataset.key;
            const requires = node.dataset.requires;
            if (!requires) continue;
            const nodeCompleted = node.classList.contains('completed');
            for (const req of requires.split(',')) {
                if (!req || !nodeRects[req] || !nodeRects[key]) continue;
                const reqNode = world.querySelector(`.research-node[data-key="${req}"]`);
                const reqCompleted = reqNode?.classList.contains('completed');
                const color = (reqCompleted && nodeCompleted) ? '#66cc66' : reqCompleted ? '#886622' : '#444';
                const from = nodeRects[req];
                const to = nodeRects[key];
                const x1 = from.cx, y1 = from.bottom;
                const x2 = to.cx, y2 = to.top;
                const my = (y1 + y2) / 2;
                paths += `<path d="M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}" stroke="${color}" />`;
            }
        }
        svg.innerHTML = paths;
    },
};
