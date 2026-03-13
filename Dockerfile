FROM node:20-alpine

WORKDIR /app

# Install vips runtime (needed by sharp at runtime) and build tools (needed during npm install)
RUN apk add --no-cache vips-dev python3 make g++

# Install dependencies first (cache-friendly)
COPY package*.json ./
RUN npm ci --include=optional

# Remove build-only dependencies, keep vips runtime
RUN apk del python3 make g++ && \
    apk add --no-cache vips

# Copy rest of project
COPY . .

# Generate Prisma client
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "start"]
