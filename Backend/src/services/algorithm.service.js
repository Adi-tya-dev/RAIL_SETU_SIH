const env = require("../config/env");
const logger = require("../utils/logger");
const schedulingEngine = require("../algorithms/scheduling.engine");
const simulationEngine = require("../algorithms/simulation.engine");

class AlgorithmService {
  get isConnected() {
    return true;
  }

  get mode() {
    return env.algorithm.dir && env.algorithm.entry ? "external" : "builtin";
  }

  async generateSchedule(input) {
    if (this.mode === "external") {
      logger.warn("External algorithm engine is configured but not wired; using the built-in heuristic engine");
    }
    return schedulingEngine.generateSchedule(input);
  }

  async simulateWhatIf(input) {
    if (this.mode === "external") {
      logger.warn("External algorithm engine is configured but not wired; using the built-in simulation engine");
    }
    return simulationEngine.simulateWhatIf(input);
  }
}

module.exports = new AlgorithmService();
