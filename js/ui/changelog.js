import { GAME_VERSION } from '../core/config/game.js';
import { t } from '../core/i18n.js';
import { escapeAttr, escapeHtml } from './ui-utils.js';

export const CHANGELOG = [
    { date: '2026-08-21', key: 'changelog.20260821.0' },
];

// Message keys are changelog.<yyyymmdd>.<n>, n counting the entries of that date.
function _message(entry) {
    return t(entry.key);
}

export function renderChangelogHTML() {
    let html = '<div style="margin-bottom:12px;"><input type="text" id="changelog-search" placeholder="' + escapeAttr(t('changelog.ui.search_placeholder')) + '" style="width:100%;padding:6px 8px;background:#2a2a3e;border:1px solid #555;border-radius:4px;color:#ccc;font-family:inherit;font-size:12px;"></div>';
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
        html += `<div style="padding:2px 0 2px 12px;color:#ccc;font-size:12px;border-left:2px solid #444;margin-left:4px;">• ${escapeHtml(_message(entry))}</div>`;
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
        const filtered = CHANGELOG.filter(e => _message(e).toLowerCase().includes(q) || e.date.includes(q));
        list.innerHTML = filtered.length ? _buildChangelogList(filtered) : `<div style="color:#666;padding:8px;">${escapeHtml(t('changelog.ui.no_matches'))}</div>`;
    });
}

// "{work} by {author}" with the work as a link. The template is split at {work}
// so the link markup stays in code and the rest is escaped.
function _creditLine(href, work, author) {
    const link = `<a style="color:#aaa;" href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(work)}</a>`;
    return t('changelog.credits.by', { author }).split('{work}').map(escapeHtml).join(link);
}

export function renderCreditsHTML() {
    return `
<div style="text-align:center; padding:20px 0;">
    <div style="color:#ffcc00; font-size:16px; font-weight:bold; margin-bottom:16px;">Rifthold</div>
    <div style="color:#aaa; margin-bottom:20px;">${escapeHtml(t('changelog.credits.tagline'))}</div>
    <div style="color:#ccc; margin-bottom:8px;"><b>${escapeHtml(t('changelog.credits.design_development'))}</b></div>
    <div style="color:#aaa; margin-bottom:20px;">Juniper Kingsbury</div>
    <div style="color:#ccc; margin-bottom:8px;"><b>${escapeHtml(t('changelog.credits.additional_sprites'))}</b></div>
    <div style="color:#aaa; margin-bottom:4px;">${_creditLine('https://merchant-shade.itch.io/16x16-mini-world-sprites', 'Mini World', 'Shade')}</div>
    <div style="color:#aaa; margin-bottom:4px;">${_creditLine('https://merchant-shade.itch.io/16x16-puny-world', 'Puny World', 'Shade')}</div>
    <div style="color:#aaa; margin-bottom:4px;">${_creditLine('https://merchant-shade.itch.io/16x16-puny-dungeon', 'Puny Dungeon', 'Shade')}</div>
    <div style="color:#aaa; margin-bottom:4px;">${_creditLine('https://glionox.itch.io/items16', '16x16 Items', 'Glionox')}</div>
    <div style="color:#aaa; margin-bottom:4px;">${_creditLine('https://bdragon1727.itch.io/free-effect-and-bullet-16x16', 'Free Effect and Bullet 16x16', 'BDragon1727')}</div>
    <div style="color:#aaa; margin-bottom:20px;">${_creditLine('https://bdragon1727.itch.io/free-smoke-fx-pixel-2', 'Free Smoke Fx Pixel 2', 'BDragon1727')}</div>
    <div style="color:#ccc; margin-bottom:8px;"><b>${escapeHtml(t('changelog.credits.music_sfx'))}</b></div>
    <div style="color:#aaa; margin-bottom:4px;">${_creditLine('https://flowerheadmusic.itch.io/somewhat-good-lofi', 'Somewhat Good Lofi', 'Flowerhead')}</div>
    <div style="color:#aaa; margin-bottom:4px;">${_creditLine('https://not-jam.itch.io/not-jam-music-pack', 'NOT JAM MUSIC PACK', 'NOT JAM')}</div>
    <div style="color:#aaa; margin-bottom:4px;">${_creditLine('https://www.bfxr.net/', 'bfxr (custom SFX maker)', 'increpare')}</div>
    <div style="color:#aaa; margin-bottom:24px;">${_creditLine('https://dagurasusk.itch.io/retrosounds', 'Retro Sounds', 'DASK')}</div>
    <div style="color:#aaa; font-size:10px;"><i>${escapeHtml(t('changelog.credits.thanks'))}</i> -Juniper</div>
    <img style="float:none" class="pixel-art" src="portraits/juniper_heart.png" alt="${escapeAttr(t('changelog.credits.portrait_alt'))}">
    <div style="margin-top:16px; border-top:1px solid #333; padding-top:12px;">
        <div style="color:#666; font-size:10px; margin-bottom:8px;">${escapeHtml(t('changelog.credits.version', { version: GAME_VERSION }))}</div>
        <button id="credits-changelog-btn" style="background:#2a2a4e; border:1px solid #555; border-radius:4px; color:#aaccff; padding:6px 16px; cursor:pointer; font-family:inherit; font-size:11px;">${escapeHtml(t('changelog.credits.view_changelog'))}</button>
    </div>
</div>`;
}
