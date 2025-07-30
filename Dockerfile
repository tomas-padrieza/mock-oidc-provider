FROM node:22-slim AS build

WORKDIR /app
COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm@10
RUN pnpm install

COPY . .

RUN pnpm build

FROM node:22-slim

RUN apt-get update && apt-get install -y curl

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src/views ./views
COPY --from=build /app/dist ./

EXPOSE 3000
CMD ["node", "index.js"]