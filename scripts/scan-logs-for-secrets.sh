#!/usr/bin/env bash
# 034-observability-logging (T042): zero-leak scanner for SC-003.
#
# Scans a log sample (file or stdin) for any SENSITIVE field name whose value
# is NOT the [REDACTED] sentinel — i.e. a leak. Exits 1 on leak, 0 on clean.
#
# Usage:
#   docker logs balthasar 2>&1 | ./scripts/scan-logs-for-secrets.sh
#   ./scripts/scan-logs-for-secrets.sh path/to/log-sample.jsonl
#
# Field list mirrors src/lib/logger.ts REDACT_PATHS and contracts/log-record.md.
# Add CI integration by piping the staging log window through this script
# on a schedule; assert exit 0.

set -euo pipefail

# Sensitive fields whose VALUE must always be "[REDACTED]" if present.
# Matches the field name as a JSON key with a non-[REDACTED] string value.
SENSITIVE_PATTERN='"(password|email|secret|amount|remark|authorization|cookie)"[[:space:]]*:[[:space:]]*"[^[]'

input="${1:-/dev/stdin}"

if [ ! -r "$input" ]; then
  echo "ERROR: cannot read $input" >&2
  exit 2
fi

# Count lines that match the leak pattern.
leaks=$(grep -E "$SENSITIVE_PATTERN" "$input" 2>/dev/null | wc -l | tr -d ' ')

if [ "$leaks" -gt 0 ]; then
  echo "FAIL: $leaks line(s) contain sensitive field values that are NOT [REDACTED]" >&2
  echo "Sample of offending lines:" >&2
  grep -E "$SENSITIVE_PATTERN" "$input" 2>/dev/null | head -5 >&2
  exit 1
fi

echo "PASS: no sensitive field leaks detected"
exit 0
