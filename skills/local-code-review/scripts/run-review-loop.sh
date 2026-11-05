#!/usr/bin/env bash
# ==============================================================================
# Local PR Code Reviewer (Local Pi Engine - Strictly Read-Only)
# ==============================================================================
# Usage:
#   bash run-review-loop.sh [PR_NUMBER] [--watch]
#
# Reviews a GitHub PR using local Pi CLI without modifying any files.
# Posts formal reviews via dev-loops gate upsert-verdict (or gh pr comment).
# ==============================================================================

set -euo pipefail

# ANSI color helpers for terminal readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $*"
}

# Determine script & skill locations
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Target repository root
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "${REPO_ROOT}"

# Parse Arguments
PR_NUMBER=""
WATCH_MODE=false

for arg in "$@"; do
  case "$arg" in
    --watch|-w)
      WATCH_MODE=true
      ;;
    *)
      if [ -z "$PR_NUMBER" ] && [[ "$arg" =~ ^[0-9]+$ ]]; then
        PR_NUMBER="$arg"
      fi
      ;;
  esac
done

if [ -z "$PR_NUMBER" ]; then
  log_info "No PR number passed as argument. Attempting auto-detection via gh CLI..."
  PR_NUMBER=$(gh pr view --json number -q .number 2>/dev/null || echo "")
fi

if [ -z "$PR_NUMBER" ]; then
  log_error "Failed to detect PR number. Usage: $0 [PR_NUMBER] [--watch]"
  exit 1
fi

# Detect repository slug (owner/repo)
REPO_SLUG=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
log_info "Repository: ${REPO_SLUG:-unknown}, Pull Request #${PR_NUMBER}"

# Locate dev-loops CLI (from npm:dev-loops package)
DEV_LOOPS_CMD=""
if command -v dev-loops >/dev/null 2>&1; then
  DEV_LOOPS_CMD="dev-loops"
elif [ -f "$HOME/.pi/agent/npm/node_modules/.bin/dev-loops" ]; then
  DEV_LOOPS_CMD="$HOME/.pi/agent/npm/node_modules/.bin/dev-loops"
elif [ -f "$HOME/.pi/agent/npm/node_modules/dev-loops/cli/index.mjs" ]; then
  DEV_LOOPS_CMD="node $HOME/.pi/agent/npm/node_modules/dev-loops/cli/index.mjs"
elif [ -f "${REPO_ROOT}/node_modules/.bin/dev-loops" ]; then
  DEV_LOOPS_CMD="${REPO_ROOT}/node_modules/.bin/dev-loops"
fi

if [ -n "$DEV_LOOPS_CMD" ]; then
  log_info "Found dev-loops package CLI: ${DEV_LOOPS_CMD}"
else
  log_info "dev-loops CLI not detected; will use standard gh CLI fallback for reviews and comments."
fi

REVIEWER_PROMPT_FILE="${SKILL_DIR}/prompts/reviewer-prompt.md"

# Validate prompt exists
if [ ! -f "$REVIEWER_PROMPT_FILE" ]; then
  log_error "Reviewer prompt file not found at: $REVIEWER_PROMPT_FILE"
  exit 1
fi

# Cleanup helper for temporary files
cleanup_temp_files() {
  rm -f "${REPO_ROOT}/.pr_review.diff" \
        "${REPO_ROOT}/.review_output.md" \
        "${REPO_ROOT}/.devloops_findings.txt" \
        "${REPO_ROOT}/.temp_*" 2>/dev/null || true
}

cleanup_temp_files

