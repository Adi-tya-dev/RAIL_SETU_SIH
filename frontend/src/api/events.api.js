import { API_BASE_URL } from "./client";

/**
 * Opens a Server-Sent Events stream to the backend.
 *
 * @param {object} handlers
 *   handlers.onConnected(data)    — fires once on successful connection
 *   handlers.onNewRequest(data)   — fires when a simulator has a new task
 *   handlers.onPlanUpdated(data)  — fires when auto-replan ran
 *   handlers.onHeartbeat(data)    — fires every ~25 s (keep-alive)
 *   handlers.onError(err)         — fires on connection error
 *
 * @returns {() => void}  call to close the stream
 */
export function openEventStream(handlers = {}) {
  const url = `${API_BASE_URL}/integration/events`;

  let es;
  try {
    es = new EventSource(url);
  } catch (err) {
    handlers.onError?.(err);
    return () => {};
  }

  es.addEventListener("connected", (e) => {
    try { handlers.onConnected?.(JSON.parse(e.data)); } catch {}
  });

  es.addEventListener("new_request", (e) => {
    try { handlers.onNewRequest?.(JSON.parse(e.data)); } catch {}
  });

  es.addEventListener("plan_updated", (e) => {
    try { handlers.onPlanUpdated?.(JSON.parse(e.data)); } catch {}
  });

  es.addEventListener("heartbeat", (e) => {
    try { handlers.onHeartbeat?.(JSON.parse(e.data)); } catch {}
  });

  es.onerror = (err) => {
    handlers.onError?.(err);
  };

  return () => es.close();
}

/**
 * Inject a test request into a simulator via the backend.
 * The watcher will detect it and emit a new_request event.
 *
 * @param {"TMS"|"SMMS"|"TDMS"} source
 * @param {object} task
 */
export async function injectSimulatorRequest(source, task) {
  const res = await fetch(`${API_BASE_URL}/integration/simulator/${source}/inject`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(task),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.message || `Inject failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Get current watcher status.
 */
export async function getWatcherStatus() {
  const res = await fetch(`${API_BASE_URL}/integration/watcher/status`);
  if (!res.ok) throw new Error(`Watcher status fetch failed: ${res.status}`);
  return res.json();
}
