FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --include=optional

# Generate Prisma Client
RUN npx prisma generate

# Copy application source
COPY . .

# Build application
RUN npx next build

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "./node_modules/next/dist/bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]
