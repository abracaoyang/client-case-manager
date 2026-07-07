#!/bin/bash
cd "$(dirname "$0")"
BACKUP_DIR="Backups/Backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp index.html "$BACKUP_DIR/"
cp code.gs "$BACKUP_DIR/"
if [ -f .gitignore ]; then
  cp .gitignore "$BACKUP_DIR/"
fi
echo "========================================="
echo "  客戶案件管理系統 - 版本備份成功！"
echo "  備份路徑: $BACKUP_DIR/"
echo "========================================="
sleep 2
