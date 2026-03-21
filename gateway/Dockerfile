FROM node:18-alpine

# better-sqlite3 needs build tools for native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY server.js init-db.sql ./

# SQLite DB stored in volume
VOLUME /app/data
ENV GATEWAY_DB_PATH=/app/data/gateway.db

EXPOSE 4000

CMD ["node", "server.js"]
