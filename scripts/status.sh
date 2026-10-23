#!/usr/bin/env bash
# Prints the status of every branch, then the open incidents.

set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:${API_PORT:-3000}/v1}"

echo "=== Branches ==="
curl --fail-with-body --silent --show-error "${BASE_URL}/agencies" |
  jq -r '.[] | [.id, .status, (if .last_rtt_ms then "\(.last_rtt_ms) ms" else "-" end), (.open_incident.ref // "")] | @tsv' |
  column -t -s $'\t'

echo
echo "=== Incidents ==="
curl --fail-with-body --silent --show-error "${BASE_URL}/incidents" |
  jq -r '.[:5][] | [.ref, .agency_id, .opened_at, (.closed_at // "open"), (if .duration_seconds then "\(.duration_seconds) s" else "" end)] | @tsv' |
  column -t -s $'\t'
