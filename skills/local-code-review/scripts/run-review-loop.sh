#!/usr/bin/env bash
# ==============================================================================
# Local PR Review & Self-Healing Loop (Local Pi Engine - Zero API Key Cost)
# ==============================================================================
# Usage:
#   bash run-review-loop.sh <PR_NUMBER>
# Or inside a git repository on a PR branch:
#   bash run-review-loop.sh
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

# Determine PR Number
PR_NUMBER="${1:-}"
if [ -z "$PR_NUMBER" ]; then
  log_info "No PR number passed as argument. Attempting auto-detection via gh CLI..."
  PR_NUMBER=$(gh pr view --json number -q .number 2>/dev/null || echo "")
fi

if [ -z "$PR_NUMBER" ]; then
  log_error "Failed to detect PR number. Usage: $0 <PR_NUMBER>"
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

# Configuration
MAX_LOOPS="${MAX_LOOPS:-5}"
PASS=1
REVIEWER_PROMPT_FILE="${SKILL_DIR}/prompts/reviewer-prompt.md"
CODER_PROMPT_FILE="${SKILL_DIR}/prompts/coder-prompt.md"

# Validate prompts exist
if [ ! -f "$REVIEWER_PROMPT_FILE" ]; then
  log_error "Reviewer prompt file not found at: $REVIEWER_PROMPT_FILE"
  exit 1
fi

if [ ! -f "$CODER_PROMPT_FILE" ]; then
  log_error "Coder prompt file not found at: $CODER_PROMPT_FILE"
  exit 1
fi

# Ensure git credentials are configured
if ! git config user.name >/dev/null 2>&1; then
  git config user.name "pi-review-bot"
fi
if ! git config user.email >/dev/null 2>&1; then
  git config user.email "pi-review-bot@local.dev"
fi

# Cleanup helper for temporary files
cleanup_temp_files() {
  rm -f "${REPO_ROOT}/.pr_review.diff" \
        "${REPO_ROOT}/.review_output.md" \
        "${REPO_ROOT}/.coder_output.md" \
        "${REPO_ROOT}/.devloops_findings.txt" \
        "${REPO_ROOT}/.pr_comment_payload.md" \
        "${REPO_ROOT}/.temp_*" 2>/dev/null || true
}

# Ensure clean slate at start
cleanup_temp_files

# Make sure we are on the PR's head branch
log_info "Checking out head branch for PR #${PR_NUMBER}..."
gh pr checkout "$PR_NUMBER"

# ==============================================================================
# MAIN REVIEW & SELF-HEALING LOOP
# ==============================================================================
while [ "$PASS" -le "$MAX_LOOPS" ]; do
  echo ""
  log_info "===================================================================="
  log_info "Starting Code Review & Self-Healing Pass #${PASS} (Max: ${MAX_LOOPS})"
  log_info "===================================================================="

  cleanup_temp_files

  # Get PR head commit SHA for dev-loops review anchoring
  HEAD_SHA=$(git rev-parse HEAD)
  log_info "Current PR Head Commit SHA: ${HEAD_SHA}"

  # Step 1: Extract PR git diff
  log_info "Capturing PR diff via 'gh pr diff ${PR_NUMBER}'..."
  gh pr diff "$PR_NUMBER" > "${REPO_ROOT}/.pr_review.diff"

  if [ ! -s "${REPO_ROOT}/.pr_review.diff" ]; then
    log_warn "PR diff is empty. No changes detected on this Pull Request."
    gh pr comment "$PR_NUMBER" --body "⚠️ **[Pi Local Review Pass #${PASS}]** The PR diff is empty. No files changed to review."
    cleanup_temp_files
    exit 0
  fi

  # Step 2: Invoke Agent 1 (Strictly Read-Only Code Reviewer)
  log_info "Invoking Agent 1 (Strictly Read-Only Reviewer with tools: read,grep,find,ls)..."

  REVIEWER_TASK="You are Agent 1 (Senior Staff Code Reviewer).
