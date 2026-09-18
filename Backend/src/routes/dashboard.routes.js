const express = require("express");
const dashboardController = require("../controllers/dashboard.controller");

const router = express.Router();

router.get("/summary", dashboardController.summary);

module.exports = router;