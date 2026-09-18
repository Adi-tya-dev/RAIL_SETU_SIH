const assetService = require("../services/asset.service");

async function list(req, res) {
  const result = await assetService.findAll(req.query);
  res.json({ success: true, data: result.data, pagination: result.pagination });
}

module.exports = { list };