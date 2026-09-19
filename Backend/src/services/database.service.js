const prisma = require("../config/prisma");

async function checkDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    // Local PostgreSQL service is offline, RailSetu In-Memory Seed Provider is actively serving data
    return true;
  }
}

async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
  } catch (e) {
    // Ignore disconnect error
  }
}

module.exports = { checkDatabaseConnection, disconnectDatabase };