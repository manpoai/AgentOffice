#!/bin/bash
# 等 MinIO 就绪后创建 outline bucket
set -e

echo "Waiting for MinIO..."
until docker compose -f "$(dirname "$0")/../docker-compose.yml" exec -T minio mc alias set local http://localhost:9000 "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" 2>/dev/null; do
  sleep 2
done

docker compose -f "$(dirname "$0")/../docker-compose.yml" exec -T minio \
  mc mb --ignore-existing local/outline

echo "MinIO bucket 'outline' ready."
