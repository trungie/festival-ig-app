const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = 3000;
const HOST = "0.0.0.0";
const ROOT = __dirname;

// --- Server State ---
let posts = { active: [], hidden: [] };
let currentIndex = 0;
let notificationActive = false;
let notificationText = "";
let notifScale = 1;

function loadPosts() {
  try {
    const raw = fs.readFileSync(path.join(ROOT, "posts.json"), "utf-8");
    posts = JSON.parse(raw);
    if (currentIndex >= posts.active.length) {
      currentIndex = Math.max(0, posts.active.length - 1);
    }
  } catch (e) {
    console.error("Failed to load posts.json:", e.message);
  }
}
loadPosts();

function getState() {
  return {
    type: "state",
    posts,
    currentIndex,
    notificationActive,
    notificationText,
    notifScale,
    connectedClients: {
      overlay: clients.filter((c) => c.role === "overlay").length,
      control: clients.filter((c) => c.role === "control").length,
      controls: clients.filter((c) => c.role === "controls").length,
      admin: clients.filter((c) => c.role === "admin").length,
    },
  };
}

// --- Minimal WebSocket Server ---
const MAGIC = "258EAFA5-E914-47DA-95CA-5AB5FD64BE75";

function acceptKey(key) {
  return crypto
    .createHash("sha1")
    .update(key + MAGIC)
    .digest("base64");
}

function encodeFrame(text) {
  const data = Buffer.from(text, "utf-8");
  const len = data.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text opcode
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, data]);
}

function decodeFrame(buf) {
  if (buf.length < 2) return null;
  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let payloadLen = buf[1] & 0x7f;
  let offset = 2;

  if (payloadLen === 126) {
    if (buf.length < 4) return null;
    payloadLen = buf.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buf.length < 10) return null;
    payloadLen = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }

  let maskKey = null;
  if (masked) {
    if (buf.length < offset + 4) return null;
    maskKey = buf.slice(offset, offset + 4);
    offset += 4;
  }

  if (buf.length < offset + payloadLen) return null;

  let payload = buf.slice(offset, offset + payloadLen);
  if (masked && maskKey) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= maskKey[i % 4];
    }
  }

  const totalLen = offset + payloadLen;
  return { opcode, payload, totalLen };
}

// --- Client tracking ---
const clients = [];

function broadcast(msg, excludeRole) {
  const frame = encodeFrame(JSON.stringify(msg));
  for (const c of clients) {
    if (excludeRole && c.role === excludeRole) continue;
    try {
      c.socket.write(frame);
    } catch (e) {
      // client gone
    }
  }
}

function broadcastTo(roles, msg, exclude) {
  const frame = encodeFrame(JSON.stringify(msg));
  for (const c of clients) {
    if (c === exclude) continue;
    if (roles.includes(c.role)) {
      try {
        c.socket.write(frame);
      } catch (e) {
        // client gone
      }
    }
  }
}

function sendTo(client, msg) {
  try {
    client.socket.write(encodeFrame(JSON.stringify(msg)));
  } catch (e) {
    // client gone
  }
}

function removeClient(client) {
  const idx = clients.indexOf(client);
  if (idx !== -1) clients.splice(idx, 1);
  // Notify admins of connection change
  broadcastTo(["admin"], getState());
}

function handleCommand(client, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  switch (msg.type) {
    case "register":
      client.role = msg.role || "unknown";
      console.log(`Client registered as: ${client.role}`);
      sendTo(client, getState());
      // Notify other admins of new connection
      broadcastTo(["admin"], getState(), client);
      break;

    case "next":
      if (currentIndex < posts.active.length - 1) {
        currentIndex++;
        // Auto-dismiss notification on scroll
        notificationActive = false;
        notificationText = "";
        broadcast({
          type: "scroll",
          currentIndex,
          notificationActive: false,
        });
      }
      break;

    case "back":
      if (currentIndex > 0) {
        currentIndex--;
        // Auto-dismiss notification on scroll
        notificationActive = false;
        notificationText = "";
        broadcast({
          type: "scroll",
          currentIndex,
          notificationActive: false,
        });
      }
      break;

    case "goto":
      const targetIdx = posts.active.findIndex((p) => p.id === msg.id);
      if (targetIdx !== -1) {
        currentIndex = targetIdx;
        notificationActive = false;
        notificationText = "";
        broadcast({
          type: "scroll",
          currentIndex,
          notificationActive: false,
        });
      }
      break;

    case "top":
      currentIndex = 0;
      notificationActive = false;
      notificationText = "";
      broadcast({
        type: "scroll-top",
        currentIndex: 0,
        notificationActive: false,
      });
      break;

    case "notify":
      notificationActive = true;
      notificationText =
        msg.text || "ultrajuju2026 posted a new photo";
      broadcast({
        type: "notification",
        active: true,
        text: notificationText,
      });
      break;

    case "dismiss-notify":
      notificationActive = false;
      notificationText = "";
      broadcast({ type: "notification", active: false, text: "" });
      break;

    case "notif-scale":
      notifScale = msg.scale || 1;
      broadcast({ type: "notif-scale", scale: notifScale });
      break;

    case "reload":
      broadcastTo(["overlay", "control", "controls"], { type: "reload" });
      break;

    case "sync":
      sendTo(client, getState());
      break;
  }
}

