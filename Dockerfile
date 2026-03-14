FROM node:20-alpine

# Set environment to production for optimizations
ENV NODE_ENV=production

WORKDIR /app

# Install build tools (needed by sharp during npm install) and vips-dev
RUN apk add --no-cache vips-dev python3 make g++

# Install production dependencies only (cache-friendly)
COPY package*.json ./
RUN npm ci --omit=dev --include=optional

# Remove build-only dependencies (including vips-dev) to reduce size, keep vips runtime
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
