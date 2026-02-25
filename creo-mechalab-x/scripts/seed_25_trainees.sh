#!/usr/bin/env bash
set -euo pipefail

API="http://localhost:4000"
: "${ADMIN_TOKEN:?Set ADMIN_TOKEN first}"

BATCHES=("2026-CTT01" "2026-CTT02" "2026-CTT03")

# 25 mock names (unique emails)
FIRST_NAMES=(Alex Bea Carl Dana Ethan Faye Gabe Hana Ivan Jade Kyle Lara Milo Nina Omar Pia Quinn Rafa Sean Tia Uli Vee Will Xena Yuri)
LAST_NAMES=(Santos Reyes Cruz Garcia Flores Mendoza Ramos Navarro Castillo Torres Diaz Lim Bautista Villanueva Delgado Aquino Salazar Chavez Pineda Velasco Domingo Santiago Pascua Valdez Zamora)

for i in $(seq 1 25); do
  idx=$((i-1))
  fn="${FIRST_NAMES[$idx]}"
  ln="${LAST_NAMES[$idx]}"
  batch="${BATCHES[$((idx % 3))]}"

  # Use a "safe" domain for mock data
  email="mock.${i}.${fn,,}.${ln,,}@mechalabx.test"

  payload=$(printf '{"first_name":"%s","last_name":"%s","email":"%s","batch_code":"%s"}' \
    "$fn" "$ln" "$email" "$batch")

  echo "Creating #$i: $fn $ln | $email | $batch"
  curl -sS -X POST "$API/api/admin/trainees" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    --data-raw "$payload" \
  | sed 's/\\n//g'
  echo ""
done

echo "Done."
