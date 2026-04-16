#!/bin/bash
# AOSE Stop hook for Claude Code.
# Checks ~/.aose/inbox/AGENT_NAME.jsonl for pending doorbell events.
# If found: exit 2 + stderr → asyncRewake (Claude resumes with the message).
# If empty: exit 0 → Claude stops normally and waits for next input.
#
# AGENT_NAME is set by the onboarding prompt when it installs this hook.

INPUT=$(cat)

# Guard: if this stop was triggered by a hook rewake, don't rewake again.
STOP_HOOK_ACTIVE=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('stop_hook_active','false'))" 2>/dev/null)
if [ "$STOP_HOOK_ACTIVE" = "true" ] || [ "$STOP_HOOK_ACTIVE" = "True" ]; then
  exit 0
fi

INBOX_FILE="$HOME/.aose/inbox/AGENT_NAME.jsonl"

if [ ! -f "$INBOX_FILE" ]; then
  exit 0
fi

LINE=$(head -1 "$INBOX_FILE" 2>/dev/null)
if [ -z "$LINE" ]; then
  exit 0
fi

# Consume the line
tail -n +2 "$INBOX_FILE" > "$INBOX_FILE.tmp" && mv "$INBOX_FILE.tmp" "$INBOX_FILE"

# Extract content field from JSONL line, or use raw line
CONTENT=$(echo "$LINE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('content',''))" 2>/dev/null)
if [ -z "$CONTENT" ]; then
  CONTENT="$LINE"
fi

echo "$CONTENT" >&2
exit 2
