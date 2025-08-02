# Build stage
FROM node:lts-alpine AS builder

WORKDIR /app

ARG NUXT_UI_PRO_LICENSE

# Install pnpm
RUN npm install -g pnpm
# Copy package files
COPY package.json pnpm-lock.yaml* ./
RUN pnpm pkg set pnpm.onlyBuiltDependencies[0]=better-sqlite3
RUN pnpm add better-sqlite3
RUN node -e 'new require("better-sqlite3")(":memory:")'

# Install all dependencies (including devDependencies for build)
RUN pnpm install

# Copy source code
COPY . .

# Set build environment variables
ENV NODE_ENV=production
ENV NUXT_UI_PRO_LICENSE=${NUXT_UI_PRO_LICENSE}

# Build the application with increased memory limit
RUN NODE_OPTIONS="--max_old_space_size=8192"  pnpm run build

# Production stage
FROM node:lts-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nuxtjs

# Copy built application
COPY --from=builder --chown=nuxtjs:nodejs /app/.output .output

# Set production environment
ENV NODE_ENV=production
ENV NUXT_PORT=3000
ENV NITRO_PORT=3000
ENV NITRO_HOST=0.0.0.0
ENV NUXT_HOST=0.0.0.0

USER nuxtjs

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
