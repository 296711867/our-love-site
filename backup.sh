#!/usr/bin/env bash
# 每周打包 数据库 + 照片，保留最近 8 份
set -e
cd "$(dirname "$0")"
mkdir -p backups
f="backups/love-site-$(date +%Y%m%d-%H%M).tar.gz"
tar czf "$f" data uploads docker-compose.yml
ls -1t backups/love-site-*.tar.gz | tail -n +9 | xargs -r rm -f
echo "[$(date '+%F %T')] 备份完成: $f"
