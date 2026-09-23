import { apiRequest } from "./client";

export function listMaintenance(params = {}) {
  return apiRequest("/maintenance", { query: params });
}

export function getMaintenance(id) {
  return apiRequest(`/maintenance/${id}`);
}

export function updateMaintenance(id, data) {
  return apiRequest(`/maintenance/${id}`, {
    method: "PATCH",
    body: data,
  });
}

export function approveMaintenance(id) {
  return apiRequest(`/maintenance/${id}/approve`, {
    method: "POST",
  });
}