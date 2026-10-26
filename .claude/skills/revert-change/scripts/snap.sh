#!/usr/bin/env bash
# Working-tree snapshots for "undo what you just implemented".
# Snapshots are commit objects under refs/snapshots/ (local only, never pushed).
# They never touch HEAD, branches, or the index.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
PREFIX=refs/snapshots

# Commit object holding every tracked + untracked (non-ignored) file as it is on disk now.
capture() {
  local msg=$1 tmp
  tmp=$(mktemp)
  rm -f "$tmp"
  GIT_INDEX_FILE=$tmp git add -A
  local tree
  tree=$(GIT_INDEX_FILE=$tmp git write-tree)
  rm -f "$tmp"
  git commit-tree "$tree" -p HEAD -m "$msg"
}

slug() { echo "$1" | tr -cs '[:alnum:]가-힣' '-' | sed 's/^-//; s/-$//' | cut -c1-40; }

resolve() {
  local id=${1:-}
  if [ -z "$id" ]; then
    # Latest snapshot that isn't an automatic pre-restore one.
    git for-each-ref --sort=-creatordate --format='%(refname)' "$PREFIX/" | grep -v '/pre-restore-' | head -1
  elif git show-ref --verify --quiet "$PREFIX/$id"; then
    echo "$PREFIX/$id"
  else
    echo "no snapshot: $id" >&2; exit 2
  fi
}

case "${1:-}" in
  save)
    label=${2:?usage: snap.sh save "<what is about to change>"}
    id="$(date +%Y%m%d-%H%M%S)-$(slug "$label")"
    git update-ref "$PREFIX/$id" "$(capture "$label")"
    echo "saved $id"
    ;;
  list)
    git for-each-ref --sort=-creatordate --format='%(refname:lstrip=2)  %(creatordate:format:%m-%d %H:%M)  %(contents:subject)' "$PREFIX/" | head -${2:-15}
    ;;
  diff)
    # What restore would change: A = created since snapshot (will be deleted), M/D = restored.
    ref=$(resolve "${2:-}")
    [ -n "$ref" ] || { echo "no snapshots" >&2; exit 2; }
    echo "snapshot: ${ref#$PREFIX/} — $(git log -1 --format=%s "$ref")"
    git diff --no-renames --name-status "$ref" "$(capture current)"
    ;;
  restore)
    ref=$(resolve "${2:-}")
    [ -n "$ref" ] || { echo "no snapshots" >&2; exit 2; }
    shift 2 || shift $#
    [ "${1:-}" = "--" ] && shift
    paths=("$@")
    now=$(capture "pre-restore of ${ref#$PREFIX/}")
    backup="pre-restore-$(date +%Y%m%d-%H%M%S)"
    git update-ref "$PREFIX/$backup" "$now"
    changed=0
    while IFS=$'\t' read -r status path; do
      [ -z "$path" ] && continue
      if [ ${#paths[@]} -gt 0 ]; then
        keep=0; for p in "${paths[@]}"; do [[ "$path" == "$p" || "$path" == "$p"/* ]] && keep=1; done
        [ $keep = 1 ] || continue
      fi
      case "$status" in
        A) rm -f -- "$path"; echo "removed  $path" ;;
        *) mkdir -p "$(dirname "$path")"; git show "$ref:$path" > "$path"; echo "restored $path" ;;
      esac
      changed=$((changed + 1))
    done < <(git diff --no-renames --name-status "$ref" "$now")
    echo "$changed file(s) back to ${ref#$PREFIX/}. undo this restore: snap.sh restore $backup"
    ;;
  *)
    echo "usage: snap.sh save <label> | list [n] | diff [id] | restore [id] [-- paths...]" >&2; exit 1
    ;;
esac
