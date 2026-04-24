#!/bin/bash
# pack.sh ¡X builds a clean, shareable ZIP of Island Tab Manager
# Usage: ./pack.sh

set -e

OUT="IslandTabManager.zip"

echo "? Packing Island Tab Manager..."

# Remove old zip if it exists
rm -f "$OUT"

# Zip the CONTENTS of extension/ so manifest.json is at the root of the ZIP.
# This means friends can unzip and point Chrome at the resulting folder directly
# (no need to navigate into a subfolder).
cd extension
zip -r "../$OUT" . \
  --exclude "*.DS_Store" \
  --exclude "__MACOSX/*" \
  --exclude "*.map" \
  --exclude "*.log"
cd ..

SIZE=$(du -sh "$OUT" | cut -f1)
echo ""
echo "? Done! ¡÷ $OUT ($SIZE)"
echo ""
echo "Share this ZIP with friends."
echo "They just need to:"
echo "  1. Unzip it into a permanent folder"
echo "  2. Go to chrome://extensions"
echo "  3. Enable Developer Mode"
echo "  4. Click 'Load unpacked' ¡÷ select the unzipped folder"
echo ""
echo "That's it ¡X the shopkeeper is now watching over their tabs, hm hm! ??"
