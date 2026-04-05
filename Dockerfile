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
ARG VITE_API_TIMEOUT="30000"
ARG VITE_APP_TITLE="ProdVista Dashboard"
ARG VITE_AZURE_CLIENT_ID=""
ARG VITE_AZURE_TENANT_ID="common"
ARG VITE_REDIRECT_URI=""
ARG VITE_ENABLE_DEVTOOLS="false"

ENV VITE_API_URL=$VITE_API_URL \
    VITE_API_TIMEOUT=$VITE_API_TIMEOUT \
    VITE_APP_TITLE=$VITE_APP_TITLE \
    VITE_AZURE_CLIENT_ID=$VITE_AZURE_CLIENT_ID \
    VITE_AZURE_TENANT_ID=$VITE_AZURE_TENANT_ID \
    VITE_REDIRECT_URI=$VITE_REDIRECT_URI \
    VITE_ENABLE_DEVTOOLS=$VITE_ENABLE_DEVTOOLS

RUN npm run build

# ---- Stage 2: Serve --------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

RUN dnf install -y nginx && dnf clean all

COPY --from=build /app/dist /usr/share/nginx/html

# SPA fallback + reverse-proxy config
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    gzip on;\n\
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;\n\
    gzip_min_length 256;\n\
\n\
    location /assets/ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
\n\
    location /api/ {\n\
        proxy_pass http://prodvista-server:8080;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n\
        proxy_set_header X-Forwarded-Proto $scheme;\n\
        proxy_read_timeout 120s;\n\
    }\n\
\n\
    location /hubs/ {\n\
        proxy_pass http://prodvista-server:8080;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Upgrade $http_upgrade;\n\
        proxy_set_header Connection "upgrade";\n\
        proxy_set_header Host $host;\n\
        proxy_read_timeout 86400s;\n\
    }\n\
\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
