# Grammar.AI · SmartApp · v1.1.0

> Bilingual grammar tutor. No backend required. Direct API or Worker proxy. Pure GitHub Pages.

## What's new in v1.1.0

- **Responsive design** — desktop side-rail, multi-column home grid, two-pane Settings
- **Worker proxy restored** — Save URL in Settings + 3-mode toggle (Worker first / Worker only / Direct keys)
- **Persistent Storage API** — silently requested on boot; mode + usage shown in Settings
- **Chat layout overhaul** — composer never overlaps content, dedicated scrolling stream area
- **Per-provider primary star** — pick which provider to try first
- **Keyboard shortcuts** — `/` focus chat input, `Esc` close sheet, `g h` home, `g s` settings, `g c` chat
- **Full version history** in About section

## Run locally

```bash
python3 -m http.server 8080
# or: npx serve .
```

## Architecture

```
.
├── index.html              # Shell — topbar + side-rail + content + bottom nav
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker (cache + offline)
├── config/
│   ├── version.json        # App version + changelog
│   ├── modules.json        # ⭐ Drives home + nav. Add a module here.
│   ├── providers.json      # AI providers
│   └── prompts.json        # All system prompts
├── core/                   # Engine
│   ├── app.js              # Boot + routing + nav
│   ├── router.js           # Hash routing
│   ├── loader.js           # Lazy module loader
│   ├── home.js             # Home grid
│   ├── settings.js         # Settings page
│   ├── storage.js          # localStorage + Persistent API
│   ├── ai.js               # Worker + direct calls + mode + primary
│   └── ui.js               # Toast / sheet / copy / download
├── assets/                 # Theme + page CSS
├── modules/chat/           # Chat module
└── icons/
```

## Add a new module (3 steps)

1. Drop folder `modules/<id>/` with `manifest.json`, `view.html`, `controller.js`, optional CSS.
2. Append entry in `config/modules.json` with `"status": "ready"`.
3. Done. Home grid + side rail + bottom nav pick it up automatically.

## AI Routes

Three modes, set in **Settings → AI ROUTE MODE**:

| Mode | Behavior |
|---|---|
| `worker-first` | Try Worker first, fall back to direct provider keys. Recommended. |
| `worker-only`  | Only Worker. Fail if Worker fails. |
| `direct-only`  | Ignore Worker, use direct keys only. |

The Worker endpoint expects `POST <worker_url>/api/chat` with body `{messages, provider, temperature, maxTokens}` and returns `{text}` (or OpenAI/Gemini-shaped JSON — both parsed).

## Storage

- **Persistent storage** silently requested on first boot via `navigator.storage.persist()`.
- Settings → STORAGE shows current mode (`✓ Persistent` or `Best-effort`) and live usage (`141 KB / 207 MB`).
- **Browser cache clear ≠ data wipe** when persistent. *Clear all site data still wipes everything* — use Export JSON for backups.

## Keyboard shortcuts (desktop)

| Key | Action |
|---|---|
| `/` | Focus chat composer |
| `Esc` | Close any open sheet/modal |
| `g h` | Home |
| `g s` | Settings |
| `g c` | Chat module |

## Versioning

- App version: `config/version.json`
- Module version: `modules/<id>/manifest.json`
- SW cache version bumped per release (`gai-v1.1.0`)

## Deploy

Push the folder to a public GitHub repo with Pages enabled on root. Done.

## License

Personal use.