run_review_pass() {
  local head_sha
  head_sha=$(gh pr view "$PR_NUMBER" --json headRefOid -q .headRefOid 2>/dev/null || git rev-parse HEAD)
  log_info "Reviewing PR #${PR_NUMBER} at Head Commit SHA: ${head_sha}"

  # Step 1: Extract PR git diff
  log_info "Capturing PR diff via 'gh pr diff ${PR_NUMBER}'..."
  gh pr diff "$PR_NUMBER" > "${REPO_ROOT}/.pr_review.diff"

  if [ ! -s "${REPO_ROOT}/.pr_review.diff" ]; then
    log_warn "PR diff is empty. No changes detected on this Pull Request."
    gh pr comment "$PR_NUMBER" --body "⚠️ **[Pi Local Review]** The PR diff is empty. No files changed to review."
    cleanup_temp_files
    return 0
  fi

  # Step 2: Invoke Strictly Read-Only Code Reviewer
  log_info "Invoking Code Reviewer (Strictly Read-Only with tools: read,grep,find,ls)..."

  REVIEWER_TASK="You are the Senior Staff Code Reviewer.
Analyze the Pull Request diff located in '.pr_review.diff'.
You may inspect files across the repository for full context using read, grep, find, and ls.
You are strictly READ-ONLY. Do NOT edit, write, or modify any files.
Follow all instructions in your system prompt.
Your output must end with the exact line: RATING: X/5"

  pi --no-session --approve --tools read,grep,find,ls \
     --append-system-prompt "${REVIEWER_PROMPT_FILE}" \
     -p "${REVIEWER_TASK}" > "${REPO_ROOT}/.review_output.md" 2>&1 || true

  if [ ! -s "${REPO_ROOT}/.review_output.md" ]; then
    log_error "Reviewer generated an empty review output!"
    cleanup_temp_files
    return 1
  fi

  # Step 3: Parse Rating
  local rating_line=""
  local score=1
  set +e
  rating_line=$(grep -E '^RATING: [1-5]/5' "${REPO_ROOT}/.review_output.md" | tail -n 1)
  if [ -z "$rating_line" ]; then
    rating_line=$(grep -ioE 'RATING:\s*[1-5]/5' "${REPO_ROOT}/.review_output.md" | head -n 1 | tr '[:lower:]' '[:upper:]')
  fi
  set -e

  if [ -z "$rating_line" ]; then
    log_warn "Could not parse rating. Defaulting to 1/5 for safety."
    score=1
    rating_line="RATING: 1/5"
  else
    score=$(echo "$rating_line" | sed -E 's/.*RATING:[[:space:]]*([1-5])\/5.*/\1/')
  fi

  log_info "Review Result: ${rating_line} (Score: ${score})"

  # Step 4: Submit Review using dev-loops gate upsert-verdict (or gh fallback)
  if [ -n "$DEV_LOOPS_CMD" ]; then
    local verdict="findings_present"
    if [ "$score" -eq 5 ]; then
      verdict="clean"
    fi

    log_info "Submitting formal GitHub Review via dev-loops gate upsert-verdict (verdict: ${verdict})..."
    sed -E '/^RATING: [1-5]\/5/d' "${REPO_ROOT}/.review_output.md" | head -c 1900 > "${REPO_ROOT}/.devloops_findings.txt"

    set +e
    $DEV_LOOPS_CMD gate upsert-verdict \
      --pr "$PR_NUMBER" \
      --head "$head_sha" \
      --verdict "$verdict" \
      --findings-file "${REPO_ROOT}/.devloops_findings.txt" \
      --allowed-refs "github-actions[bot],dev-loops,pi"
    local dev_loops_status=$?
    set -e

    if [ $dev_loops_status -ne 0 ]; then
      log_warn "dev-loops gate upsert-verdict returned status $dev_loops_status. Falling back to gh pr comment."
      gh pr comment "$PR_NUMBER" --body-file "${REPO_ROOT}/.review_output.md"
    fi
  else
    log_info "Posting review comment via 'gh pr comment'..."
    gh pr comment "$PR_NUMBER" --body-file "${REPO_ROOT}/.review_output.md"
  fi

  # Step 5: Output Review to Terminal for the Developer/Agent
  echo ""
  log_info "========================= REVIEW FEEDBACK ========================="
  cat "${REPO_ROOT}/.review_output.md"
  echo ""
  log_info "==================================================================="

  cleanup_temp_files

  if [ "$score" -eq 5 ]; then
    log_success "🎉 PR #${PR_NUMBER} received a 5/5 clean rating!"
    return 0
  else
    log_warn "PR #${PR_NUMBER} received ${rating_line}. Please have your coding agent resolve the issues above."
    return 2
  fi
}

# Main Execution Flow
if [ "$WATCH_MODE" = false ]; then
  set +e
  run_review_pass
  STATUS=$?
  set -e
  if [ $STATUS -eq 0 ]; then
    exit 0
  elif [ $STATUS -eq 2 ]; then
    exit 1
  else
    exit $STATUS
  fi
fi

# Watch Mode: Continuously re-review when the user's agent pushes new commits
log_info "Running in --watch mode. Watching PR #${PR_NUMBER} for new commits from your coding agent..."
LAST_SHA=""

while true; do
  CURRENT_SHA=$(gh pr view "$PR_NUMBER" --json headRefOid -q .headRefOid 2>/dev/null || echo "")

  if [ -n "$CURRENT_SHA" ] && [ "$CURRENT_SHA" != "$LAST_SHA" ]; then
    log_info "Detected new commit on PR #${PR_NUMBER} (${CURRENT_SHA:0:7}). Triggering review..."
    LAST_SHA="$CURRENT_SHA"

    set +e
    run_review_pass
    STATUS=$?
    set -e

    if [ $STATUS -eq 0 ]; then
      log_success "PR #${PR_NUMBER} is now clean (5/5). Exiting watch mode."
      exit 0
    fi
  fi

  sleep 15
done
