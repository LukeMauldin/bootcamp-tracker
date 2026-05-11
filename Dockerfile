FROM node:22-slim AS client
WORKDIR /app
COPY package*.json ./
COPY shared/package*.json shared/
COPY client/package*.json client/
COPY server/package*.json server/
RUN npm ci
COPY shared/ shared/
COPY client/ client/
RUN npm run build -w client

FROM node:22-slim AS server
WORKDIR /app
COPY package*.json ./
COPY shared/package*.json shared/
COPY client/package*.json client/
COPY server/package*.json server/
RUN npm ci
COPY shared/ shared/
COPY server/ server/
RUN npm run build -w server

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=server /app/node_modules ./node_modules
COPY --from=server /app/server/node_modules ./server/node_modules
COPY --from=server /app/server/dist ./server/dist
COPY --from=server /app/server/src/data ./server/dist/data
COPY --from=client /app/client/dist ./client/dist
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server/dist/index.js"]
