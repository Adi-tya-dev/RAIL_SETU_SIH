const conflictService = require("../services/conflict.service");
const conflictDetection = require("../services/conflictDetection.service");

async function list(req, res) {
  const result = await conflictService.findAll(req.query);
  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
}

async function detect(req, res) {
  try {
    const force = req.query.force === "true" || req.body?.force === true;
    const result = await conflictDetection.detectAndPersist();
    res.json({
      success: true,
      message: `Conflict detection complete. Created ${result.created} conflict records.`,
      created: result.created,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { list, detect };
