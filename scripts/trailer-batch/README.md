# Trailer batch recording

Shoots the trailer scenes (`js/dev/trailer/scenes.js`) unattended and saves every take as an MP4. It's the same as loading each scene in the trailer director and pressing Alt+P, then Alt+K, but nobody has to sit and watch.

- The game runs in an **invisible, muted window**, so you can keep working while it records.
- **Clips still have sound.** The recorder taps the game's sound effects directly, so nothing comes out of your speakers.
- **Everything the game draws is recorded:** the world, the effects layer (particles, weather, impacts, floating text, flashes), the expedition view and the title card. Menus, panels and the cursor are not.
- **Clips go to `~/Movies/Rifthold Trailer`**, named `NN_<scene>_takeN.mp4`. Existing clips are never overwritten. With ffmpeg installed (`brew install ffmpeg`), clips are re-encoded to a constant 60 fps.

## Running it

From the repo root:

```sh
npm run trailer:batch                                # every scene, in order
npm run trailer:batch -- --scenes=5                  # reshoot scene 5 only
npm run trailer:batch -- --scenes=5-9                # scenes 5 through 9
npm run trailer:batch -- --scenes=1,3,5-7            # any mix
npm run trailer:batch -- --new-colony                # fresh map, then every scene
npm run trailer:batch -- --scenes=4 --no-keep        # don't overwrite later scenes' starts
npm run trailer:batch -- --show                      # visible window with sound, to watch a run
```

Note the `--` before the options: npm needs it to pass them through.

A full run takes about 7 minutes. Progress prints as it goes, and a summary at the end lists each scene's clip and its beats (timestamps in the clip, handy for syncing music). The exit code is 0 only if every requested scene saved a clip.

## Options

| Option | What it does |
|---|---|
| `--scenes=<list>` | Scenes to shoot, numbered 1–9 like the Alt+1..9 hotkeys (the order in `scenes.js`). Ranges and commas are both fine. Default: all. |
| `--new-colony` | Generate a new map before shooting. Without it, scenes start from the batch profile's saved states. A new colony is also generated when the first requested scene has no saved start yet, for example on the first run. |
| `--no-keep` | Don't save each take as the start of the next scene. Use it to reshoot a scene without changing the later scenes' starting state. |
| `--show` | Show the window and play sound. For checking a run by eye. |
| `--profile=<dir>` | Use a different batch profile (see below). |

## How scenes chain together

Each scene starts from the state the previous take left behind, so the village, colonists and gear carry through the trailer. After every take the script keeps it, which saves the end state as the next scene's start, the same as Alt+K.

That means:

- **Reshooting one scene** (`--scenes=5`) starts from the state the last run left for scene 5. The new take then becomes scene 6's start. Add `--no-keep` if you don't want that.
- **Reshooting from a scene onward** (`--scenes=5-9`) carries the new take through everything after it.
- **A different map** needs `--new-colony`. The director picks the world size and season from its settings.

## The batch profile

Batch runs use their own Electron profile at `~/Library/Application Support/rifthold-trailer-batch`. It holds the saved scene starts, director settings and take counters. It is completely separate from the game you play and shoot by hand, so a batch run never touches your trailer colony, saves, settings or Google Drive sign-in.

Want to run the batch on the colony you've been shooting by hand? Export the snapshots from the director panel in the game, then run once with `--show`, import them in the panel, and close the window. After that, batch runs start from your colony. Alternatively, keep several colonies side by side with `--profile=<dir>`.

To change director settings for batch runs (clip resolution, bitrate, countdown, choice hold time and so on), run with `--show`, open the director panel's settings, change them, and close the window. They're saved in the batch profile.

## Troubleshooting

- **`SteamAPI_Init() failed` at startup** is harmless. It just means Steam isn't running.
- **A scene saved no clip or reported an error:** rerun just that scene with `--show` to watch what happens. Scene setup problems (for example "This map has no crystal crypt") are printed in the log as they happen.
- **The run stops partway:** a scene that fails to load ends the run, because every later scene depends on it. The summary shows which one failed.
- **Clips are `.webm` instead of `.mp4`:** this Electron build couldn't record H.264. The footage is the same, only the container differs.

## Files

- `launch.js` is the Electron entry point. It sets up the hidden window and profile, loads the game through `electron-main.js`, and injects `drive.js`.
- `drive.js` runs inside the game page and drives the trailer director (`js/dev/trailer/director.js`): new colony, load scene, play, keep.
