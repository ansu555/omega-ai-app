# Omeswap realtime-service — persistent Node process (NOT serverless).
FROM node:20-slim

WORKDIR /app

# Install deps first for layer caching. tsx/typescript are needed at runtime
# (the service runs via tsx), so install all dependencies.
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

# PORT (REST + WS). Override via env at deploy time.
EXPOSE 8080

# Liveness: REST /health returns 200 when subscriptions are up.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]
