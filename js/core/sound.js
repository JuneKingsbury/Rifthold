import { SOUND_MANIFEST } from './sound-manifest.js';

const CROSSFADE_MS = 2000;
const SFX_COOLDOWN_MS = 200;
const MAX_CONCURRENT_SFX = 8;

class SoundManagerClass {
    constructor() {
        this.ctx = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.expeditionSfxGain = null;
        this.musicVolume = 70;
        this.sfxVolume = 80;
        this.expeditionMode = false;
        this.bufferCache = new Map();
        this.unavailable = new Set();
        this.lastPlayTime = new Map();
        this.activeSfxCount = 0;
        this.currentMusic = null;
        this.currentMusicName = null;
        this.currentMusicGain = null;
    }

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.musicGain = this.ctx.createGain();
            this.sfxGain = this.ctx.createGain();
            this.expeditionSfxGain = this.ctx.createGain();
            this.musicGain.connect(this.ctx.destination);
            this.sfxGain.connect(this.ctx.destination);
            this.expeditionSfxGain.connect(this.ctx.destination);
            this.musicGain.gain.value = this.musicVolume / 100;
            this.sfxGain.gain.value = this.sfxVolume / 100;
            this.expeditionSfxGain.gain.value = this.sfxVolume / 100;
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        } catch (e) { /* silent */ }
    }

    setMusicVolume(val) {
        this.musicVolume = val;
        if (this.currentMusicGain) {
            this.currentMusicGain.gain.value = val / 100;
        }
    }

    setSFXVolume(val) {
        this.sfxVolume = val;
        if (this.sfxGain) {
            this.sfxGain.gain.value = this.expeditionMode ? (val / 100) * 0.1 : val / 100;
        }
        if (this.expeditionSfxGain) {
            this.expeditionSfxGain.gain.value = val / 100;
        }
    }

    setExpeditionMode(active) {
        this.expeditionMode = active;
        if (this.sfxGain) {
            this.sfxGain.gain.value = active ? (this.sfxVolume / 100) * 0.1 : this.sfxVolume / 100;
        }
    }

    async playSFX(name) {
        try {
            if (!this.ctx || this.unavailable.has(name)) return;
            if (this.activeSfxCount >= MAX_CONCURRENT_SFX) return;

            const now = performance.now();
            const last = this.lastPlayTime.get(name) || 0;
            if (now - last < SFX_COOLDOWN_MS) return;
            this.lastPlayTime.set(name, now);

            if (this.ctx.state === 'suspended') await this.ctx.resume();

            const buffer = await this._getBuffer(name, 'sfx');
            if (!buffer) return;

            const source = this.ctx.createBufferSource();
            source.buffer = buffer;

            // Random offset between -300 and +300 cents (+/- 3 semitones)
            source.detune.value = (Math.random() * 2 - 1) * 300;

            source.connect(this.sfxGain);

            this.activeSfxCount++;
            source.onended = () => { this.activeSfxCount--; };
            source.start(0);
        } catch (e) { /* silent */ }
    }

    // Play a sound at a fixed pitch offset (semitones), bypassing random variance.
    // Pass 0 for the default pitch, positive values for higher, negative for lower.
    // Pass gainNode = this.expeditionSfxGain to bypass the expedition volume dampening.
    async playSFXPitched(name, semitones = 0, gainNode = null) {
        try {
            if (!this.ctx || this.unavailable.has(name)) return;
            if (this.activeSfxCount >= MAX_CONCURRENT_SFX) return;

            const now = performance.now();
            const last = this.lastPlayTime.get(name) || 0;
            if (now - last < SFX_COOLDOWN_MS) return;
            this.lastPlayTime.set(name, now);

            if (this.ctx.state === 'suspended') await this.ctx.resume();

            const buffer = await this._getBuffer(name, 'sfx');
            if (!buffer) return;

            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            const jitter = (Math.random() * 2 - 1) * 100; // ±1 semitone
            source.detune.value = semitones * 100 + jitter;

            source.connect(gainNode || this.sfxGain);

            this.activeSfxCount++;
            source.onended = () => { this.activeSfxCount--; };
            source.start(0);
        } catch (e) { /* silent */ }
    }

    async playExpSFX(name) {
        try {
            if (!this.ctx || this.unavailable.has(name)) return;
            if (this.activeSfxCount >= MAX_CONCURRENT_SFX) return;

            const now = performance.now();
            const last = this.lastPlayTime.get(name) || 0;
            if (now - last < SFX_COOLDOWN_MS) return;
            this.lastPlayTime.set(name, now);

            if (this.ctx.state === 'suspended') await this.ctx.resume();

            const buffer = await this._getBuffer(name, 'sfx');
            if (!buffer) return;

            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            const randomCents = (Math.random() * 2 - 1) * 300;
            source.detune.value = randomCents;
            source.connect(this.expeditionSfxGain);

            this.activeSfxCount++;
            source.onended = () => { this.activeSfxCount--; };
            source.start(0);
        } catch (e) { /* silent */ }
    }

    async playMusic(name) {
        try {
            if (!this.ctx) return;
            if (this.currentMusicName === name) return;
            if (this.unavailable.has('music_' + name)) return;

            if (this.ctx.state === 'suspended') await this.ctx.resume();

            const buffer = await this._getBuffer(name, 'music');
            if (!buffer) return;

            const fadeTime = CROSSFADE_MS / 1000;
            const now = this.ctx.currentTime;

            if (this.currentMusic && this.currentMusicGain) {
                const oldGain = this.currentMusicGain;
                const oldSource = this.currentMusic;
                oldGain.gain.setValueAtTime(oldGain.gain.value, now);
                oldGain.gain.linearRampToValueAtTime(0, now + fadeTime);
                setTimeout(() => {
                    try { oldSource.stop(); } catch (e) { /* silent */ }
                }, CROSSFADE_MS);
            }

            const trackGain = this.ctx.createGain();
            trackGain.connect(this.musicGain);
            trackGain.gain.setValueAtTime(0, now);
            trackGain.gain.linearRampToValueAtTime(this.musicVolume / 100, now + fadeTime);

            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.connect(trackGain);
            source.start(0);

            this.currentMusic = source;
            this.currentMusicGain = trackGain;
            this.currentMusicName = name;
        } catch (e) { /* silent */ }
    }

    stopMusic(fadeMs = 1000) {
        try {
            if (!this.ctx || !this.currentMusic || !this.currentMusicGain) return;
            const now = this.ctx.currentTime;
            const fadeTime = fadeMs / 1000;
            this.currentMusicGain.gain.setValueAtTime(this.currentMusicGain.gain.value, now);
            this.currentMusicGain.gain.linearRampToValueAtTime(0, now + fadeTime);
            const oldSource = this.currentMusic;
            setTimeout(() => {
                try { oldSource.stop(); } catch (e) { /* silent */ }
            }, fadeMs);
            this.currentMusic = null;
            this.currentMusicGain = null;
            this.currentMusicName = null;
        } catch (e) { /* silent */ }
    }

    updateMusicState(game) {
        try {
            if (!this.ctx) return;
            let desired = null;

            const hasEnemies = (game.waves && game.waves.active && game.waves.enemies && game.waves.enemies.length > 0)
                || (game.raiders && game.raiders.length > 0);

            if (hasEnemies) {
                desired = 'combat';
            } else {
                const dayProgress = game.timeOfDay / 300;
                if (dayProgress >= 0.7 || dayProgress < 0.2) {
                    desired = 'ambient_night';
                } else {
                    desired = 'ambient_day';
                }
            }

            if (desired && desired !== this.currentMusicName) {
                this.playMusic(desired);
            }
        } catch (e) { /* silent */ }
    }

    async _getBuffer(name, type) {
        const cacheKey = type + '_' + name;
        if (this.bufferCache.has(cacheKey)) return this.bufferCache.get(cacheKey);

        const manifest = type === 'music' ? SOUND_MANIFEST.music : SOUND_MANIFEST.sfx;
        const path = manifest[name];
        if (!path) {
            this.unavailable.add(cacheKey);
            return null;
        }

        try {
            const response = await fetch(path);
            if (!response.ok) {
                this.unavailable.add(cacheKey);
                return null;
            }
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.bufferCache.set(cacheKey, audioBuffer);
            return audioBuffer;
        } catch (e) {
            this.unavailable.add(cacheKey);
            return null;
        }
    }
}

export const SoundManager = new SoundManagerClass();
