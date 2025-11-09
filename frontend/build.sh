#!/bin/bash
set -e

echo "Setting executable permissions for node_modules binaries..."
find node_modules/.bin -type f -exec chmod +x {} \; 2>/dev/null || true

echo "Running vite build..."
exec node node_modules/vite/bin/vite.js build