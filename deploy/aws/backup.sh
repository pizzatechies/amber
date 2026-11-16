#!/usr/bin/env bash
# Daily database backup. Keeps 14 days locally; also copies to S3 when
# BACKUP_BUCKET is set and the server's IAM role can write to it.
#
#   crontab -e   →   15 3 * * * /home/ubuntu/amber/deploy/aws/backup.sh >> /home/ubuntu/backup.log 2>&1
set -euo pipefail
# Scheduled jobs run with a minimal PATH; add where Docker and the AWS CLI (snap) live.
export PATH="$PATH:/usr/local/bin:/usr/bin:/bin:/snap/bin"
cd "$(dirname "$0")"
mkdir -p backups
file="backups/amber-$(date +%Y%m%d-%H%M%S).sql.gz"
# Write to a temporary file and only keep it if the dump succeeded.
trap 'rm -f "$file.partial"' EXIT
docker compose exec -T db pg_dump -U amber amber | gzip > "$file.partial"
if [ "$(stat -c %s "$file.partial")" -lt 1000 ]; then
  echo "Backup looks empty; keeping the existing backups." >&2
  exit 1
fi
mv "$file.partial" "$file"
find backups -name 'amber-*.sql.gz' -mtime +14 -delete
if [ -n "${BACKUP_BUCKET:-}" ]; then
  aws s3 cp "$file" "s3://$BACKUP_BUCKET/db/$(basename "$file")"
fi
echo "Backup written: $file"
