# Localization

All player-visible text lives in `locale/en.json`. Code and config refer to it by key, and the player picks a language in Settings (General tab). A language change applies on restart.

To edit text, edit `locale/en.json`. To add a language, see [Adding a language](#adding-a-language).

## How it fits together

| Piece | Where | What it does |
|---|---|---|
| String table | `locale/en.json` | Flat dotted keys, sorted. Plurals are `{ "one": ..., "other": ... }`. |
| Language list | `locale/index.json` | `[{ code, label }]` for the language dropdown. Use each language's own name as its label. |
| Lookups | `js/core/i18n.js` | `t`, `tp`, `tHtml`, `ref`, `defRef`, `defMessage`, `stampLoc`. No game imports, so it also runs in Node. |
| Static markup | `js/ui/i18n-dom.js` | Translates `index.html` from `data-i18n*` attributes at startup. |
| Names by key | `js/core/names.js` | `resourceName`, `buildingName`, `entityName`, `terrainName`, `raceName`, the matching `*Ref` log params, and `idLabel` for English labels that double as ids. |
| Item names | `js/entities/item-roll.js` | `itemName(item)`, `itemDescription(item)`, `itemRef(item)`. Rebuilds the name from quality, base and enchantment. |
| Log entries | `js/ui/eventlog.js` | `logEntryText`, `logEntryTime`, `setLogMessage`. |
| Thoughts | `js/entities/colonist.js` | `addThought(colonist, id, ...)` matches thoughts by id. `thoughtText(thought)` gives the display text. |
| Startup | `js/core/boot.js` | Loads the table before the mod loader and the game. |

### Config text

Config entries (`js/core/config/*.js`) hold only mechanics. Their text is in the table under `<category>.<id>.<field>`, for example `spell.fireball.description` or `realm.crystal_mines.boss.approachText`. Each config file calls `stampLoc(COLLECTION, 'category')` after a collection. When the config loads, that call:

- records the key prefix on each entry as `_loc`, and
- fills each text field (`name`, `description`, `lore`, ... see `TEXT_FIELDS`) from the table.

So code keeps reading `def.name` and gets the active language. Nested objects extend the key: by property name, or by an array element's `key` (its index when it has none). A list of flavor lines is stored in config as a count (`ambient: 12`), and `stampLoc` expands it to the lines `<prefix>.ambient.0` to `.11`.

Fields that double as identifiers (`category`, `realmGroup`, `chain`) stay in config as they are. Show them with `idLabel()`, `buildCategoryName()`, `recipeCategoryName()` or `realmGroupName()`.

## Writing code that shows text

**Never put English in code.** Add a key and look it up.

```js
import { t, tp } from '../core/i18n.js';

el.textContent = t('ui.build.cancel');
html += `<div>${escapeHtml(t('ui.colonist.hp', { hp, max }))}</div>`;   // "HP: {hp}/{max}"
toast(tp('msg.main.colonists_fed', fed));                               // { "one": "{n} colonist shares...", "other": "{n} colonists share..." }
```

- **Whole sentences, with params.** Write `t('msg.raid.arrived', { name, n })` with the text `"{name}! {n} enemies approaching!"`. Don't glue translated fragments together, because word order differs between languages. A label with a value is one key: `"HP: {hp}/{max}"`.
- **Plurals:** use `tp(key, n, params)` and a `{ "one", "other" }` value, not `n === 1 ? '' : 's'`.
- **Escaping:** `t()` returns plain text. Wrap it in `escapeHtml()`/`escapeAttr()` when it goes into HTML, as with any other string. If a string truly needs markup, give its key an `_html` suffix and use `tHtml()`, which escapes the params. Prefer keeping markup in code: `` `<b>${escapeHtml(t('ui.x.title'))}</b>` ``.
- **Names of things:** read them from config (`def.name`, `SPELLS[k].name`) or use `names.js` (`resourceName('iron_ore')`), `itemName(item)`, `defName(def)`. Don't build names from keys with `replace(/_/g, ' ')`.
- **Numbers:** format as before (`toFixed`, `Math.round`) and pass the result as a param.
- **Not translated:** ids, CSS, console messages, `js/dev`, `js/editor`, and proper names (colonist names, player-typed text).

### Text that is saved

The language can change between sessions, so text that is saved with the colony must be stored as a key and params, not as finished text:

- **Event log:** `game.eventLog.add(game, { key: 'msg.raid.arrived', params: { n } }, 'danger', linked)`.
- **Expedition log:** `this._addLog(exp, game, { key, params }, type, meta)`, or `defMessage(def, 'successText', { name })` for config text.
- **Params** are raw values or references that are translated when shown: `ref(key)`, `defRef(def)`, `itemRef(item)`, `resourceRef(key)`, `buildingRef(type)`, `entityRef(type)`. Never pass the output of `t()` as a param of a saved message.
- **Other saved objects:** anything reachable from `_buildSaveData` in `js/core/save.js` follows the same rule. Store `{ key, params }` (or ids) and render with `t()` when shown. Keep reading the old string field so older saves still display.

Text that isn't saved (toasts, floating text, panels, canvas, confirm dialogs) can use `t()` when it's created.

### Static HTML

In `index.html`, give the element a key and keep the English as the fallback:

```html
<button id="load-game" data-i18n="html.start.load_game">Load Game</button>
<input data-i18n-placeholder="html.mods.search" placeholder="Search">
```

The attributes are `data-i18n` (text), `data-i18n-html` (sanitized markup), `data-i18n-title`, `data-i18n-placeholder`, `data-i18n-aria` and `data-i18n-alt`.

## Keys

- Dotted lowercase snake_case: `ui.settings.language`.
- Prefixes:
  - `ui.<area>.*`: interface text.
  - `msg.<system>.*`: logs and notifications.
  - `html.<section>.*`: `index.html`.
  - `common.*`: shared words such as `common.cancel`.
  - `tutorial.*`, `glossary.*`, `changelog.*`.
- Derived config keys use the config category (`spell.`, `item.`, `realm.`, ...). Don't create code keys under a config category.
- Add keys with `node scripts/i18n/add-keys.mjs file.json` (or pipe JSON to `-`). It merges into `en.json`, keeps it sorted, and refuses to change an existing key's text.

## Tools

```sh
npm run i18n:check                             # self-test + table checks (run after any text change)
node scripts/i18n/add-keys.mjs strings.json    # add keys to en.json
node scripts/i18n/extract-config.mjs <file.js|all> [--dry-run]   # move config text literals to en.json
node scripts/i18n/snapshot.mjs [--with-table]  # every config text key and its text, as JSON
npm run playtest -- --bot=scripts/i18n/inapp-probe.js --label=i18n-probe   # in-game checks
node scripts/i18n/check.mjs --all              # list every key nothing seems to use
```

### Finding text that bypasses the table

`pseudo-locale.mjs` writes `locale/xx.json` (git-ignored), a copy of English with every string wrapped in ⟦…⟧. With it active, any on-screen text without the brackets didn't come from a lookup. `pseudo-scan.js` automates the check: it opens every main panel and reports unwrapped DOM text. Canvas text shows up in its screenshots.

```sh
node scripts/i18n/pseudo-locale.mjs
npm run playtest -- --bot=scripts/i18n/pseudo-scan.js --label=pseudo-set  --user-data=/tmp/rh-pseudo   # selects xx
npm run playtest -- --bot=scripts/i18n/pseudo-scan.js --label=pseudo-scan --user-data=/tmp/rh-pseudo   # scans
```

Strings with markup (the controls list, story text) span several text nodes and show up as false positives.

`i18n:check` fails on:

- keys used in code but missing from `en.json`,
- broken plurals,
- markup in non-`_html` keys,
- translations whose `{placeholders}` differ from English.

It also lists config text still inline and keys nothing seems to use. Keys count as used when the code builds them from a prefix (`` `msg.x.${id}` ``, `'msg.x.' + id`, `idLabel('msg.x', id)`), names them as a quoted literal anywhere, or falls under a prefix in `dynamic-prefixes.json`.

In the browser:

- **`?i18n-debug`** logs every missing key once. `localStorage.rifthold_i18n_debug = '1'` does the same.
- **`?i18n-pseudo`** wraps every translated string in `[[...]]`, so text that bypasses the table stands out.

## Mods

A mod can keep text inline in its JSON, as before. To translate it, the mod ships `locale/<lang>.json` with keys like the base game's (`spell.<id>.name`). Its English file backs up partial translations, and base game keys can't be overridden.

## Adding a language

1. Copy `locale/en.json` to `locale/<code>.json` and translate the values. Keep every `{placeholder}`, and keep the markup in `_html` and `story_milestone.*` values.
2. Add `{ "code": "<code>", "label": "<name in that language>" }` to `locale/index.json`.
3. Run `npm run i18n:check`. It flags placeholder mismatches and keys that aren't in English.
4. Fonts: Pixelify Sans covers Latin and Cyrillic, and canvas text uses the system monospace font. Scripts beyond those, such as CJK, need a font added in `fonts/fonts.css`.
