FROM node:20-slim

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ENV API_URL=http://api:8000

EXPOSE 3000
CMD ["pnpm", "dev"]
