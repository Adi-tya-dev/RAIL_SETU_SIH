const dashboardService = require("../services/dashboard.service");

async function summary(req, res) {
  const data = await dashboardService.getSummary();
  res.json({ success: true, data });
}

module.exports = { summary };