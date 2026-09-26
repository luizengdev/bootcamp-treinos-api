FROM node:24-slim AS base

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY prisma7.config.ts ./

# ------- Dependencies -------
FROM base AS deps

RUN npm ci

# ------- Build -------
FROM deps AS build

COPY . .
    
RUN npx prisma generate --config prisma7.config.ts && npm run build

# ------- Production -------
FROM base AS production

ENV NODE_ENV=production

RUN npm ci --omit=dev --ignore-scripts

COPY --from=build /app/dist ./dist

CMD ["node", "dist/index.js"]