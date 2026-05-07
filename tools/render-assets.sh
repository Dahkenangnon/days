#!/usr/bin/env bash
#
# Regenerate brand-asset PNGs from their SVG sources.
#
# Outputs:
#   assets/banner.png        ← assets/banner.svg        (1200×420)
#   assets/og-image.png      ← assets/og-image.svg      (1280×640)
#   assets/logo-512.png      ← assets/logo.svg          (512×512)
#
#   packages/data/banner.png             (deploys to days.claviscore.com)
#   packages/data/banner-square.png      (deploys, 1200×1200)
#   packages/data/og-image.png           (deploys, used as og:image)
#   packages/data/favicon-32.png         (deploys, 32×32)
#   packages/data/favicon-192.png        (deploys, 192×192)
#   packages/data/apple-touch-icon.png   (deploys, 512×512 from logo.svg)
#
# Requires: rsvg-convert (librsvg). Install:
#   Debian/Ubuntu: sudo apt install librsvg2-bin
#   macOS:         brew install librsvg
#
# Usage: pnpm render-assets   (or run this script directly from repo root)

set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v rsvg-convert >/dev/null; then
  echo "error: rsvg-convert not found — install librsvg2-bin (Linux) or librsvg (macOS)" >&2
  exit 1
fi

mkdir -p assets packages/data

# ─── assets/ — canonical PNG renders kept in git for press / GitHub upload ───
rsvg-convert -w 1200          assets/banner.svg          -o assets/banner.png
rsvg-convert -w 1280 -h  640  assets/og-image.svg        -o assets/og-image.png
rsvg-convert -w  512          assets/logo.svg            -o assets/logo-512.png

# ─── packages/data/ — deploys to days.claviscore.com via Cloudflare Pages ───
rsvg-convert -w 1200          assets/banner.svg          -o packages/data/banner.png
rsvg-convert -w 1200 -h 1200  assets/banner-square.svg   -o packages/data/banner-square.png
rsvg-convert -w 1280 -h  640  assets/og-image.svg        -o packages/data/og-image.png
rsvg-convert -w   32          assets/favicon.svg         -o packages/data/favicon-32.png
rsvg-convert -w  192          assets/favicon.svg         -o packages/data/favicon-192.png
rsvg-convert -w  512          assets/logo.svg            -o packages/data/apple-touch-icon.png

echo "✓ assets re-rendered"
ls -la assets/*.png packages/data/*.png 2>&1
