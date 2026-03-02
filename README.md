# Festival IG App

A fake Instagram-style overlay for live streams. Displays pre-made and dynamically updated posts that simulate a real festival's social media feed during broadcast events.

Built for **ULTRA JUJU 2026** — a themed birthday stream for Julienne By, where viewers "attend" a virtual music festival through tiered donations and interactive content.

## What It Does

- Renders an Instagram-style feed as a browser source overlay for streaming software (e.g. OBS)
- Shows pre-made posts that appear on a schedule or on cue during the broadcast
- Supports dynamically updated posts to react to live events in real time
- Simulates the look and feel of a real festival's social media presence

## Use Case

During the ULTRA JUJU 2026 stream, this overlay creates the illusion of a live festival social media feed. Viewers see "posts" from fictional attendees, artists, and the festival itself — reinforcing the themed experience as they participate through tiered donations and interactive content.

## Test Results (2026-03-02)

Tested with `cloudflared tunnel --url http://localhost:3000` and OBS Browser Source.

**Working:**
- Overlay displays in OBS scene — looks like an iPhone with Instagram feed (older IG style)
- Controls page (`/controls`) scrolls the feed remotely
- Video plays without issues (audio not tested)
- Notifications appear and can be dismissed
- WebSocket falls back to REST polling through Cloudflare tunnel (WS doesn't work through cloudflared quick tunnels)

**Not yet tested:**
- Adding new content while live
- Video audio playback

## TODO

- [ ] **Font size tweaking** — overlay was scaled down in OBS to fit canvas, text ends up too small
- [ ] **OBS canvas positioning** — final placement TBD, need to test with main camera and other overlay elements
- [ ] **Entrance/exit animation** — slide-in or transition when showing/hiding the phone overlay
  - Idea: show only the top of the phone (status bar) when "hidden" so notifications peek through, then slide the full phone in when active
  - Needs a designated spot in the OBS canvas layout
- [ ] **Test live content addition** — add new posts to `posts.json` while streaming
- [ ] **Modernize IG style** — currently resembles an older version of Instagram
