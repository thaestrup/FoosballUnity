FROM node:20-alpine AS base
WORKDIR /usr/src/app
COPY package*.json ./

FROM base AS deps
RUN npm ci

FROM deps AS dev
EXPOSE 4200
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM deps AS build
ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}
COPY . .
RUN npm run build

FROM nginx:alpine AS prod
# nginx:alpine entrypoint runs envsubst on /etc/nginx/templates/*.template into
# /etc/nginx/conf.d/. NGINX_ENVSUBST_FILTER restricts substitution to NGINX_PORT
# so nginx variables ($uri etc.) are preserved.
ENV NGINX_PORT=8080
ENV NGINX_ENVSUBST_FILTER=NGINX_PORT
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /usr/src/app/dist /usr/share/nginx/html
EXPOSE 8080
