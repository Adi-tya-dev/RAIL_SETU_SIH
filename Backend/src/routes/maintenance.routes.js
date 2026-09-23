const express = require("express");
const maintenanceController = require("../controllers/maintenance.controller");

const router = express.Router();

router.get("/", maintenanceController.list);
router.get("/:id", maintenanceController.getOne);
router.patch("/:id", maintenanceController.update);
router.post("/:id/approve", maintenanceController.approve);

module.exports = router;