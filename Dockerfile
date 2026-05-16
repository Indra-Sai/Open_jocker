# --- Stage 1: Build Frontend ---
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# --- Stage 2: Install Backend Dependencies ---
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --production

# --- Stage 3: Final Production Image ---
FROM node:20-alpine
WORKDIR /app

# Copy server dependencies and source
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY server/ ./server/

# Copy built client from Stage 1
COPY --from=client-builder /app/client/dist ./client/dist

EXPOSE 3000

ENV NODE_ENV=production
# Render/Railway will override this, but 3000 is a good default
ENV PORT=3000

CMD ["node", "server/index.js"]
