FROM node:20-alpine

WORKDIR /app

# Install openssl for Prisma engines on Alpine Linux
RUN apk add --no-cache openssl

# Copy dependency files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma client
RUN npm install
RUN npx prisma generate

# Copy source code
COPY . .

# Ensure entrypoint script is executable
RUN chmod +x docker-entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
