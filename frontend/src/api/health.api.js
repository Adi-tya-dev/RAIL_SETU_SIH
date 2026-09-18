import { apiRequest } from "./client";

export function getHealth() {
  return apiRequest("/health");
}

export function getDatabaseHealth() {
  return apiRequest("/health/db");
}