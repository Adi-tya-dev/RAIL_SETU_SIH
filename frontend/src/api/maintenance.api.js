import { apiRequest } from "./client";

export function listMaintenance(params = {}) {
  return apiRequest("/maintenance", { query: params });
}

export function getMaintenance(id) {
  return apiRequest(`/maintenance/${id}`);
}