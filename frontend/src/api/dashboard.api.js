import { apiRequest } from "./client";

export function getSummary() {
  return apiRequest("/dashboard/summary");
}