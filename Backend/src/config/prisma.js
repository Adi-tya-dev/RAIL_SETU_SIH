const { PrismaClient } = require("@prisma/client");

if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes("@localhost:")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("@localhost:", "@127.0.0.1:");
}

const prisma = new PrismaClient();

module.exports = prisma;