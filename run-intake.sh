#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-https://intake.getsiteforge.com/api}"
SLUG="${SLUG:-summit-ridge-window-cleaning}"
WORKDIR="${WORKDIR:-/tmp/siteforge-intake-test}"
TURN_DIR="$WORKDIR/turns"

mkdir -p "$WORKDIR" "$TURN_DIR"
cd "$WORKDIR"

log() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

require_cmd curl
require_cmd jq

post_json() {
  local url="$1"
  local payload_file="$2"
  curl -sS "$url" \
    -H 'content-type: application/json' \
    --data @"$payload_file"
}

question_key() {
  jq -r '.question_key // .verification.current_key // empty' "$1"
}

question_message() {
  jq -r '.message // empty' "$1"
}

queue_complete() {
  jq -r '.verification.queue_complete // false' "$1"
}

can_generate_now() {
  jq -r '.readiness.can_generate_now // false' "$1"
}

save_state() {
  local src="$1"
  jq -c '.state' "$src" > state.json
}

print_status() {
  local file="$1"
  echo
  echo "---- status ----"
  jq '{question_key, question_stage, message, verification: {queue_complete, weak_fields, queue}, readiness}' "$file"
  echo
}

# Answer library keyed by question_key
answer_for_key() {
  local key="$1"

  case "$key" in
    why_now)
      cat <<'EOF'
We want the site to better match the quality of the service, make a stronger first impression, and help the right homeowners feel confident reaching out.
EOF
      ;;
    desired_outcome)
      cat <<'EOF'
Over the next 6 to 12 months, the site should generate stronger leads, attract higher-quality residential jobs, and make it easier for ideal clients to contact us.
EOF
      ;;
    target_audience)
      cat <<'EOF'
Homeowners with larger, detail-sensitive homes who want careful work, polished communication, and a provider they can trust around high-visibility glass.
EOF
      ;;
    offerings)
      cat <<'EOF'
High-end residential window cleaning, glass restoration, screen cleaning, and detail-focused exterior window service for larger homes.
EOF
      ;;
    buyer_decision_factors)
      cat <<'EOF'
They usually say yes when they feel confident we will protect the home, handle the glass carefully, show up reliably, and leave the final result looking noticeably cleaner.
EOF
      ;;
    common_objections)
      cat <<'EOF'
They may worry about whether the crew will be careful around the home, whether the result will actually look better, whether the quote will be clear, and whether scheduling will be reliable.
EOF
      ;;
    primary_conversion_goal)
      cat <<'EOF'
call now
EOF
      ;;
    booking_method)
      cat <<'EOF'
phone
EOF
      ;;
    phone)
      cat <<'EOF'
(970) 555-0184
EOF
      ;;
    booking_url)
      cat <<'EOF'
https://example.com/book
EOF
      ;;
    office_address)
      cat <<'EOF'
Boulder County, Colorado
EOF
      ;;
    service_area)
      cat <<'EOF'
Boulder, Louisville, Lafayette, Longmont, and nearby high-end residential areas in Boulder County.
EOF
      ;;
    differentiators)
      cat <<'EOF'
We stand out through careful workmanship, a more polished client experience, clear communication, and the ability to handle large homes and restoration-level detail without making the service feel rushed.
EOF
      ;;
    trust_signals)
      cat <<'EOF'
The strongest trust signals are years of experience, before-and-after results, repeat clients and referrals, and a reputation for being careful, dependable, and easy to work with.
EOF
      ;;
    credibility_factors)
      cat <<'EOF'
Years of hands-on experience, repeat residential clients, restoration-level detail capability, and a reputation for reliable service and careful follow-through.
EOF
      ;;
    tone_preferences)
      cat <<'EOF'
Refined, confident, premium, and professional without sounding cold or overly corporate.
EOF
      ;;
    visual_direction)
      cat <<'EOF'
The site should feel clean, bright, refined, and premium — modern residential imagery, natural light, elegant exteriors, pristine glass detail, and a polished high-end homeowner experience.
EOF
      ;;
    process_notes)
      cat <<'EOF'
The process is simple: first contact, quick scope review, clear quote, schedule the service, complete the work carefully, and finish with a final walkthrough or result check.
EOF
      ;;
    pricing_context)
      cat <<'EOF'
