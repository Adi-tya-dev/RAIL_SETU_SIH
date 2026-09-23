const express = require("express");
const controller = require("../controllers/conflicts.controller");

const router = express.Router();

router.get("/", controller.list);
router.post("/detect", controller.detect);

module.exports = router;
