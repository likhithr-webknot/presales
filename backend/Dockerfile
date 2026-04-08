FROM node:20-slim

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
