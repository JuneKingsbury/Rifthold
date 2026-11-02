// End-of-trailer title card: fade to black, then the Rifthold emblem, title and
// a "Wishlist on Steam" call to action. Built from the game's own assets
// (Pixelify Sans, the rift emblem, the splash background tile) so it matches
// the start screen. Sits above everything, including the recording-mode
// arcane float (z-index 9999).

const CARD_ID = 'trailer-title-card';

export function showTitleCard({ fadeSeconds = 1.2, holdBlackSeconds = 0.6, sting = true } = {}) {
    hideTitleCard();
    const card = document.createElement('div');
    card.id = CARD_ID;
    card.innerHTML = `
        <div class="ttc-bg"></div>
        <div class="ttc-vignette"></div>
        <div class="ttc-content">
            <img class="ttc-emblem" src="icons/RiftholdIcon2.png" alt="">
            <h1 class="ttc-title">Rifthold</h1>
            <h2 class="ttc-subtitle">Arcane Frontiers</h2>
            <div class="ttc-cta">Wishlist on Steam</div>
        </div>`;
    card.style.setProperty('--ttc-fade', `${fadeSeconds}s`);
    document.body.appendChild(card);

    // Two frames so the initial opacity:0 is committed before the transition.
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('ttc-black')));
    const revealAt = (fadeSeconds + holdBlackSeconds) * 1000;
    const t1 = setTimeout(() => {
        card.classList.add('ttc-reveal');
        if (sting) window.soundManager?.playSFXPitched?.('summon_arrival', -4);
    }, revealAt);
    const t2 = setTimeout(() => card.classList.add('ttc-cta-in'), revealAt + 1400);
    card._timers = [t1, t2];
    return new Promise(resolve => setTimeout(resolve, revealAt + 2600));
}

export function hideTitleCard() {
    const el = document.getElementById(CARD_ID);
    if (!el) return;
    for (const t of el._timers || []) clearTimeout(t);
    el.remove();
}

export function isTitleCardShowing() { return !!document.getElementById(CARD_ID); }
