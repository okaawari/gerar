FROM node:20-alpine

# Set environment to production for optimizations
ENV NODE_ENV=production

WORKDIR /app

# Install build tools and vips-dev (required by sharp)
RUN apk add --no-cache python3 make g++ libc6-compat vips-dev

# Install production dependencies only (cache-friendly)
COPY package*.json ./
RUN npm ci --omit=dev --include=optional

# Remove build-only dependencies, but KEEP 'vips' runtime for sharp
RUN apk del vips-dev python3 make g++ && \
    apk add --no-cache vips

# Copy rest of project
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Change ownership of the app directory so the 'node' user can write (e.g., to public/uploads)
RUN chown -R node:node /app

# Switch to non-root 'node' user for better security
USER node

EXPOSE 3000

CMD ["npm", "run", "start"]
