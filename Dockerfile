# Node/Express API server. Most hosts can also run this natively
# (build: npm ci, start: npm start) — this Dockerfile is for platforms that
# prefer a container.
FROM node:20-alpine
WORKDIR /app

# Install production dependencies first (better layer caching).
COPY package*.json ./
RUN npm ci --omit=dev

# App source + seed data.
COPY . .

ENV NODE_ENV=production
# Hosts inject $PORT; the server falls back to 4000 locally.
EXPOSE 4000
CMD ["node", "src/index.js"]
