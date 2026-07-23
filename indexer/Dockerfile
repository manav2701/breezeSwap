FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build || echo "No build script needed yet"

FROM node:20-alpine AS runner
WORKDIR /app
COPY package.json ./
RUN npm install --only=production
COPY --from=builder /app/dist ./dist || true
COPY --from=builder /app/src ./src || true

EXPOSE 3001
CMD ["node", "-e", "console.log('BreezeSwap Indexer Placeholder Running on Render'); setInterval(() => {}, 60000);"]
