# syntax=docker/dockerfile:1
# Image de production (01 §2, R-DEP-2, 08 §4), construite depuis la racine du dépôt :
#   docker build -f infra/Dockerfile --build-arg VERSION=vX.Y.Z [--build-arg VITE_OWNER_FIRST_NAME=…] -t appsport:vX.Y.Z .
# Contrat vérifié en CI par infra/test/image-contract.sh.

FROM node:24 AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /src
COPY . .
RUN pnpm install --frozen-lockfile
# Prénom du porteur affiché par la page de confidentialité, lu par Vite au build.
ARG VITE_OWNER_FIRST_NAME
RUN pnpm build

# Étape finale : server.mjs, la PWA et le contenu, sans node_modules.
FROM node:24-slim
ARG VERSION=dev
ENV NODE_ENV=production APP_VERSION=${VERSION} PORT=3000 HOST=0.0.0.0 APPSPORT_DATA_DIR=/data APPSPORT_PUBLIC_DIR=/app/public APPSPORT_CONTENT_DIR=/app/data
WORKDIR /app
COPY --from=build /src/apps/server/dist/server.mjs /app/server.mjs
COPY --from=build /src/apps/web/dist /app/public
COPY --from=build /src/data /app/data
USER 1000
EXPOSE 3000
# node:24-slim n'a pas curl : la sonde passe par le fetch de Node.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node","-e","fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.status===200?0:1),()=>process.exit(1))"]
CMD ["node","/app/server.mjs"]
