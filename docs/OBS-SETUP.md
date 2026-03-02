# OBS Browser Source Setup

How to add the Faux Instagram phone overlay to your OBS scene.

## 1. Add the Browser Source

1. In OBS, click **+** under Sources
2. Select **Browser**
3. Name it something like `Phone Overlay`
4. Click **OK** to open the properties

## 2. Browser Source Properties

Set these values in the properties dialog:

| Property | Value |
|----------|-------|
| **URL** | `https://<your-tunnel>.trycloudflare.com/overlay.html` |
| **Width** | `433` |
| **Height** | `892` |
| **Custom CSS** | `body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }` |
| **Shutdown source when not visible** | Checked |
| **Refresh browser when scene becomes active** | Checked |
| **FPS** | `30` (or match your stream FPS) |
| **Control audio via OBS** | Unchecked |
| **Reroute audio** | Unchecked |
| **Custom frame rate** | Unchecked (uses FPS value above) |
| **Page permissions** | Default |

**Local fallback URL:** If running OBS on the same machine as the server, use `http://localhost:3000/overlay.html` instead.

### Why these dimensions?

The overlay uses a 393 x 852 px iPhone 15 Pro frame with 20px padding on all sides:

- Width: 393 + 20 + 20 = **433**
- Height: 852 + 20 + 20 = **892**

The Custom CSS value shown above is the OBS default — just leave it as-is.

## 3. Positioning

- Drag the source to wherever you want the phone to appear in the scene
- The transparent background means only the phone frame and feed are visible
- Common placement: bottom-right or right side of the scene
- Use **Edit Transform** (right-click the source) to fine-tune position and scale

## 4. Refreshing

If the overlay looks stale or stops updating:

1. Right-click the Browser Source in the Sources list
2. Select **Refresh cache of current page**

The overlay also auto-reconnects its WebSocket, so most updates are live without needing a manual refresh.

## 5. Tunneling with cloudflared

If OBS is on a different machine (e.g. the Windows PC via RustDesk), expose the server with a cloudflared tunnel:

```
cloudflared tunnel --url http://localhost:3000
```

This prints a temporary `https://xxxx.trycloudflare.com` URL. Use that URL + `/overlay.html` as the Browser Source URL in OBS.
