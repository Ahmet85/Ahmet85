#!/usr/bin/env bash
# Ritim'i (kutucuklar) GitHub Pages yayın dalının ritim-kutu/ klasörüne koyar. Başka dosyaya dokunmaz.
set -euo pipefail
PAGES_BRANCH="claude/octopus-mobile-game-0is63u"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$HERE" rev-parse --show-toplevel)"
SRC="$(git -C "$REPO" rev-parse --short HEAD)"
WT="$(mktemp -d)"
node --test "$HERE/tests/core.test.js" > /dev/null
git -C "$REPO" fetch -q origin "$PAGES_BRANCH"
git -C "$REPO" worktree add -q "$WT" "origin/$PAGES_BRANCH" --detach
rm -rf "$WT/ritim-kutu"
mkdir "$WT/ritim-kutu"
cp -R "$HERE"/{index.html,styles.css,core.js,data.js,app.js,sw.js,manifest.webmanifest,fonts,icons} "$WT/ritim-kutu/"
git -C "$WT" add ritim-kutu
if git -C "$WT" diff --cached --quiet; then echo "Yayında değişiklik yok."; else
  git -C "$WT" commit -q -m "Ritim kutucuklar yayını ($SRC)"
  git -C "$WT" push -q origin "HEAD:$PAGES_BRANCH" && echo "Yayınlandı: $SRC"
fi
git -C "$REPO" worktree remove "$WT" --force
