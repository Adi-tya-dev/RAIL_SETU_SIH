import { apiRequest } from "./client";

export function listSchedules(params = {}) {
  return apiRequest("/schedules", { query: params });
}

export function getSchedule(id) {
  return apiRequest(`/schedules/${id}`);
}

export function generateSchedule(body) {
  return apiRequest("/schedules/generate", { method: "POST", body });
}

export function simulateDelay(id, body) {
  return apiRequest(`/schedules/${id}/simulate-delay`, { method: "POST", body });
}