const integrationService = require("../services/integration.service");
const { ApiError } = require("../utils/validation.util");
const { SOURCE_NAMES } = require("../integration/config");

async function sources(req, res) {
  const data = await integrationService.describeSources();
  res.json({ success: true, data });
}

async function runSync(req, res) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const trigger = String(body.triggered_by || "MANUAL").toUpperCase();
  const data = await integrationService.runSync({
    sources: body.sources,
    triggeredBy: trigger,
  });
  res.status(201).json({ success: true, data });
}

async function listSyncs(req, res) {
  const result = await integrationService.listSyncRuns(req.query);
  res.json({ success: true, data: result.items, pagination: { page: result.page, limit: result.limit, total: result.total } });
}

async function latestSync(req, res) {
  const data = await integrationService.latestSyncRun();
  res.json({ success: true, data });
}

async function listRequests(req, res) {
  const sourceFilter = req.query.source;
  if (sourceFilter && !SOURCE_NAMES.includes(String(sourceFilter).toUpperCase())) {
    throw new ApiError(400, `Unknown source "${sourceFilter}". Allowed sources: ${SOURCE_NAMES.join(", ")}`);
  }
  const result = await integrationService.listIncomingRequests(req.query);
  const { summary, items, total, page, limit } = result;
  res.json({ success: true, data: { summary, requests: items }, pagination: { page, limit, total } });
}

async function listErrors(req, res) {
  const result = await integrationService.listSyncErrors(req.query);
  res.json({ success: true, data: result.items, pagination: { page: result.page, limit: result.limit, total: result.total }, run: result.run });
}

async function coa(req, res) {
  const data = await integrationService.getCoaData();
  res.json({ success: true, data });
}

module.exports = { sources, runSync, listSyncs, latestSync, listRequests, listErrors, coa };