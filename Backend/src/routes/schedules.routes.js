const express = require("express");
const schedulesController = require("../controllers/schedules.controller");

const router = express.Router();

router.get("/", schedulesController.list);
router.post("/generate", schedulesController.generate);
router.post("/:id/simulate-delay", schedulesController.simulate);
router.get("/:id", schedulesController.getOne);

module.exports = router;