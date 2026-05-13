# ---- Build Stage ----
FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y openssl libssl-dev
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- Production Stage ----
FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y openssl libssl3 && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --omit=dev

# Copy built files and prisma client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
CMD ["npm", "start"]
