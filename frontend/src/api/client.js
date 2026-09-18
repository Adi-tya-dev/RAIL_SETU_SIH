const RAW_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const API_BASE_URL = RAW_BASE.replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, { status = 0, code = "ERROR" } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function isUnavailable(error) {
  return error instanceof ApiError && (error.status === 501 || error.status === 404);
}

function buildUrl(path, query) {
  const base = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return base;

  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.append(key, String(value));
  });

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function friendlyMessage(status, code, payload) {
  if (code === "NETWORK") {
    return "Unable to connect to backend. Is the server running?";
  }

  const serverMessage = payload && typeof payload.message === "string" ? payload.message : null;

  switch (status) {
    case 400:
      return serverMessage || "Invalid request or filter. Please check the selected values.";
    case 404:
      return serverMessage || "Requested resource was not found.";
    case 501:
      return serverMessage || "Feature not connected yet.";
    case 500:
      return "Backend or database error. Please try again.";
    default:
      if (status >= 500) return "Backend error. Please try again.";
      return serverMessage || `Request failed with status ${status}.`;
  }
}

export async function apiRequest(path, options = {}) {
  const { method = "GET", query, body, signal, headers = {} } = options;

  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err && err.name === "AbortError") throw err;
    throw new ApiError(friendlyMessage(0, "NETWORK", null), { status: 0, code: "NETWORK" });
  }

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const code = String(response.status) === "501" ? "NOT_IMPLEMENTED" : "HTTP";
    throw new ApiError(friendlyMessage(response.status, code, payload), {
      status: response.status,
      code,
    });
  }

  return payload;
}