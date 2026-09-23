const trainService = require("../services/train.service");
const onlineRailwayService = require("../services/onlineRailway.service");

async function list(req, res) {
  const result = await trainService.findAll(req.query);
  res.json({ success: true, data: result.data, pagination: result.pagination });
}

async function getOne(req, res) {
  const train = await trainService.findById(req.params.id);
  if (!train) {
    return res.status(404).json({ success: false, message: "Train not found" });
  }
  res.json({ success: true, data: train });
}

async function backfill(req, res) {
  const result = await onlineRailwayService.backfillAllTrainData();
  res.json({ success: true, data: result, message: "Train routes and block movements synchronized successfully." });
}

module.exports = { list, getOne, backfill };