#!/bin/bash
# pack.sh -- builds a ZIP of Capy Tab Manager (Chrome Web Store / sharing)
# Usage: ./pack.sh

set -e

OUT="CapyTabManager.zip"

echo "Packing Capy Tab Manager..."

rm -f "$OUT"

# Zip the contents of extension/ so manifest.json is at the root of the ZIP
# (required for Chrome Web Store upload and for Load unpacked).
cd extension
zip -r "../$OUT" . \
  --exclude "*.DS_Store" \
  --exclude "__MACOSX/*" \
  --exclude "*.map" \
  --exclude "*.log" \
  --exclude "config.local.js" \
  --exclude "assets/*"
cd - > /dev/null

SIZE=$(du -sh "$OUT" | cut -f1)
echo ""
echo "Done: $OUT ($SIZE)"
echo ""
echo "Chrome Web Store: upload this ZIP as the package."
echo "Or load unpacked: unzip to a folder, chrome://extensions, Developer mode, Load unpacked."
echo ""
