FROM node:20-alpine

WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --production

# Install client dependencies and build
COPY client/package*.json ./client/
RUN cd client && npm ci

COPY client/ ./client/
RUN cd client && npm run build

# Copy server source
COPY server/ ./server/

# Copy built client into server's public directory
RUN mkdir -p server/public && cp -r client/dist/* server/public/

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server/index.js"]
