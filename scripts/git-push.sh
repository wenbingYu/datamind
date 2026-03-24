#!/bin/bash
# Git push 定时任务脚本

REPO_DIR="/Users/wenbing/.openclaw/workspace"
LOG_FILE="$REPO_DIR/scripts/git-push.log"

cd "$REPO_DIR" || exit 1

# 检查是否有未推送的提交
LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git rev-parse origin/main 2>/dev/null)

if [ "$LOCAL" != "$REMOTE" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 尝试推送..." >> "$LOG_FILE"
    
    # 尝试推送
    git push origin main 2>&1 >> "$LOG_FILE"
    
    if [ $? -eq 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 推送成功" >> "$LOG_FILE"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ 推送失败" >> "$LOG_FILE"
    fi
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 无新提交，跳过" >> "$LOG_FILE"
fi