const trainImpactService = require("../services/trainImpact.service");

async function list(req, res) {
  const result = await trainImpactService.findAll(req.query);
  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
    planCount: result.planCount,
  });
}

module.exports = { list };
