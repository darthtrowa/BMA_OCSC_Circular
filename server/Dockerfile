# ---- Build Stage ----
FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y openssl libssl-dev
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y openssl libssl3 && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --omit=dev

# Copy built files
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["npm", "start"]
