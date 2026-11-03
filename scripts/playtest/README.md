# Automated playtest

Plays a new colony unattended with a scripted bot and records how the game paces out: when milestones land, where colonist time goes, what stalls, what pauses the game, and screenshots of the moments worth looking at. Use it to check a balance change against the previous numbers.

- The game runs in an **invisible, muted window** with its own profile, so it never touches your saves or settings.
- The bot steps the simulation as fast as it can. A 150-day run (about 4 hours of play at 1x) takes a few minutes.
- **Output goes to `scripts/playtest/out/<stamp>-<label>/`** (git-ignored): `metrics.jsonl`, `events.jsonl`, `summary.json` and `shots/*.png`.

## Running it

From the repo root:

```sh
npm run playtest                                         # competent player, 120 days
npm run playtest -- --profile=new --days=60              # first-time player following the tutorial
npm run playtest -- --profile=peaceful --days=150
npm run playtest -- --profile=large --show               # watch it play
node scripts/playtest/summarize.js                       # summarize every run in out/
```

Note the `--` before the options: npm needs it to pass them through.

## Options

| Option | What it does |
|---|---|
| `--profile=<name>` | `competent` (default), `new`, `peaceful` or `large`. See below. |
| `--days=<n>` | Game days to play (480 ticks each). Default 120. The run also ends 2 days after every colonist dies. |
| `--world=<size>` | `small`, `medium` or `large`. Overrides the profile's world. |
| `--shots-every=<n>` | Days between periodic screenshots. Default 5. Event screenshots (first raid, first death, each tutorial step, each new kind of prompt, each stall) are taken regardless, up to 90 a run. |
| `--label=<text>` | Name for the output folder. Defaults to the profile. |
| `--user-data=<dir>` | Electron profile dir. Give each run its own when running several at once. |
| `--show` | Show the window and play sound. |

## Profiles

| Profile | World | Plays like |
|---|---|---|
| `competent` | medium | Knows the game. Sizes farms to the colony, keeps auto-cook on, makes the best student the researcher, follows a research route to expeditions, opens crypts, runs waves and pushes realm chains. Auto-pause is off. |
| `peaceful` | medium | `competent` in peaceful mode. |
| `large` | large | `competent` on a 384 map, for pathing and performance. |
| `new` | large (the start screen's default) | Plays the full tutorial at the "never played a colony sim" level, one step at a time with a 30-90 second reading delay, and leaves auto-pause on. Afterwards it plays a weaker `competent`: research in panel order, one field until food runs short, slow to take risks. |

The bot plays worse than a person in places (combat micro, room layout, trading). Treat a wall that only the bot hits as a lead to check, not a verdict.

## What gets recorded

- **`metrics.jsonl`**, every quarter day: colonists and cap, mood, hunger, rest, food on hand in days, stockpile, research progress and RP, raids and waves, expeditions, idle share, colonist state shares, time per task type (`walk:mine`, `work:research`, ...), and sim and render cost.
- **`events.jsonl`**: the full in-game event log plus bot actions, milestones, auto-pauses with their cause, deaths, mental breaks, tutorial steps and stalls.
- **`summary.json`**: milestone days, the research and realm timelines, every tutorial step's duration, stalls, pauses, deaths, breaks (with the thoughts behind them), expeditions, crypts, the start map's resource distances and bot notes.

Stalls are conditions a player would feel as "nothing is happening": no research selected, research not progressing for 2 days, the whole tree gated, food under a day, colonists over 30% idle for a day, half the colony stressed, the colonist cap flat for a year, and goals the bot has wanted for over 2 days but cannot do.

## Files

- `launch.js` is the Electron entry point. It sets up the hidden window and profile, loads the game through `electron-main.js`, imports `bot.js` into the page, and writes what the page reports.
- `bot.js` runs inside the page. It starts the colony, drives the simulation, records metrics and events, and asks for screenshots.
- `strategies.js` holds the profiles and the play policies.
- `summarize.js` turns runs into Markdown tables.
