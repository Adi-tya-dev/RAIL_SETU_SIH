const trainService = require("../services/train.service");

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

module.exports = { list, getOne };