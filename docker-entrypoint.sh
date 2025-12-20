#!/bin/sh
set -e

# Init directory if it doesn't exist (only works if we have permissions, e.g. root or correct user)
# We assume if running as non-root, the volume is already correctly set up or we don't need to init
if [ "$(id -u)" = "0" ] && [ ! -d "/app/prisma" ]; then
    mkdir -p /app/prisma
fi

# Fix permissions on the mounted volume IF running as root
if [ "$(id -u)" = "0" ]; then
    chown -R nextjs:nodejs /app/prisma
fi

# Sync the database schema
echo "Syncing database..."
if [ "$(id -u)" = "0" ]; then
    su-exec nextjs:nodejs /app/prisma-cli/node_modules/.bin/prisma db push --skip-generate --schema /app/prisma-schema/schema.prisma
else
    /app/prisma-cli/node_modules/.bin/prisma db push --skip-generate --schema /app/prisma-schema/schema.prisma
fi

# Start the application
echo "Starting application..."
if [ "$(id -u)" = "0" ]; then
    exec su-exec nextjs:nodejs node server.js
else
    exec node server.js
fi
