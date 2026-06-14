# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
COPY package*.json ./
COPY patches ./patches
RUN npm install
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine
WORKDIR /app
# STAB-14: Install Chromium for Puppeteer bot sync
RUN apk add --no-cache openssl ca-certificates chromium nss freetype harfbuzz ttf-freefont wget
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
COPY package*.json ./
COPY patches ./patches
RUN npm install --omit=dev

# Copy built files
COPY --from=builder /app/dist ./dist

# Fix ownership so user 'node' can write to /app (e.g. create .adminjs directory)
RUN chown -R node:node /app

EXPOSE 3000
USER node
CMD ["npm", "start"]