We want pricing framed as premium and scope-based. The quote should reflect the size of the home, the amount of glass, the level of restoration needed, and the care required to do the work properly.
EOF
      ;;
    experience_years)
      cat <<'EOF'
12 years
EOF
      ;;
    testimonials)
      cat <<'EOF'
We do not want to use invented testimonial quotes. For now, keep testimonials empty unless real review language is provided.
EOF
      ;;
    tagline_refinement)
      cat <<'EOF'
Premium residential window cleaning for larger homes, delivered with careful workmanship, clear communication, and polished results.
EOF
      ;;
    hero_refinement)
      cat <<'EOF'
The hero should immediately signal premium residential care, trust, and attention to detail — not just clean windows, but a polished experience for homeowners who expect more.
EOF
      ;;
    faq_refinement)
      cat <<'EOF'
The site should clearly answer pricing, what is included, how scheduling works, what areas we serve, whether you handle delicate or oversized glass, and why clients trust you with higher-end homes.
EOF
      ;;
    *)
      return 1
      ;;
  esac
}

start_intake() {
  log "Starting intake for slug: $SLUG"

  cat > start-payload.json <<EOF
{"slug":"$SLUG"}
EOF

  post_json "$BASE/intake-start" start-payload.json | tee start.json >/dev/null
  save_state start.json

  jq -r '.session_id // empty' start.json > session_id.txt
  print_status start.json
}

run_next_turn() {
  local turn_num="$1"
  local key="$2"
  local answer_file="$TURN_DIR/answer-$turn_num.txt"
  local payload_file="$TURN_DIR/payload-$turn_num.json"
  local response_file="$TURN_DIR/response-$turn_num.json"

  if ! answer_for_key "$key" > "$answer_file"; then
    echo "No scripted answer available for key: $key" >&2
    return 1
  fi

  log "Turn $turn_num | key=$key"
  echo "Question: $(jq -r '.message // empty' last.json)"
  echo "Answer:"
  cat "$answer_file"
  echo

  jq -n \
    --rawfile answer "$answer_file" \
    --slurpfile s state.json \
    '{
      answer: ($answer | gsub("\\s+$"; "")),
      state: $s[0]
    }' > "$payload_file"

  post_json "$BASE/intake-next" "$payload_file" | tee "$response_file" >/dev/null
  cp "$response_file" last.json
  save_state "$response_file"
  print_status "$response_file"
}

complete_intake() {
  log "Running intake-complete"

  jq -n --slurpfile s state.json '{state:$s[0]}' > complete-payload.json
  post_json "$BASE/intake-complete" complete-payload.json | tee complete.json >/dev/null

  jq '.business_json' complete.json > business.json

  echo
  echo "---- final premium-sensitive sections ----"
  jq '.business_json.brand,
      .business_json.hero,
      .business_json.features,
      .business_json.faqs,
      .business_json.testimonials' complete.json
  echo
}

main() {
  start_intake
  cp start.json last.json

  local turn=1
  local max_turns=20

  while [[ "$turn" -le "$max_turns" ]]; do
    local key
    key="$(question_key last.json)"

    if [[ -z "$key" ]]; then
      log "No current question key found."
      break
    fi

    if [[ "$(queue_complete last.json)" == "true" && "$(can_generate_now last.json)" == "true" ]]; then
      log "Queue complete and ready to generate."
      break
    fi

    if ! run_next_turn "$turn" "$key"; then
      echo
      echo "Stopped at turn $turn because no scripted answer matched key: $key" >&2
      echo "You can inspect: $TURN_DIR/response-$((turn-1)).json and then answer manually." >&2
      exit 1
    fi

    if [[ "$(queue_complete last.json)" == "true" && "$(can_generate_now last.json)" == "true" ]]; then
      log "Queue complete and ready to generate."
      break
    fi

    turn=$((turn + 1))
  done

  complete_intake

  echo
  echo "Artifacts written to:"
  echo "  $WORKDIR/start.json"
  echo "  $WORKDIR/state.json"
  echo "  $WORKDIR/complete.json"
  echo "  $WORKDIR/business.json"
  echo "  $TURN_DIR/"
}

main "$@"