const express = require("express");
const maintenanceController = require("../controllers/maintenance.controller");

const router = express.Router();

router.get("/", maintenanceController.list);
router.get("/:id", maintenanceController.getOne);

module.exports = router;