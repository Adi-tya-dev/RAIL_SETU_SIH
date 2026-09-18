const blockService = require("../services/block.service");

async function list(req, res) {
  const result = await blockService.findAll(req.query);
  res.json({ success: true, data: result.data, pagination: result.pagination });
}

async function getOne(req, res) {
  const block = await blockService.findById(req.params.id);
  if (!block) {
    return res.status(404).json({ success: false, message: "Block not found" });
  }
  res.json({ success: true, data: block });
}

module.exports = { list, getOne };