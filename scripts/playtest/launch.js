// Dev-only: plays the game unattended with a scripted bot and records pacing data.
//
// Runs the game in an invisible, muted Electron window with its own profile,
// starts a new colony and hands control to bot.js, which steps the simulation
// as fast as it can and plays by a per-profile strategy (strategies.js). Every
// run writes metrics, the event log, screenshots and a summary to
// scripts/playtest/out/<stamp>-<profile>/.
//
//   npm run playtest -- [--profile=competent] [--days=120] [--world=medium] [--shots-every=5] [--show]
//
// See README.md in this folder for details.

const { app, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_DIR = path.resolve(__dirname, '..', '..');

function parseArgs(argv) {
  const opts = { profile: 'competent', days: 120, world: null, shotsEvery: 5, show: false, userData: null, out: null, label: null };
  for (const arg of argv) {
    const [k, v] = arg.replace(/^--/, '').split('=');
    if (k === 'profile') opts.profile = v;
    else if (k === 'days') opts.days = parseFloat(v);
    else if (k === 'world') opts.world = v;
    else if (k === 'shots-every') opts.shotsEvery = parseFloat(v);
    else if (k === 'show') opts.show = true;
    else if (k === 'user-data') opts.userData = v;
    else if (k === 'out') opts.out = v;
    else if (k === 'label') opts.label = v;
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const outDir = path.resolve(opts.out || path.join(__dirname, 'out', `${stamp}-${opts.label || opts.profile}`));
fs.mkdirSync(path.join(outDir, 'shots'), { recursive: true });

// A profile of its own, so playtest runs never touch real saves or settings.
const profileDir = path.resolve(opts.userData || path.join(app.getPath('appData'), 'rifthold-playtest'));
app.setPath('userData', profileDir);
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
log(`profile=${opts.profile} days=${opts.days} out=${outDir}`);

const streams = {
  metrics: fs.createWriteStream(path.join(outDir, 'metrics.jsonl')),
  events: fs.createWriteStream(path.join(outDir, 'events.jsonl')),
};

app.on('browser-window-created', (_, win) => {
  const wc = win.webContents;
  if (!opts.show) {
    // Invisible and click-through, but still "shown" so it keeps painting.
    win.setOpacity(0);
    win.setIgnoreMouseEvents(true);
    win.setFocusable(false);
    win.show = () => win.showInactive();
    wc.setAudioMuted(true);
  }
  wc.setBackgroundThrottling(false);
  wc.on('console-message', (e) => {
    const msg = e.message || '';
    if (/\[playtest\]/.test(msg) || e.level === 'error' || /Error/.test(msg)) log(msg);
  });
  wc.on('render-process-gone', (_, d) => { log('Game window crashed:', d.reason); finish(2); });

  let started = false;
  wc.on('did-finish-load', async () => {
    if (started) return;
    started = true;
    const d = screen.getPrimaryDisplay();
    win.setBounds({ x: 0, y: 0, width: Math.min(1600, d.workAreaSize.width), height: Math.min(900, d.workAreaSize.height) });
    const botOpts = { profile: opts.profile, days: opts.days, world: opts.world, shotsEvery: opts.shotsEvery };
    // The bot runs inside the page as an ES module so it shares the game's module instances.
    wc.executeJavaScript(`window.__playtestOpts = ${JSON.stringify(botOpts)};
      import('./scripts/playtest/bot.js').then(m => m.run(window.__playtestOpts))
        .catch(e => { console.error('[playtest] bot crashed: ' + (e && e.stack || e)); window.__pt = { poll: () => ({ done: true, error: String(e && e.stack || e) }) }; });`, true);
    poll(wc);
  });
});

let finished = false;
function finish(code) {
  if (finished) return;
  finished = true;
  for (const s of Object.values(streams)) s.end();
  setTimeout(() => app.exit(code), 500);
}

async function poll(wc) {
  while (!finished) {
    await new Promise(r => setTimeout(r, 200));
    let r;
    try {
      r = await wc.executeJavaScript('window.__pt ? window.__pt.poll() : null', true);
    } catch (e) {
      log('poll failed:', e.message);
      continue;
    }
    if (!r) continue;
    for (const line of r.metrics || []) streams.metrics.write(JSON.stringify(line) + '\n');
    for (const line of r.events || []) streams.events.write(JSON.stringify(line) + '\n');
    for (const msg of r.logs || []) log('[playtest]', msg);
    if (r.shot) {
      try {
        const img = await wc.capturePage();
        const file = path.join(outDir, 'shots', `${r.shot}.png`);
        fs.writeFileSync(file, img.toPNG());
      } catch (e) {
        log('screenshot failed:', e.message);
      }
      await wc.executeJavaScript('window.__pt.shotAck()', true);
    }
    if (r.done) {
      if (r.summary) fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(r.summary, null, 2));
      if (r.error) log('Run failed:', r.error);
      else log(`Run finished: day ${r.summary?.final?.day}, ${r.summary?.wallSeconds}s wall. Output in ${outDir}`);
      finish(r.error ? 1 : 0);
    }
  }
}

app.whenReady().then(() => { if (!opts.show && app.dock) app.dock.hide(); });
require(path.join(APP_DIR, 'electron-main.js'));
