#!/usr/bin/env bash
# One-time setup so CI builds include the licensed Synty models.
#
# Creates an SSH key pair, adds the public half to the PRIVATE assets repo as a
# read-only deploy key (it can read only that one repo, nothing else), stores
# the private half as the ASSETS_DEPLOY_KEY secret of the game repo, deletes the
# local copy, then starts a release build.
#
#   bash tools/setup-assets-deploy-key.sh        (needs: gh logged in, ssh-keygen)
set -euo pipefail

GAME_REPO="Jolly-Panda-Works/Pirate-s-Fortune"
ASSETS_REPO="Jolly-Panda-Works/pirates-fortune-assets"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

ssh-keygen -q -t ed25519 -N "" -C "pirates-fortune-ci (read-only assets)" -f "$TMP/key"
gh repo deploy-key add "$TMP/key.pub" --repo "$ASSETS_REPO" --title "Pirate's Fortune CI (read-only)"
gh secret set ASSETS_DEPLOY_KEY --repo "$GAME_REPO" < "$TMP/key"
echo "Deploy key added (read-only) and ASSETS_DEPLOY_KEY secret set. Local key deleted."

gh workflow run build.yml --repo "$GAME_REPO" -f bump=patch
echo "Release build started: https://github.com/$GAME_REPO/actions/workflows/build.yml"
