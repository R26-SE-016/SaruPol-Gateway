FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build

# Retain only production dependencies
RUN npm prune --omit=dev

FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000

# Copy production node_modules and compiled output from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./

EXPOSE 8000

CMD ["node", "dist/index.js"]
