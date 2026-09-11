#!/usr/bin/env bash

set -euo pipefail

export AI_API_KEY="${AI_API_KEY:?请先设置 AI_API_KEY}"
export AI_BASE_URL="${AI_BASE_URL:-https://ai-router.dmall.com/v1}"
export AI_MODEL="${AI_MODEL:-gpt-5.6-luna}"

npm run dev
