#!/bin/sh
# =============================================================================
# Runtime Config Injection for Vite SPA
# =============================================================================
# Replaces placeholder values in built JS files with ConfigMap environment vars
# This enables runtime configuration without rebuilding the image
# =============================================================================

set -e

echo "[entrypoint] Injecting runtime configuration..."

# Find the main JS bundle
JS_DIR="/usr/share/nginx/html/assets"

# Replace environment variable placeholders in JS files
for file in "$JS_DIR"/*.js; do
  if [ -f "$file" ]; then
    # Replace VITE_AZURE_CLIENT_ID placeholder
    if [ -n "$VITE_AZURE_CLIENT_ID" ]; then
      sed -i "s|your-client-id|$VITE_AZURE_CLIENT_ID|g" "$file"
      echo "[entrypoint] Injected VITE_AZURE_CLIENT_ID"
    fi
    
    # Replace VITE_AZURE_TENANT_ID placeholder
    if [ -n "$VITE_AZURE_TENANT_ID" ]; then
      sed -i "s|your-tenant-id|$VITE_AZURE_TENANT_ID|g" "$file"
      echo "[entrypoint] Injected VITE_AZURE_TENANT_ID"
    fi
    
    # NOTE: VITE_REDIRECT_URI is no longer injected via sed.
    # The redirect URI is computed at runtime from window.location.origin + VITE_BASE_PATH
    # This avoids corrupting window.location.origin used by MSAL.js and other libraries.
  fi
done

echo "[entrypoint] Configuration injection complete. Starting nginx..."

# Execute the original nginx command
exec "$@"
