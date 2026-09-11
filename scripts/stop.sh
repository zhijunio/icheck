#!/usr/bin/env bash

set -euo pipefail

PORT="${PORT:-3000}"
PIDS="$(lsof -ti "tcp:${PORT}" || true)"

if [ -z "$PIDS" ]; then
  echo "端口 ${PORT} 没有运行中的服务"
  exit 0
fi

echo "停止端口 ${PORT} 上的进程：${PIDS}"
kill $PIDS