const express = require("express");
const blocksController = require("../controllers/blocks.controller");

const router = express.Router();

router.get("/", blocksController.list);
router.get("/:id", blocksController.getOne);

module.exports = router;