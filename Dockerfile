# syntax=docker/dockerfile:1
#
# Fly.io deploy image
# - Uses Playwright base image because this app depends on `playwright` at runtime (unsubscribe agent).
# - Uses SQLite on a mounted volume (DATABASE_URL=file:/data/app.db).
#

# Keep this in sync with the Playwright version resolved in package-lock.json.
FROM mcr.microsoft.com/playwright:v1.57.0-jammy AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run prisma:generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Install production deps (keeps image smaller than copying dev deps)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# App build output + assets
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public

# Prisma artifacts needed at runtime + for migrations
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src/generated ./src/generated

EXPOSE 3000

# Fly routes traffic to internal_port (3000) configured in fly.toml.
CMD ["sh", "-lc", "npx prisma migrate deploy && node node_modules/next/dist/bin/next start -p 3000"]


