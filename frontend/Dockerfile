# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ARG DEPLOYMENT_ENV=development
ARG NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
ARG NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV DEPLOYMENT_ENV=$DEPLOYMENT_ENV \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_TELEMETRY_DISABLED=1

RUN test -n "$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
    && npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

WORKDIR /app
RUN chown node:node /app

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:3000/api/health"]

CMD ["node", "server.js"]
