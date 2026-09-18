const prisma = require("../config/prisma");

async function runInTransaction(callback) {
  return prisma.$transaction(async (tx) => callback(tx));
}

module.exports = { runInTransaction };