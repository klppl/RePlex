#!/bin/sh
set -e

# Init directory if it doesn't exist (if volume not mounted)
if [ ! -d "/app/prisma" ]; then
    mkdir -p /app/prisma
fi

# Fix permissions on the mounted volume
chown -R nextjs:nodejs /app/prisma

# Sync the database schema
echo "Syncing database..."
su-exec nextjs:nodejs /app/prisma-cli/node_modules/.bin/prisma db push --skip-generate --schema /app/prisma-schema/schema.prisma

# Start the application
echo "Starting application..."
exec su-exec nextjs:nodejs node server.js
