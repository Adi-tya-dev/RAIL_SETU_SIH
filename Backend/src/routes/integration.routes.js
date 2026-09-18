const express = require("express");
const integrationController = require("../controllers/integration.controller");

const router = express.Router();

router.get("/sources", integrationController.sources);
router.post("/sync", integrationController.runSync);
router.get("/sync", integrationController.listSyncs);
router.get("/sync/latest", integrationController.latestSync);
router.get("/requests", integrationController.listRequests);
router.get("/records/errors", integrationController.listErrors);
router.get("/coa", integrationController.coa);

module.exports = router;