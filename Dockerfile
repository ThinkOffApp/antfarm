# Dockerfile for Ant Farm Next.js app
# Multi-stage build

# ---- Builder stage ----
FROM node:18-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --silent

# Copy source code and build
COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy only the necessary files from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js

# Install only production dependencies
RUN npm ci --only=production --silent

EXPOSE 8080
CMD ["npm", "run", "start"]