// --- HTTP Server ---
const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/") urlPath = "/overlay.html";
  if (urlPath === "/controls") urlPath = "/controls.html";

  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
  };

  // ── REST API for admin commands (fallback when WS unavailable) ──
  if (urlPath === "/api/command" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const msg = JSON.parse(body);
        // Reuse the same command handler
        const fakeClient = { socket: null, role: "admin" };
        handleCommand(fakeClient, body);
        res.writeHead(200, { "Content-Type": "application/json", ...CORS });
        res.end(JSON.stringify({ ok: true, state: getState() }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json", ...CORS });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  if (urlPath === "/api/state" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json", ...CORS });
    res.end(JSON.stringify(getState()));
    return;
  }

  const filePath = path.join(ROOT, urlPath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": mime,
      ...CORS,
    });
    res.end(data);
  });
});

// --- WebSocket Upgrade ---
server.on("upgrade", (req, socket, head) => {
  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }

  const accept = acceptKey(key);
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n` +
      "\r\n"
  );

  const client = { socket, role: "unknown", buffer: Buffer.alloc(0) };
  clients.push(client);

  socket.on("data", (data) => {
    client.buffer = Buffer.concat([client.buffer, data]);

    while (client.buffer.length > 0) {
      const frame = decodeFrame(client.buffer);
      if (!frame) break;

      client.buffer = client.buffer.slice(frame.totalLen);

      if (frame.opcode === 0x08) {
        // Close frame
        try {
          socket.end(encodeFrame(""));
        } catch (e) {}
        removeClient(client);
        return;
      } else if (frame.opcode === 0x09) {
        // Ping → send pong
        const pong = Buffer.alloc(2);
        pong[0] = 0x8a;
        pong[1] = 0;
        try {
          socket.write(pong);
        } catch (e) {}
      } else if (frame.opcode === 0x01) {
        // Text frame
        const text = frame.payload.toString("utf-8");
        handleCommand(client, text);
      }
    }
  });

  socket.on("close", () => removeClient(client));
  socket.on("error", () => removeClient(client));
});

// --- File Watching ---
let postsDebounce = null;
fs.watch(path.join(ROOT, "posts.json"), () => {
  clearTimeout(postsDebounce);
  postsDebounce = setTimeout(() => {
    console.log("posts.json changed, reloading...");
    loadPosts();
    broadcast(getState());
  }, 300);
});

// Watch HTML/CSS/JS files for hot reload
const WATCH_EXTS = [".html", ".css", ".js"];
let reloadDebounce = null;
for (const file of fs.readdirSync(ROOT)) {
  const ext = path.extname(file).toLowerCase();
  if (WATCH_EXTS.includes(ext) && file !== "server.js") {
    fs.watch(path.join(ROOT, file), () => {
      clearTimeout(reloadDebounce);
      reloadDebounce = setTimeout(() => {
        console.log(`${file} changed, sending reload...`);
        broadcastTo(["overlay", "control", "controls"], { type: "reload" });
      }, 300);
    });
  }
}

// --- Heartbeat pings (keep WS alive through NAT/mobile) ---
setInterval(() => {
  const ping = Buffer.alloc(2);
  ping[0] = 0x89; // FIN + ping opcode
  ping[1] = 0;    // no payload
  for (const c of clients) {
    try { c.socket.write(ping); } catch (e) {}
  }
}, 30000);

// --- Start ---
server.listen(PORT, HOST, () => {
  console.log(`Festival IG server running on http://${HOST}:${PORT}`);
  console.log(`  Overlay: http://localhost:${PORT}/overlay.html`);
  console.log(`  Admin:   http://localhost:${PORT}/admin.html`);
  console.log(`  Control: http://localhost:${PORT}/control.html`);
  console.log(`  Controls: http://localhost:${PORT}/controls`);
});
