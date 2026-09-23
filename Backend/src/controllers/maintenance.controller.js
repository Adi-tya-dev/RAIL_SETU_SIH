const maintenanceService = require("../services/maintenance.service");

async function list(req, res) {
  const result = await maintenanceService.findAll(req.query);
  res.json({ success: true, data: result.data, pagination: result.pagination });
}

async function getOne(req, res) {
  try {
    const task = await maintenanceService.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });
    res.json({ success: true, data: task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function update(req, res) {
  try {
    const task = await maintenanceService.updateTask(req.params.id, req.body);
    res.json({ success: true, data: task, message: "Maintenance task updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function approve(req, res) {
  try {
    const task = await maintenanceService.approveTask(req.params.id);
    res.json({ success: true, data: task, message: `Maintenance task #${req.params.id} has been approved` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { list, getOne, update, approve };