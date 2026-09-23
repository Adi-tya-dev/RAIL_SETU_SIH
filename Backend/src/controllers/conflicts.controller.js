const conflictService = require("../services/conflict.service");

async function list(req, res) {
  const result = await conflictService.findAll(req.query);
  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
}

module.exports = { list };
