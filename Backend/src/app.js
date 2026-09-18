const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const serializeJson = require("./middleware/serialize-json");
const requestLogger = require("./middleware/request-logger");
const errorHandler = require("./middleware/error-handler");
const healthRoutes = require("./routes/health.routes");
const maintenanceRoutes = require("./routes/maintenance.routes");
const blocksRoutes = require("./routes/blocks.routes");
const trainsRoutes = require("./routes/trains.routes");
const assetsRoutes = require("./routes/assets.routes");
const schedulesRoutes = require("./routes/schedules.routes");
const integrationRoutes = require("./routes/integration.routes");
const dashboardRoutes = require("./routes/dashboard.routes");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use(serializeJson);

app.use("/api/health", healthRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/blocks", blocksRoutes);
app.use("/api/trains", trainsRoutes);
app.use("/api/assets", assetsRoutes);
app.use("/api/schedules", schedulesRoutes);
app.use("/api/integration", integrationRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use(errorHandler);

module.exports = app;