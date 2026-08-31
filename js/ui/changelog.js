import { GAME_VERSION } from '../core/config/game.js';

export const CHANGELOG = [
    { date: '2026-08-21', message: 'Initial changelog for v0.2.' },
];

export function renderChangelogHTML() {
    let html = '<div style="margin-bottom:12px;"><input type="text" id="changelog-search" placeholder="Search changelog..." style="width:100%;padding:6px 8px;background:#2a2a3e;border:1px solid #555;border-radius:4px;color:#ccc;font-family:inherit;font-size:12px;"></div>';
    html += '<div id="changelog-list">';
    html += _buildChangelogList(CHANGELOG);
    html += '</div>';
    return html;
}

function _buildChangelogList(entries) {
    let html = '';
    let lastDate = '';
    for (const entry of entries) {
        if (entry.date !== lastDate) {
            lastDate = entry.date;
            html += `<div style="color:#aaccff;font-weight:bold;margin-top:10px;margin-bottom:4px;font-size:11px;">${entry.date}</div>`;
        }
        html += `<div style="padding:2px 0 2px 12px;color:#ccc;font-size:12px;border-left:2px solid #444;margin-left:4px;">• ${entry.message}</div>`;
    }
    return html;
}

export function initChangelogInteraction() {
    const search = document.getElementById('changelog-search');
    const list = document.getElementById('changelog-list');
    if (!search || !list) return;
    search.addEventListener('input', () => {
        const q = search.value.toLowerCase().trim();
        if (!q) {
            list.innerHTML = _buildChangelogList(CHANGELOG);
            return;
        }
        const filtered = CHANGELOG.filter(e => e.message.toLowerCase().includes(q) || e.date.includes(q));
        list.innerHTML = filtered.length ? _buildChangelogList(filtered) : '<div style="color:#666;padding:8px;">No matching entries.</div>';
    });
}

export function renderCreditsHTML() {
    return `
<div style="text-align:center; padding:20px 0;">
    <div style="color:#ffcc00; font-size:16px; font-weight:bold; margin-bottom:16px;">Rifthold</div>
    <div style="color:#aaa; margin-bottom:20px;">A magical colony sim and a chance for me to turn game making into a hobby again.</div>
    <div style="color:#ccc; margin-bottom:8px;"><b>Design & Development</b></div>
    <div style="color:#aaa; margin-bottom:20px;">June "Mars" Kingsbury</div>
    <div style="color:#ccc; margin-bottom:8px;"><b>Additional Sprites</b></div>
    <div style="color:#aaa; margin-bottom:4px;"><a style="color:#aaa;" href="https://merchant-shade.itch.io/16x16-mini-world-sprites">Mini World</a> by Shade</div>
    <div style="color:#aaa; margin-bottom:4px;"><a style="color:#aaa;" href="https://merchant-shade.itch.io/16x16-puny-world">Puny World</a> by Shade</div>
    <div style="color:#aaa; margin-bottom:4px;"><a style="color:#aaa;" href="https://merchant-shade.itch.io/16x16-puny-dungeon">Puny Dungeon</a> by Shade</div>
    <div style="color:#aaa; margin-bottom:4px;"><a style="color:#aaa;" href="https://glionox.itch.io/items16">16x16 Items</a> by Glionox</div>
    <div style="color:#aaa; margin-bottom:4px;"><a style="color:#aaa;" href="https://bdragon1727.itch.io/free-effect-and-bullet-16x16">Free Effect and Bullet 16x16</a> by BDragon1727</div>
    <div style="color:#aaa; margin-bottom:20px;"><a style="color:#aaa;" href="https://bdragon1727.itch.io/free-smoke-fx-pixel-2">Free Smoke Fx Pixel 2</a> by BDragon1727</div>
    <div style="color:#ccc; margin-bottom:8px;"><b>Music & SFX</b></div>
    <div style="color:#aaa; margin-bottom:4px;"><a style="color:#aaa;" href="https://rapidpunches.itch.io/game-of-the-unknown">GAME OF THE UNKNOWN</a> by RAPIDPUNCHES</div>
    <div style="color:#aaa; margin-bottom:4px;"><a style="color:#aaa;" href="https://www.bfxr.net/">bfxr (custom SFX maker)</a> by increpare</div>
    <div style="color:#aaa; margin-bottom:24px;"><a style="color:#aaa;" href="https://dagurasusk.itch.io/retrosounds">Retro Sounds</a> by DASK</div>
    <div style="color:#aaa; font-size:10px;"><i>Thank you for playing my game!</i> -Mars</div>
    <img style="float:none" class="pixel-art" src="portraits/mars.png" alt="A drawing of game dev Mars">
    <div style="margin-top:16px; border-top:1px solid #333; padding-top:12px;">
        <div style="color:#666; font-size:10px; margin-bottom:8px;">Version ${GAME_VERSION}</div>
        <button id="credits-changelog-btn" style="background:#2a2a4e; border:1px solid #555; border-radius:4px; color:#aaccff; padding:6px 16px; cursor:pointer; font-family:inherit; font-size:11px;">View Changelog</button>
    </div>
</div>`;
}
