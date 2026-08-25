# Electron Core (MVC)

Desktop runtime — **not on VPS**. VPS backend only has login, user, license.

## Layout

```
electron-core/
  index.cjs                 # bootstrap, paths, botflow store init
  package.json              # runtime dependencies (baileys, sharp, …)
  source/                   # single copy of WhatsApp/campaign/botflow code
    utils/
    models/
  mvc/
    models/
      botflow.store.cjs     # local bot flows (secure-config JSON)
    services/
      statistics.service.cjs
```

## Setup

```bash
cd frontend/electron-core && bun install
cd frontend && bun run electron:dev
```

`electron:build` bundles `electron-core/source/` directly (no duplicate runtime folder).

## VPS

Set `VITE_API_URL` to your server — only `/api/user` and `/api/admin` are used for login.
