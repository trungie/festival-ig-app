# SPEC — Festival IG App

## What It Does
A fake Instagram feed that appears as an overlay on a live stream for ULTRA JUJU 2026. The feed looks like a real Instagram app running on an iPhone 15 Pro.

## Users
- **Julienne** — Streamer. Sees the overlay in OBS. Has a phone control view to dismiss notifications.
- **Trung** — Producer. Controls the feed remotely via admin panel over Tailscale. Edits `posts.json` to add/remove posts.

## Core Behavior

### Feed
- Posts are defined in `posts.json` with two arrays: `active` (shown) and `hidden` (preloaded, not visible)
- The feed renders all `active` posts in order
- Only one post is "current" — the one scrolled into view
- Trung controls which post is visible by scrolling Next/Back or clicking a specific post

### Scroll Control
- **Next**: Scroll feed to the next post (no-op if at last post)
- **Back**: Scroll feed to the previous post (no-op if at first post)
- **Go to**: Jump to a specific post by clicking it in the admin panel
- Scrolling auto-dismisses any active notification

### Notifications
- iOS-style push notification slides down from top of the phone screen
- Triggered by Trung via admin panel (with optional custom text)
- Default text: "ultrajuju2026 posted a new photo"
- Stays visible until:
  - Julienne taps it on `control.html`
  - Trung clicks Dismiss in admin
  - Any scroll action (Next/Back/GoTo) auto-dismisses

### Live Updates
- Editing `posts.json` (e.g., moving a post from `hidden` to `active`) automatically pushes updates to all connected clients
- Editing HTML/CSS/JS files triggers a page reload on overlay and control clients

### Post Types
- **Image**: Standard photo post
- **Video**: Video with poster frame, muted, loops

## Post Data Shape
```json
{
  "id": "1",
  "username": "ultrajuju2026",
  "avatar": "./assets/avatars/juju.png",
  "media": "./assets/posts/welcome.jpg",
  "type": "image",
  "caption": "Welcome to ULTRA JUJU 2026!",
  "likes": "4,892",
  "comments": [
    { "user": "fan", "text": "LET'S GO" }
  ]
}
```

## Views
1. **Overlay** (`overlay.html`) — Display only. iPhone 15 Pro frame, transparent background. Loaded in OBS.
2. **Admin** (`admin.html`) — Desktop. Shows all posts, scroll controls, notification controls, connection status.
3. **Control** (`control.html`) — Mobile. Mirrors the feed. Tap notification to dismiss.

## Edge Cases
- WebSocket disconnects: auto-reconnect every 2 seconds, full state re-sync on connect
- Scroll bounds: Next at last post and Back at first post are no-ops
- Video audio: muted in overlay
