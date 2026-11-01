FROM node:22.22-alpine AS build

WORKDIR /app

COPY package.json ./
COPY apps/front/package.json apps/front/package.json
COPY apps/back/package.json apps/back/package.json
COPY apps/bff/package.json apps/bff/package.json
COPY packages/common/package.json packages/common/package.json
COPY packages/common/tsconfig.json packages/common/tsconfig.json

RUN npm install

COPY . .
RUN npm run build --workspace @nexus/common
RUN npm run build --workspace @nexus/front

FROM nginx:alpine
COPY apps/front/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/front/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
