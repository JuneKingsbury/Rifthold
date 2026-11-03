// Dev-only: shoots trailer scenes unattended and saves every take as a clip.
//
// Runs the game in an invisible, muted Electron window with its own profile,
// loads the trailer director, and plays the requested scenes in order,
// keeping each take so the next scene starts from it (the same as pressing
// Alt+P then Alt+K by hand). Clips land in ~/Movies/Rifthold Trailer. The
// recorder taps the game's audio directly, so clips have sound even though
// nothing plays through the speakers.
//
//   npm run trailer:batch -- [--scenes=1-10] [--new-colony] [--no-keep] [--show] [--profile=<dir>]
//
// See README.md in this folder for details.

const { app, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_DIR = path.resolve(__dirname, '..', '..');

function parseArgs(argv) {
  const opts = { scenes: null, newColony: false, keep: true, show: false, profile: null };
  for (const arg of argv) {
    const [k, v] = arg.replace(/^--/, '').split('=');
    if (k === 'scenes') opts.scenes = v;
    else if (k === 'new-colony') opts.newColony = true;
    else if (k === 'no-keep') opts.keep = false;
    else if (k === 'show') opts.show = true;
    else if (k === 'profile') opts.profile = v;
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
// A profile of its own, so batch runs never touch the snapshots, settings or
// cloud tokens of the colony you play and shoot by hand. It persists between
// runs, so a later run can reshoot one scene from the state an earlier run kept.
const profile = path.resolve(opts.profile || path.join(app.getPath('appData'), 'rifthold-trailer-batch'));
app.setPath('userData', profile);
// Hidden windows still have to render every frame for the recorder.
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
log(`profile: ${profile}`);

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
    if (/\[trailer\]|\[batch\]|Error/.test(msg)) log(msg);
  });
  wc.on('render-process-gone', (_, d) => { log('Game window crashed:', d.reason); app.exit(2); });

  let started = false;
  wc.on('did-finish-load', async () => {
    if (started) return;
    started = true;
    const d = screen.getPrimaryDisplay();
    win.setBounds({ x: 0, y: 0, width: Math.min(1920, d.workAreaSize.width), height: Math.min(1080, d.workAreaSize.height) });
    // The page's beforeunload handler blocks reloads, so load the director in place.
    await wc.executeJavaScript(`(async () => {
      for (let i = 0; i < 100 && !window.toggleTrailerDirector; i++) await new Promise(r => setTimeout(r, 100));
      if (!window.trailerDirector) await window.toggleTrailerDirector();
    })()`, true);
    const drive = fs.readFileSync(path.join(__dirname, 'drive.js'), 'utf8');
    let code = 0;
    try {
      const results = await wc.executeJavaScript(`window.__batchOpts = ${JSON.stringify(opts)};\n${drive}`, true);
      code = report(results);
    } catch (e) {
      log('Batch failed:', e.message);
      code = 1;
    }
    setTimeout(() => app.exit(code), 1000);
  });
});

function report(results) {
  if (results?.error) { log('Batch failed:', results.error); return 1; }
  console.log('\nScene               Clip                               Beats');
  for (const r of results) {
    const beats = r.error ? `ERROR: ${r.error}` : r.beats.join(', ');
    console.log(`${r.scene.padEnd(19)} ${(r.clip || '(no clip)').padEnd(34)} ${beats}`);
  }
  const failed = results.filter(r => r.error || !r.clip).length;
  console.log(`\n${results.length - failed}/${results.length} clips saved to ~/Movies/Rifthold Trailer`);
  return failed ? 1 : 0;
}

app.whenReady().then(() => { if (!opts.show && app.dock) app.dock.hide(); });
require(path.join(APP_DIR, 'electron-main.js'));
