const scheduleService = require("../services/schedule.service");

async function list(req, res) {
  const result = await scheduleService.findAll(req.query);
  res.json({ success: true, data: result.data, pagination: result.pagination });
}

async function generate(req, res) {
  const result = await scheduleService.generate(req.body);
  res.status(201).json({ success: true, data: result });
}

async function simulate(req, res) {
  const result = await scheduleService.simulate(req.params.id, req.body);
  res.json({ success: true, data: result });
}

async function simulateEmergency(req, res) {
  const result = await scheduleService.simulateEmergency(req.body);
  res.json({ success: true, data: result });
}

async function getOne(req, res) {
  const plan = await scheduleService.findById(req.params.id);
  if (!plan) {
    return res.status(404).json({ success: false, message: "Schedule not found" });
  }

  const {
    plan_maintenance_tasks = [],
    plan_train_impacts = [],
    block_conflicts = [],
    block_operations = [],
    ...planBase
  } = plan;

  const departments = [
    ...new Set(
      (plan_maintenance_tasks || [])
        .map((task) => task?.maintenance_task?.department)
        .filter(Boolean)
    ),
  ];

  res.json({
    success: true,
    data: {
      plan: planBase,
      maintenance_tasks: plan_maintenance_tasks || [],
      departments,
      train_impacts: plan_train_impacts || [],
      conflicts: block_conflicts || [],
      operations: block_operations || [],
    },
  });
}

module.exports = { list, generate, simulate, simulateEmergency, getOne };