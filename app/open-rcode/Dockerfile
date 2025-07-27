# Build stage
FROM node:lts-alpine AS builder

WORKDIR /app

ARG NUXT_UI_PRO_LICENSE

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install all dependencies (including devDependencies for build)
RUN pnpm install

# Copy source code
COPY . .

# Set build environment variables
ENV NODE_ENV=production
ENV NUXT_UI_PRO_LICENSE=${NUXT_UI_PRO_LICENSE}

# Build the application with increased memory limit
RUN NODE_OPTIONS="--max_old_space_size=4096"  pnpm run build

# Production stage
FROM node:lts-alpine AS runner

# Add container metadata labels
LABEL org.opencontainers.image.source=https://github.com/Killian-Aidalinfo/ccweb
LABEL org.opencontainers.image.description="Open-rcode - AI-assisted development platform"
LABEL org.opencontainers.image.licenses=MIT
LABEL org.opencontainers.image.title="Open-rcode"
LABEL org.opencontainers.image.vendor="Aidalinfo"

WORKDIR /app

# Install kubectl
RUN apk add --no-cache curl && \
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/ && \
    apk del curl

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
