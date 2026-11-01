FROM node:22.22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/front/package.json apps/front/package.json
COPY apps/bff/package.json apps/bff/package.json
COPY apps/back/package.json apps/back/package.json
COPY packages/common/package.json packages/common/package.json
COPY packages/common/tsconfig.json packages/common/tsconfig.json

RUN npm ci --no-audit --no-fund

COPY . .

RUN npm run build --workspace @nexus/common
RUN npm run build --workspace @nexus/bff
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:22.22-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/common ./packages/common
COPY --from=build /app/apps/bff/package.json ./apps/bff/package.json
COPY --from=build /app/apps/bff/dist ./apps/bff/dist

ENV BFF_PORT=3001

USER node

EXPOSE 3001

CMD ["node", "apps/bff/dist/main.js"]
