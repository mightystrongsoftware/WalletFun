FROM node:22.22.1-alpine AS build

WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci

COPY server/ ./
RUN npm run build
RUN npm prune --omit=dev

FROM node:22.22.1-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app/server

COPY --from=build /app/server/package*.json ./
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist

EXPOSE 3000

CMD ["npm", "start"]

