#!/usr/bin/env bash
# Ritim'i derleyip GitHub Pages yayın dalının ritim/ klasörüne koyar.
# Okto'nun dosyalarına dokunmaz. Adres: https://ahmet85.github.io/Ahmet85/ritim/
set -euo pipefail
PAGES_BRANCH="claude/octopus-mobile-game-0is63u"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(git -C "$HERE" rev-parse --show-toplevel)"
SRC_COMMIT="$(git -C "$REPO" rev-parse --short HEAD)"
WT="$(mktemp -d)"

(cd "$HERE" && npm test && npm run build)

git -C "$REPO" fetch origin "$PAGES_BRANCH"
git -C "$REPO" worktree add "$WT" "origin/$PAGES_BRANCH" --detach
rm -rf "$WT/ritim"
cp -R "$HERE/dist" "$WT/ritim"
git -C "$WT" add ritim
if git -C "$WT" diff --cached --quiet; then
  echo "Yayında değişiklik yok."
else
  git -C "$WT" commit -m "Ritim yayını ($SRC_COMMIT)"
  git -C "$WT" push origin "HEAD:$PAGES_BRANCH"
fi
git -C "$REPO" worktree remove "$WT" --force
