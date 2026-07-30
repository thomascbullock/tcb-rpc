#!/usr/bin/env bash
#
# Periodic backup of the post + image data directories to a separate git
# checkout, which is then committed and pushed. Designed to run from cron
# (recommended: hourly). Idempotent — commits nothing if nothing changed.
#
# Layout assumed on the server (see DEPLOY.md):
#   $DATA_DIR    (source, writable by the node process)
#     posts/     (markdown files)
#     img/       (uploaded images)
#   $BACKUP_DIR  (target, a git checkout tracking the same origin as the
#                 code checkout — but only ever touched by this script)
#     posts/
#     img/
#     .git/
#
# Config: override via environment or edit the defaults below.
#
set -euo pipefail

DATA_DIR="${DATA_DIR:-/var/lib/tcb-rpc}"
BACKUP_DIR="${BACKUP_DIR:-/var/lib/tcb-rpc/backup}"

if [ ! -d "$DATA_DIR/posts" ] || [ ! -d "$DATA_DIR/img" ]; then
    echo "backup-posts: DATA_DIR missing posts/ or img/ ($DATA_DIR)" >&2
    exit 1
fi
if [ ! -d "$BACKUP_DIR/.git" ]; then
    echo "backup-posts: BACKUP_DIR is not a git checkout ($BACKUP_DIR)" >&2
    echo "  Initialise it with: git clone <repo> $BACKUP_DIR" >&2
    exit 1
fi

mkdir -p "$BACKUP_DIR/posts" "$BACKUP_DIR/img"

# --delete keeps the backup in sync with reality — a deleted post disappears
# from the mirror on the next run.
rsync -a --delete "$DATA_DIR/posts/" "$BACKUP_DIR/posts/"
rsync -a --delete "$DATA_DIR/img/"   "$BACKUP_DIR/img/"

cd "$BACKUP_DIR"

git add posts/ img/
if git diff --cached --quiet; then
    exit 0
fi

git commit -m "backup: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >/dev/null

# Push is best-effort. If offline or origin is down, the commit stays local
# and pushes next time.
if ! git push --quiet 2>/dev/null; then
    echo "backup-posts: push failed; commit is local at $(git rev-parse --short HEAD)" >&2
fi
