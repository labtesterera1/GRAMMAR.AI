# Grammar.AI · SmartApp

> v1.0.0 — Modular bilingual grammar tutor. No backend, no Worker. Pure GitHub Pages.

## Run locally

```bash
# Serve the folder (any static server works). Examples:
python3 -m http.server 8080
# or
npx serve .
```

Open http://localhost:8080 — the app boots, registers a service worker, and is fully usable offline after the first load.

## Architecture (modular by JSON)

```
.
├── index.html              # Thin shell — topbar, app container, bottom nav
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker (cache + offline)
├── config/
│   ├── version.json        # App version, build, channel, history
│   ├── modules.json        # ⭐ Drives home + nav. Add a module here.
│   ├── providers.json      # AI providers (Groq / Cerebras / Gemini / Mistral)
│   └── prompts.json        # All system prompts in one place
├── core/                   # Engine — should rarely change
│   ├── app.js              # Orchestrator / boot
│   ├── router.js           # Hash routing (#/ , #/m/<id> , #/settings)
│   ├── loader.js           # Loads modules dynamically
│   ├── home.js             # Home grid renderer
│   ├── settings.js         # Settings page
│   ├── storage.js          # Namespaced localStorage wrapper
│   ├── ai.js               # Provider-agnostic AI client
│   └── ui.js               # Toast, sheet, copy, download, helpers
├── assets/
│   ├── theme.css           # ⭐ Design tokens — single source of truth
│   ├── home.css
│   └── settings.css
├── modules/
│   └── chat/
│       ├── manifest.json   # Module-level config
│       ├── view.html       # Markup
│       ├── controller.js   # Logic — exports default factory
│       └── chat.css        # Module-specific styles
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## ➕ Add a new module (3 steps)

**1. Add a folder** `modules/<id>/` containing:
   - `manifest.json` — id, name, version, options, storage keys
   - `view.html` — pure markup (no scripts)
   - `controller.js` — `export default async function init({ root, module }) { ... return { onShow, onHide } }`
   - Optionally `<id>.css` — module styles (link from `index.html` if needed)

**2. Append an entry** to `config/modules.json`:
```json
{
  "id": "translator",
  "num": "04",
  "name": "Translator",
  "tagline": "EN · HI · CONVERT",
  "icon": "🔄",
  "status": "ready",
  "order": 4,
  "showInNav": true
}
```

**3. Done.** The home grid, the bottom nav, and the router pick it up automatically.

## Status flag

- `ready` — module is loaded when the user opens it.
- `soon` — placeholder "Coming next" screen is shown. No code is fetched.

To temporarily disable a module without removing files: set its status to `soon`.

## Built-in storage keys (namespace `gai.`)

| Key | Module | Description |
|---|---|---|
| `gai.keys.<provider>` | settings | API key per provider |
| `gai.chat.history` | chat | Last N messages (N from manifest, default 50) |
| `gai.chat.lang` | chat | bilingual / english / hindi |

A new module's keys should be `gai.<id>.<thing>` — use `Storage.scope('<id>')` for cleanliness.

## Backup / restore

Settings → Data → Export JSON downloads everything (notes, drafts, keys, preferences).
Settings → Data → Import JSON restores from a backup. Both are one-tap.

## Why this architecture?

- **No backend required** — direct browser calls to AI providers, BYOK.
- **No build step** — pure ES modules. Push to GitHub Pages, done.
- **One config file controls modules** — `modules.json`. Changes appear without code edits.
- **Themeable in one file** — `assets/theme.css` holds every color, font, dimension.
- **Each module is isolated** — its own folder, controller, storage scope, prompts. Delete its folder + remove its entry → it's gone, nothing breaks.
- **Skill/feature parity with old app** — every feature from the original `NikGrammer-Agent-main` was audited and migrated (with persistence upgrades).

## Adding a provider

Edit `config/providers.json`. Each entry needs `endpoint`, `format` (`openai` or `gemini`), `model`, and an optional `keyUrl`. Settings page rebuilds itself from this file.

## License

Personal use.
