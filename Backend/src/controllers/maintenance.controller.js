const maintenanceService = require("../services/maintenance.service");

async function list(req, res) {
  const result = await maintenanceService.findAll(req.query);
  res.json({ success: true, data: result.data, pagination: result.pagination });
}

async function getOne(req, res) {
  const task = await maintenanceService.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, message: "Maintenance task not found" });
  }
  res.json({ success: true, data: task });
}

module.exports = { list, getOne };