import { apiRequest } from "./client";

export function listTrains(params = {}) {
  return apiRequest("/trains", { query: params });
}

export function getTrain(id) {
  return apiRequest(`/trains/${id}`);
}