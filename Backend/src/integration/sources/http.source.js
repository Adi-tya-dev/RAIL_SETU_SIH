const { withTimeout } = require("./util");

function createHttpProvider({ code, url, timeoutMs, apiKey }) {
  return {
    async getData() {
      if (!url) {
        throw new Error(`${code} has no URL configured`);
      }

      return withTimeout(async () => {
        const headers = { Accept: "application/json" };
        if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

        const response = await fetch(url, { headers });
        const text = await response.text();
        let payload = null;
        try {
          payload = text ? JSON.parse(text) : null;
        } catch {
          throw new Error(`${code} returned invalid JSON`);
        }

        if (!response.ok) {
          throw new Error(`${code} returned HTTP ${response.status}`);
        }

        return payload && payload.data ? payload.data : payload;
      }, timeoutMs, `${code}:fetch`);
    },
  };
}

module.exports = { createHttpProvider };