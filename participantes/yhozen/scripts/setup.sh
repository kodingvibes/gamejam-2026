#!/usr/bin/env bash
set -euo pipefail

participant_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

npm ci --prefix "$participant_dir"
