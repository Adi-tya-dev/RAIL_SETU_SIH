import { apiRequest } from "./client";

export function listBlocks(params = {}) {
  return apiRequest("/blocks", { query: params });
}

export function getBlock(id) {
  return apiRequest(`/blocks/${id}`);
}