#!/bin/sh
set -e

echo "Running Prisma migrations..."
/app/node_modules/.bin/prisma migrate deploy --schema=/app/prisma/schema.prisma

echo "Starting API server..."
exec "$@"
