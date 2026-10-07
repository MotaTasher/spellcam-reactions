#!/bin/sh
# Кладёт внешние скрипты в vendor/, чтобы страница не зависела от CDN и telegram.org
# (из части сетей они не открываются, и страница висит на загрузке).
set -e
cd "$(dirname "$0")/.."
MP=https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1
mkdir -p vendor/mediapipe/wasm
curl -fsSL -o vendor/mediapipe/vision_bundle.mjs "$MP/vision_bundle.mjs"
for f in vision_wasm_internal.js vision_wasm_internal.wasm vision_wasm_nosimd_internal.js vision_wasm_nosimd_internal.wasm; do
  curl -fsSL -o "vendor/mediapipe/wasm/$f" "$MP/wasm/$f"
done
du -sh vendor
