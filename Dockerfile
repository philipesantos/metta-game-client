# syntax=docker/dockerfile:1.7

ARG BUILDPLATFORM
ARG TARGETPLATFORM

# Stage 1: Build the React app on the runner's native architecture.
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

RUN apk add --no-cache gzip

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
RUN npm run build

# Stage 2: Serve with NGINX
FROM --platform=$TARGETPLATFORM nginx:1.25-alpine

RUN rm -rf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html
COPY deployment/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
