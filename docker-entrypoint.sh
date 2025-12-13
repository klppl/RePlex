#!/bin/sh
set -e

# Fix permissions on the mounted volume
if [ -d "/app/prisma" ]; then
    chown -R nextjs:nodejs /app/prisma
fi

# Sync the database schema
echo "Syncing database..."
/app/prisma-cli/node_modules/.bin/prisma db push --skip-generate

# Start the application
echo "Starting application..."
exec su-exec nextjs:nodejs node server.js
