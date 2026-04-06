# =============================================================================
# ProdVista Frontend — Multi-stage Dockerfile
# =============================================================================
# Organisation : Agilysys-Inc
# Repository   : prodvista-frontend
#
# Stage 1: Build the Vite React app
# Stage 2: Serve static files with nginx (~25 MB image)
#
# Build:
#   docker build --build-arg VITE_API_URL="" -t prodvista-frontend .
#
# Run locally:
#   docker run -p 3000:80 prodvista-frontend
# =============================================================================

# ---- Stage 1: Build --------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

COPY . .

# Build-time env vars — pass via --build-arg or ConfigMap
ARG VITE_API_URL=""
ARG VITE_API_BASE_PATH="/prodvista/api"
ARG VITE_API_TIMEOUT="30000"
ARG VITE_APP_TITLE="ProdVista Dashboard"
ARG VITE_AZURE_CLIENT_ID=""
ARG VITE_AZURE_TENANT_ID="common"
ARG VITE_REDIRECT_URI=""
ARG VITE_ENABLE_DEVTOOLS="false"

ENV VITE_API_URL=$VITE_API_URL \
    VITE_API_BASE_PATH=$VITE_API_BASE_PATH \
    VITE_API_TIMEOUT=$VITE_API_TIMEOUT \
    VITE_APP_TITLE=$VITE_APP_TITLE \
    VITE_AZURE_CLIENT_ID=$VITE_AZURE_CLIENT_ID \
    VITE_AZURE_TENANT_ID=$VITE_AZURE_TENANT_ID \
    VITE_REDIRECT_URI=$VITE_REDIRECT_URI \
    VITE_ENABLE_DEVTOOLS=$VITE_ENABLE_DEVTOOLS

RUN npm run build

# ---- Stage 2: Serve --------------------------------------------------------
FROM nginx:1.27-alpine AS runtime


EXPOSE 80
RUN rm -rf /usr/share/nginx/html/*

COPY ./nginx.conf /etc/nginx/nginx.conf

COPY --from=build /app/dist /usr/share/nginx/html

CMD ["nginx", "-g", "daemon off;"]
