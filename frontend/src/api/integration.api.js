import { apiRequest } from "./client";

export function getIntegrationSources() {
  return apiRequest("/integration/sources");
}

export function runIntegrationSync(sources, triggeredBy = "MANUAL") {
  return apiRequest("/integration/sync", {
    method: "POST",
    body: {
      sources,
      triggered_by: triggeredBy,
    },
  });
}

export function listIncomingRequests(params = {}) {
  return apiRequest("/integration/requests", { query: params });
}

export function getCoaData() {
  return apiRequest("/integration/coa");
}

export function getLatestSync() {
  return apiRequest("/integration/sync/latest");
}