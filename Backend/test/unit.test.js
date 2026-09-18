const { test } = require("node:test");
const assert = require("node:assert");
const { stringify } = require("../src/utils/json.util");
const errorHandler = require("../src/middleware/error-handler");
const { ApiError } = require("../src/utils/validation.util");

function mockResponse() {
  return {
    headersSent: false,
    statusCode: 0,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
}

function mockRequest() {
  return { method: "GET", originalUrl: "/api/test" };
}

test("BigInt values are serialized as strings", () => {
  assert.strictEqual(stringify({ id: 123n, name: "x" }), '{"id":"123","name":"x"}');
});

test("ApiError 400 keeps its message", () => {
  const res = mockResponse();
  const err = new ApiError(400, "page must be a positive integer");
  errorHandler(err, mockRequest(), res, () => {});
  assert.strictEqual(res.statusCode, 400);
  assert.deepStrictEqual(res.payload, { success: false, message: "page must be a positive integer" });
});

test("ApiError 404 keeps its message", () => {
  const res = mockResponse();
  const err = new ApiError(404, "Schedule not found");
  errorHandler(err, mockRequest(), res, () => {});
  assert.strictEqual(res.statusCode, 404);
  assert.deepStrictEqual(res.payload, { success: false, message: "Schedule not found" });
});

test("Prisma-like DB error returns sanitized 500", () => {
  const res = mockResponse();
  const dbErr = {
    name: "PrismaClientKnownRequestError",
    message:
      "Can't reach database server at `localhost:5432`. Make sure your database server is running. (postgresql://postgres:postgres@localhost:5432/railway_block_planning)",
  };
  errorHandler(dbErr, mockRequest(), res, () => {});
  assert.strictEqual(res.statusCode, 500);
  assert.deepStrictEqual(res.payload, { success: false, message: "Internal Server Error" });
  const raw = JSON.stringify(res.payload);
  assert.ok(!raw.includes("postgresql://"));
  assert.ok(!raw.includes("localhost"));
  assert.ok(!raw.includes("PrismaClient"));
});

test("Generic 404 raw error returns sanitized message", () => {
  const res = mockResponse();
  const err = new Error("Some internal path at C:\\secret\\file.sql");
  err.status = 404;
  errorHandler(err, mockRequest(), res, () => {});
  assert.strictEqual(res.statusCode, 404);
  assert.deepStrictEqual(res.payload, { success: false, message: "Resource not found" });
  const raw = JSON.stringify(res.payload);
  assert.ok(!raw.includes("secret"));
});

test("Unknown error with no status returns 500", () => {
  const res = mockResponse();
  errorHandler(new Error("boom"), mockRequest(), res, () => {});
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(res.payload.message, "Internal Server Error");
});