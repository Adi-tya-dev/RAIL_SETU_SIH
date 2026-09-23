import { apiRequest } from "./client";

export function listTrains(params = {}) {
  return apiRequest("/trains", { query: params });
}

export function getTrain(id) {
  return apiRequest(`/trains/${id}`);
}

export function backfillTrains() {
  return apiRequest("/trains/backfill", { method: "POST" });
}

export function syncOnlineTrains(limit = 30) {
  return apiRequest("/integration/fetch-online-trains", { method: "POST", body: { limit } });
}