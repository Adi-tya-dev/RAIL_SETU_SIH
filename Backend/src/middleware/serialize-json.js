const { bigIntReplacer } = require("../utils/json.util");

function serializeJson(req, res, next) {
  res.json = function (body) {
    res.type("application/json").send(JSON.stringify(body, bigIntReplacer));
    return res;
  };
  next();
}

module.exports = serializeJson;