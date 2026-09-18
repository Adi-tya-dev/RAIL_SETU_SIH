const express = require("express");
const trainsController = require("../controllers/trains.controller");

const router = express.Router();

router.get("/", trainsController.list);
router.get("/:id", trainsController.getOne);

module.exports = router;