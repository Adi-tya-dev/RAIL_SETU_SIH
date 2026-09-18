import { apiRequest } from "./client";

export function listAssets(params = {}) {
  return apiRequest("/assets", { query: params });
}