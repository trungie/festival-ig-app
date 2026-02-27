# ARCHITECTURE — Festival IG App

## System Diagram

```
  Julienne's PC                                    Trung's PC (via Tailscale)
┌──────────────────────────┐                      ┌─────────────────────────┐
│  OBS                     │                      │  admin.html             │
│  └─ overlay.html         │ ◄── WebSocket ────── │  - Post list + controls │
│     (Browser Source)     │                      │  - Send notification    │
│     - iPhone 15 Pro frame│                      │  - Scroll Next/Back     │
│     - IG feed            │                      └─────────────────────────┘
│     - Push notifications │
│     - Transparent BG     │
│                          │
│  server.js (Node.js) ────┼── serves all files
│  └─ binds 0.0.0.0:3000  │
│  └─ watches posts.json   │
└──────────────────────────┘
              ▲
  Julienne's phone (local network)
┌──────────────────────────┐
│  control.html            │
│  - Feed viewer           │
│  - Tap to dismiss notifs │
└──────────────────────────┘
```

## File Structure

```
festival-ig-app/
├── CLAUDE.md              ← Auto-read by Claude. Project overview + pointers
├── README.md
├── docs/
│   ├── SPEC.md            ← The WHAT: requirements, behaviors
│   └── ARCHITECTURE.md    ← The HOW: this file
├── server.js              ← WebSocket server (pure Node.js, zero deps)
├── overlay.html           ← OBS Browser Source
├── admin.html             ← Remote admin panel
├── control.html           ← Phone viewer for Julienne
├── posts.json             ← Post data (active + hidden)
├── ig.html                ← Original IG template reference
└── assets/
    ├── avatars/           ← Profile pictures
    ├── posts/             ← Post images and videos
    └── ig-icon.png        ← IG icon for notifications
```

## Server (`server.js`)

### Static File Serving
- Plain `http.createServer` serves all files from repo root
- MIME type detection by extension
- No caching (`Cache-Control: no-cache`)

### WebSocket Server
Implemented from scratch using `http` upgrade + `crypto` for the handshake. No `ws` package.

**Client roles**: `overlay`, `control`, `admin` — set via `register` message on connect.

**Server state**:
```js
{ currentIndex, posts, notificationActive, notificationText }
```

### WebSocket Protocol
All messages are JSON with a `type` field.

**Client → Server:**
| Type | Fields | Effect |
|------|--------|--------|
| `register` | `role` | Sets client role, sends full state back |
| `next` | — | Increment currentIndex, broadcast scroll |
| `back` | — | Decrement currentIndex, broadcast scroll |
| `goto` | `id` | Set currentIndex to post with id, broadcast scroll |
| `notify` | `text?` | Activate notification, broadcast |
| `dismiss-notify` | — | Deactivate notification, broadcast |
| `reload` | — | Send reload to overlay + control clients |
| `sync` | — | Send full state to requesting client |

**Server → Client:**
| Type | Fields | Description |
|------|--------|-------------|
| `state` | `posts, currentIndex, notificationActive, notificationText, connectedClients` | Full state sync |
| `scroll` | `currentIndex, notificationActive` | Scroll command |
| `notification` | `active, text` | Show/hide notification |
| `reload` | — | Trigger page reload |

### File Watching
- `fs.watch()` on `posts.json` — re-reads and broadcasts full state (300ms debounce)
- `fs.watch()` on `*.html` files — sends `reload` to overlay + control (300ms debounce)

## Overlay (`overlay.html`)

### Layout Hierarchy
```
body (transparent)
└── .iphone-frame (STATIC, never moves)
    ├── .dynamic-island (STATIC)
    ├── .ios-notification (slides down over everything, z-index: 80)
    ├── .screen (overflow: hidden — clips to phone screen)
    │   └── .ig-app (overflow-y: auto — THIS SCROLLS)
    │       ├── .status-bar (sticky top)
    │       ├── .ig-header (scrolls with feed)
    │       ├── .stories-bar (scrolls with feed)
    │       ├── #feed (posts rendered here)
    │       └── .ig-nav (sticky bottom)
    └── .home-indicator (STATIC)
```

### iPhone 15 Pro Frame
- 393×852px with 55px border radius
- Dynamic Island: 126×37px centered at top
- Pure CSS (gradients, box-shadows for titanium effect)
- Home indicator bar at bottom

### Scroll Behavior
Server sends `scroll` message → overlay calls `scrollIntoView({ behavior: 'smooth' })` on the target post element.

### Notifications
CSS `transform: translateY()` animation with `cubic-bezier(0.23, 1, 0.32, 1)` easing. Backdrop blur for iOS frosted glass effect.

## OBS Setup
- Browser Source URL: `http://localhost:3000/overlay.html`
- Width: 393, Height: 852 (scale as needed)
- Custom CSS: `body { background: transparent !important; }`
- "Shutdown source when not visible" = OFF