Analyze the Pull Request diff located in '.pr_review.diff'.
You may inspect files across the repository for full context using read, grep, find, and ls.
Remember: You are strictly READ-ONLY. Do NOT edit or write any files.
Follow all instructions in your system prompt.
Your output must end with the exact line: RATING: X/5"

  pi --no-session --approve --tools read,grep,find,ls \
     --append-system-prompt "${REVIEWER_PROMPT_FILE}" \
     -p "${REVIEWER_TASK}" > "${REPO_ROOT}/.review_output.md" 2>&1 || true

  if [ ! -s "${REPO_ROOT}/.review_output.md" ]; then
    log_error "Agent 1 generated an empty review output!"
    exit 1
  fi

  # Step 3: Parse Rating with Gatekeeper Regex
  set +e
  RATING_LINE=$(grep -E '^RATING: [1-5]/5' "${REPO_ROOT}/.review_output.md" | tail -n 1)
  set -e

  if [ -z "$RATING_LINE" ]; then
    log_warn "Exact 'RATING: X/5' line not found in Agent 1 output. Inspecting output for rating fallback..."
    set +e
    RATING_LINE=$(grep -ioE 'RATING:\s*[1-5]/5' "${REPO_ROOT}/.review_output.md" | head -n 1 | tr '[:lower:]' '[:upper:]')
    set -e
  fi

  if [ -z "$RATING_LINE" ]; then
    log_warn "Could not parse rating. Defaulting to 1/5 for safety."
    SCORE=1
    RATING_LINE="RATING: 1/5"
  else
    SCORE=$(echo "$RATING_LINE" | sed -E 's/.*RATING:[[:space:]]*([1-5])\/5.*/\1/')
  fi

  log_info "Gatekeeper Check: Agent 1 awarded ${RATING_LINE} (Score: ${SCORE})"

  # Step 4: Submit Review using dev-loops gate upsert-verdict (or gh fallback)
  if [ -n "$DEV_LOOPS_CMD" ]; then
    VERDICT="findings_present"
    if [ "$SCORE" -eq 5 ]; then
      VERDICT="clean"
    fi

    log_info "Submitting formal GitHub Review via dev-loops gate upsert-verdict (verdict: ${VERDICT})..."
    sed -E '/^RATING: [1-5]\/5/d' "${REPO_ROOT}/.review_output.md" | head -c 1900 > "${REPO_ROOT}/.devloops_findings.txt"

    set +e
    $DEV_LOOPS_CMD gate upsert-verdict \
      --pr "$PR_NUMBER" \
      --head "$HEAD_SHA" \
      --verdict "$VERDICT" \
      --findings-file "${REPO_ROOT}/.devloops_findings.txt" \
      --allowed-refs "github-actions[bot],dev-loops,pi"
    DEV_LOOPS_STATUS=$?
    set -e

    if [ $DEV_LOOPS_STATUS -ne 0 ]; then
      log_warn "dev-loops gate upsert-verdict returned status $DEV_LOOPS_STATUS. Falling back to gh pr comment."
      gh pr comment "$PR_NUMBER" --body-file "${REPO_ROOT}/.review_output.md"
    fi
  else
    log_info "Posting review comment via 'gh pr comment'..."
    gh pr comment "$PR_NUMBER" --body-file "${REPO_ROOT}/.review_output.md"
  fi

  # Step 5: Gatekeeper 5/5 Decision Check
  if [ "$SCORE" -eq 5 ]; then
    log_success "🎉 PR #${PR_NUMBER} achieved a 5/5 rating on Pass #${PASS}!"
    gh pr comment "$PR_NUMBER" --body "✅ **PR achieved a 5/5 rating! Loop complete.** All checks passed and code is production ready."
    cleanup_temp_files
    exit 0
  fi

  # Check loop termination limit
  if [ "$PASS" -ge "$MAX_LOOPS" ]; then
    log_warn "Reached MAX_LOOPS (${MAX_LOOPS}) without reaching 5/5. Terminating loop."
    gh pr comment "$PR_NUMBER" --body "⚠️ **[Review Loop Notice]** Loop reached maximum allowed iterations (${MAX_LOOPS}) with current rating: ${RATING_LINE}. Please address remaining items manually."
    cleanup_temp_files
    exit 1
  fi

  # Step 6: Invoke Agent 2 (The Autonomous Coding Agent)
  log_info "Invoking Agent 2 (Coding Agent with tools: read,edit,write,bash)..."

  CODER_TASK="You are Agent 2 (Senior Coding Agent).
Agent 1 (Code Reviewer) reviewed PR #${PR_NUMBER} and identified issues with rating ${RATING_LINE}.
Here is the exact feedback from Agent 1:

$(cat "${REPO_ROOT}/.review_output.md")

Your task:
1. Carefully inspect the affected files.
2. Edit the code to fix EVERY issue flagged by Agent 1.
3. If unit tests exist or are needed, run/add them using bash to verify fixes.
4. Do NOT modify '.pr_review.diff', '.review_output.md', or workflow scripts."

  pi --no-session --approve --tools read,edit,write,bash \
     --append-system-prompt "${CODER_PROMPT_FILE}" \
     -p "${CODER_TASK}" > "${REPO_ROOT}/.coder_output.md" 2>&1 || true

  # Step 7: Safety Check: Check for Modified Files
  cleanup_temp_files
  CHANGES=$(git status --porcelain)

  if [ -z "$CHANGES" ]; then
    log_error "Coding Agent produced NO code changes (git status is clean) despite < 5/5 rating!"
    gh pr comment "$PR_NUMBER" --body "⚠️ **[Safety Abort]** The Coding Agent produced no file changes to resolve the reported issues from Pass #${PASS}. Aborting loop to prevent infinite cycling."
    exit 1
  fi

  log_info "Modified files detected by Coding Agent:"
  echo "$CHANGES"

  # Step 8: Commit and Push Changes
  COMMIT_MSG="fix(coding-agent): resolve review findings from pass #${PASS}"
  log_info "Staging changes and committing: '${COMMIT_MSG}'..."
  git add -A
  git commit -m "$COMMIT_MSG"

  FIX_COMMIT_SHA=$(git rev-parse HEAD)
  log_info "Pushed Fix Commit SHA: ${FIX_COMMIT_SHA}"

  log_info "Pushing fix commit to PR branch..."
  git push

  # Step 9: Resolve Review Threads via dev-loops reply-resolve
  if [ -n "$DEV_LOOPS_CMD" ]; then
    log_info "Resolving review threads via dev-loops gate reply-resolve citing commit ${FIX_COMMIT_SHA}..."
    set +e
    $DEV_LOOPS_CMD gate reply-resolve \
      --pr "$PR_NUMBER" \
      --fix-commit "$FIX_COMMIT_SHA"
    set -e
  fi

  # Step 10: Post Pass Status Update on PR
  gh pr comment "$PR_NUMBER" --body "🤖 **[Coding Agent Pass #${PASS}]** Applied automated fixes for review findings. Pushed commit \`${FIX_COMMIT_SHA:0:7}\`. Proceeding to re-review pass #$((PASS + 1))..."

  PASS=$((PASS + 1))
done

log_warn "Loop finished without reaching 5/5 rating after ${MAX_LOOPS} passes."
exit 1
