# Festival IG App — ULTRA JUJU 2026

Fake Instagram feed overlay for a live stream. Displays inside an iPhone 15 Pro CSS mockup, loaded as an OBS Browser Source with transparent background.

## Quick Links
- **Spec (the WHAT):** [docs/SPEC.md](docs/SPEC.md)
- **Architecture (the HOW):** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Key Files
- `server.js` — Node.js WebSocket server (pure stdlib, zero deps)
- `overlay.html` — OBS Browser Source (iPhone frame + IG feed)
- `admin.html` — Remote control panel (Trung)
- `control.html` — Phone viewer (Julienne), tap-to-dismiss notifications
- `controls.html` — Streamer controls (Next/Back/Dismiss), mobile-optimized
- `posts.json` — Post data (`active` + `hidden` arrays)

## Running
```
node server.js
```
Serves on `http://0.0.0.0:3000`. No npm install needed.

## Conventions
- No external dependencies — everything is pure Node.js stdlib + inline CSS
- No build step, no bundler, no npm
- All assets in `assets/` (avatars, posts, icons)
- Server watches `posts.json` for live updates and HTML files for hot reload
- WebSocket protocol uses JSON messages with a `type` field

## Keeping Docs in Sync
- When requirements or behaviors change (the WHAT), update `docs/SPEC.md` to match
- When file structure, protocols, or implementation details change (the HOW), update `docs/ARCHITECTURE.md` to match
