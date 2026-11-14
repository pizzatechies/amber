#!/usr/bin/env bash
# Daily database backup. Keeps 14 days locally; also copies to S3 when
# BACKUP_BUCKET is set and the server's IAM role can write to it.
#
#   crontab -e   →   15 3 * * * /home/ubuntu/amber/deploy/aws/backup.sh >> /home/ubuntu/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p backups
file="backups/amber-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose exec -T db pg_dump -U amber amber | gzip > "$file"
find backups -name 'amber-*.sql.gz' -mtime +14 -delete
if [ -n "${BACKUP_BUCKET:-}" ]; then
  aws s3 cp "$file" "s3://$BACKUP_BUCKET/db/$(basename "$file")"
fi
echo "Backup written: $file"
