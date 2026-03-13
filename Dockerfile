FROM node:24-alpine

WORKDIR /app

# Install dependencies first (cache-friendly)
COPY package*.json ./
RUN npm ci

# Copy rest of project
COPY . .

# Generate Prisma client
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "start"]
