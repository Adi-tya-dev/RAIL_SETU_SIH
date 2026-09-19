/**
 * sseManager.js — Server-Sent Events connection manager.
 *
 * Tracks every open SSE response object and broadcasts events to all of them.
 * Heartbeat keeps connections alive through proxies / load balancers.
 */
const logger = require("../utils/logger");

const clients = new Set();
let heartbeatTimer = null;
const HEARTBEAT_INTERVAL_MS = 25000; // 25 s — keeps connections alive through most proxies

function addClient(res) {
  clients.add(res);
  logger.info(`[SSE] Client connected. Total: ${clients.size}`);
}

function removeClient(res) {
  clients.delete(res);
  logger.info(`[SSE] Client disconnected. Total: ${clients.size}`);
}

/**
 * Broadcast an SSE event to all connected clients.
 * @param {string} eventName  — SSE event: field that appears as "event: <name>"
 * @param {object} data       — JSON-serialisable payload
 */
function broadcast(eventName, data) {
  if (clients.size === 0) return;
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  const dead = [];
  for (const res of clients) {
    try {
      res.write(payload);
    } catch (err) {
      dead.push(res);
    }
  }
  dead.forEach((res) => removeClient(res));
}

/**
 * Attach an SSE response: set headers, send the connected handshake,
 * wire up disconnect cleanup, and register the client.
 */
function attach(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // nginx passthrough
  res.flushHeaders();

  // Initial handshake so the client knows it's connected
  res.write(`event: connected\ndata: ${JSON.stringify({ message: "RailSetu live stream connected", ts: new Date().toISOString() })}\n\n`);

  addClient(res);

  // Remove on disconnect
  req.on("close", () => removeClient(res));
  req.on("end",   () => removeClient(res));
}

/** Start the periodic heartbeat to prevent proxy timeouts. */
function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    broadcast("heartbeat", { ts: new Date().toISOString(), clients: clients.size });
  }, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref(); // don't block process exit
}

/** Stop heartbeat (used in tests / graceful shutdown). */
function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function clientCount() {
  return clients.size;
}

module.exports = { attach, broadcast, addClient, removeClient, startHeartbeat, stopHeartbeat, clientCount };
