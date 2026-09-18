const prisma = require("../config/prisma");

async function checkDatabaseConnection() {
  await prisma.$queryRaw`SELECT 1`;
}

async function disconnectDatabase() {
  await prisma.$disconnect();
}

module.exports = { checkDatabaseConnection, disconnectDatabase };


// Routes       → "Kaunsi URL par kya function chalega?"

// Controller   → "Request ka response kya dena hai?"

// Service      → "Actual business/database ka kaam kya hai?"

// Prisma       → "Database se communicate kaise karna hai?"

// PostgreSQL   → "Actual data/database kahan hai?"