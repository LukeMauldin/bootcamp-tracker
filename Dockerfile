FROM node:22-slim AS client
WORKDIR /app
COPY package*.json ./
COPY shared/package*.json shared/
COPY client/package*.json client/
COPY server/package*.json server/
RUN npm ci
COPY shared/ shared/
COPY client/ client/
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
RUN set -eu; \
    for name in VITE_FIREBASE_API_KEY VITE_FIREBASE_AUTH_DOMAIN VITE_FIREBASE_PROJECT_ID VITE_FIREBASE_APP_ID; do \
      eval "value=\${$name:-}"; \
      if [ -z "$value" ] || [ "$value" = "SET_IN_CLOUD_BUILD_TRIGGER" ]; then \
        echo "$name must be provided as a Docker build arg" >&2; \
        exit 1; \
      fi; \
      case "$value" in \
        keyString:*) \
          echo "$name must be the raw Firebase value, not a labeled CLI field" >&2; \
          exit 1; \
          ;; \
      esac; \
      if [ "$name" = "VITE_FIREBASE_API_KEY" ] && ! printf '%s' "$value" | grep -q '^AIza'; then \
        echo "$name does not look like a Firebase Web API key" >&2; \
        exit 1; \
      fi; \
    done; \
    npm run build -w client

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
COPY --from=server /app/server/dist ./server/dist
COPY --from=server /app/server/src/data ./server/dist/data
COPY --from=client /app/client/dist ./client/dist
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server/dist/index.js"]
