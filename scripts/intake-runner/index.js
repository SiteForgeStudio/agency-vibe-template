import readline from "readline";
import fs from "fs";
import path from "path";

const argv = process.argv.slice(2);

// ==========================
// CONFIG
// ==========================
const API_BASE = "https://intake.getsiteforge.com/api";
const SLUG = "simons-fine-art-framing-gallery";

const MODE = "interactive"; // "interactive" or "scripted"

/**
 * After the last intake-next turn, POST state to intake-complete (factory assembly).
 * - Env: INTAKE_RUN_COMPLETE=0 to skip the POST entirely.
 * - CLI: --no-complete (same as INTAKE_RUN_COMPLETE=0).
 */
const RUN_INTAKE_COMPLETE =
  process.env.INTAKE_RUN_COMPLETE !== "0" && !argv.includes("--no-complete");

/**
 * Server submit path: intake-complete with body.action === "complete" triggers /api/submit (worker).
 * - Default: no action → assemble business_json only.
 * - Env: INTAKE_COMPLETE_ACTION=complete to opt in.
 * - Env: INTAKE_SKIP_SUBMIT=1 or CLI --no-submit → never send action (even if INTAKE_COMPLETE_ACTION is set).
 */
const SKIP_SUBMIT =
  process.env.INTAKE_SKIP_SUBMIT === "1" || argv.includes("--no-submit");
const COMPLETE_ACTION_RAW = process.env.INTAKE_COMPLETE_ACTION || "";
const COMPLETE_ACTION = SKIP_SUBMIT ? "" : COMPLETE_ACTION_RAW;

/** If true, exit with code 1 when intake-complete returns ok: false */
const EXIT_ON_COMPLETE_FAIL = process.env.INTAKE_EXIT_ON_COMPLETE_FAIL !== "0";

// Optional scripted answers
const scriptedAnswers = [
  "We serve homeowners in Boulder, Colorado.",
  "We specialize in high-end residential window cleaning and glass restoration.",
  "Customers request a quote through the website.",
  "We don’t publish pricing, everything is custom quoted.",
  "We focus on quality over volume and attention to detail."
];

// ==========================
// SETUP
// ==========================
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let state = null;
let turn = 0;
let sessionLog = [];

// Ensure logs directory exists
const logDir = path.resolve("scripts/intake-runner/intake-logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// ==========================
// START SESSION
// ==========================
async function start() {
  console.log("\n🚀 Starting intake session...\n");

  const res = await fetch(`${API_BASE}/intake-start-v2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: SLUG })
  });

  const data = await res.json();

  if (!data.ok) {
    console.error("❌ Failed to start session:", data);
    process.exit(1);
  }

  state = {
  ...data.state,
  message: data.message
};

  await loop();
}

// ==========================
// MAIN LOOP
// ==========================
async function loop() {
  while (true) {
    turn++;

    console.log("\n====================================");
    console.log(`🧠 TURN ${turn}`);
    console.log("====================================\n");

    const question =
      state?.blueprint?.question_plan
        ? state?.message || "Next question:"
        : "Ready to complete.";

    console.log("🧠 AI:", question);

    // Do NOT use readiness.can_generate_now here: intake-start / blueprint readiness can be true while
    // the conversational planner still has a question_plan. End only when the server marks completion
    // or there is no plan (intake-next clears question_plan when action === "complete").
    if (state?.action === "complete" || !state?.blueprint?.question_plan) {
      console.log("\n✅ Intake conversation finished (no more questions).");
      const completeResult = await runIntakeComplete();
      saveSession(completeResult);
      const failed = completeResult && completeResult.ok === false;
      if (failed && EXIT_ON_COMPLETE_FAIL) {
        process.exit(1);
      }
      process.exit(0);
    }

    const answer =
      MODE === "scripted"
        ? getScriptedAnswer()
        : await ask("\n✏️  You: ");

    console.log("✏️  You:", answer);

    const res = await fetch(`${API_BASE}/intake-next-v2`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, answer })
    });

    const data = await res.json();

    if (!data.ok) {
      console.error("❌ intake-next error:", data);
      saveSession();
      process.exit(1);
    }

    const prevState = state;
    state = {
        ...data.state,
         message: data.message
    };

    printDebug(prevState, state, data);

    logTurn(question, answer, state);
  }
}

// ==========================
// INPUT
// ==========================
function ask(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function getScriptedAnswer() {
  const answer = scriptedAnswers.shift() || "continue";
  return answer;
}

// ==========================
// DEBUG OUTPUT
// ==========================
function printDebug(prevState, newState, data) {

    // ==========================
  // 🔥 PREFLIGHT HYDRATION DEBUG
  // ==========================
  console.log("\n🧠 PREFLIGHT FACTS (Hydration Check):");

  const facts = newState.blueprint?.fact_registry || {};

  const debugKeys = [
    "target_persona",
    "primary_offer",
    "differentiation",
    "booking_method"
  ];

  debugKeys.forEach((key) => {
    const fact = facts[key];

    if (!fact) {
      console.log(`✖ ${key}: undefined`);
    } else {
      console.log(`✔ ${key}:`, {
        value: fact.value,
        status: fact.status,
        confidence: fact.confidence
      });
    }
  });

  // ==========================
  // FACTORY / VISUAL SIGNALS (narrow slice — draft + visual facts + PI)
  // ==========================
  console.log("\n🏭 FACTORY / VISUAL SIGNALS:");
  const visualFactKeys = [
    "hero_image_query",
    "image_themes",
    "gallery_visual_direction",
    "recommended_focus"
  ];
  visualFactKeys.forEach((key) => {
    const fact = facts[key];
    if (!fact) {
      console.log(`✖ ${key}: undefined`);
    } else {
      console.log(`✔ ${key}:`, {
        value: fact.value,
        status: fact.status,
        confidence: fact.confidence
      });
    }
  });

  const draft = newState.blueprint?.business_draft || {};
  const heroQ = draft?.hero?.image?.image_search_query;
  const galleryQ = draft?.gallery?.image_source?.image_search_query;
  console.log("→ draft hero.image.image_search_query:", heroQ ?? "(empty)");
  console.log("→ draft gallery.image_source.image_search_query:", galleryQ ?? "(empty)");

  const pi = newState.preflight_intelligence || {};
  console.log(
    "→ preflight_intelligence.recommended_focus:",
    pi.recommended_focus ?? "(empty)"
  );
  const piKeys = newState.turn_debug?.preflight_intelligence_keys;
  if (Array.isArray(piKeys) && piKeys.length) {
    console.log("→ preflight_intelligence_keys (turn_debug):", piKeys.join(", "));
  }

  const bp = newState.blueprint;

  console.log("\n📊 STATE SNAPSHOT:");

  const lastAudit = newState.blueprint?.last_interpretation || {};

  console.log("→ Bundle:", bp.question_plan?.bundle_id);
  console.log("→ Previous Bundle:", prevState.blueprint?.question_plan?.bundle_id);
  console.log("→ Primary Field:", bp.question_plan?.primary_field);
  console.log("→ Targets:", bp.question_plan?.target_fields);
  console.log("→ Expected Primary:", lastAudit.expected_primary_field);
  console.log("→ Primary Updated:", lastAudit.primary_field_updated);
  console.log("→ Updated Fact Keys:", lastAudit.updated_fact_keys);
  console.log("→ Secondary (non-progression) Keys:", lastAudit.secondary_updated_keys);

  const td = newState.turn_debug || {};
  console.log("\n🔧 TURN DEBUG:");
  console.log("→ Answered primary (last turn):", td.answered_primary_field);
  console.log("→ Primary satisfied after answer:", td.primary_satisfied_after_answer);
  console.log("→ Next primary:", td.next_primary_field);
  console.log("→ LLM available:", td.llm_available);
  console.log("→ Question source:", td.question_source);
  console.log("→ Fallback triggered:", td.fallback_triggered);
  console.log("→ Fallback reason:", td.fallback_reason ?? "(none)");

  // ==========================
  // FACT CHANGES
  // ==========================
  console.log("\n🧾 FACT CHANGES:");

  const prevFacts = prevState.blueprint?.fact_registry || {};
  const newFacts = newState.blueprint?.fact_registry || {};

  Object.keys(newFacts).forEach(key => {
    const prevVal = prevFacts[key]?.value;
    const newVal = newFacts[key]?.value;

    if (JSON.stringify(prevVal) !== JSON.stringify(newVal)) {
      console.log(`✔ ${key}:`, newVal);
    }
  });

  // ==========================
  // READINESS
  // ==========================
  console.log("\n📈 READINESS:");

  const r = newState.readiness || {};
  console.log("Score:", r.score);
  console.log("Can Generate:", r.can_generate_now);
  console.log("Missing:", r.missing_domains);

  console.log("\n-----------------------------------\n");
}

// ==========================
// INTAKE-COMPLETE (factory assembly)
// ==========================

/**
 * Sends final state to intake-complete. Server re-checks readiness + enrichment; 400 is normal if gates aren’t met yet.
 */
async function runIntakeComplete() {
  if (!RUN_INTAKE_COMPLETE) {
    console.log(
      "\n⏭  Skipping intake-complete (INTAKE_RUN_COMPLETE=0 or --no-complete)."
    );
    return null;
  }

  console.log("\n🏭 Calling intake-complete…");
  if (SKIP_SUBMIT && COMPLETE_ACTION_RAW) {
    console.log(
      "⏭  Submit path disabled (INTAKE_SKIP_SUBMIT=1 or --no-submit); not sending body.action."
    );
  } else if (COMPLETE_ACTION) {
    console.log(`→ body.action: "${COMPLETE_ACTION}" (server may POST /api/submit)`);
  } else {
    console.log("→ no body.action (assemble business_json only; no /api/submit)");
  }

  const body = { state };
  if (COMPLETE_ACTION) {
    body.action = COMPLETE_ACTION;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}/intake-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error("❌ intake-complete fetch error:", err);
    return { ok: false, error: String(err?.message || err) };
  }

  const data = await res.json().catch(() => ({}));

  if (!data.ok) {
    console.error("\n❌ intake-complete:", data.error || res.status, data.message || "");
    if (data.readiness) {
      console.error("→ readiness:", JSON.stringify(data.readiness, null, 2));
    }
    if (data.enrichment) {
      console.error("→ enrichment:", JSON.stringify(data.enrichment, null, 2));
    }
    if (data.issues) {
      console.error("→ validation issues:", data.issues);
    }
    return data;
  }

  console.log("\n✅ intake-complete: business_json ready.");

  if (data.strategy_brief?.derived_behavior) {
    console.log("→ derived_behavior:", data.strategy_brief.derived_behavior);
  }

  // ==========================
  // 🧪 FACTORY OUTPUT DEBUG
  // ==========================

  console.log("\n🧪 HERO IMAGE QUERY:");
  console.log(
    data?.business_json?.hero?.image?.image_search_query || "(missing)"
  );

  console.log("\n🖼️ GALLERY IMAGE QUERIES:");

  const galleryItems = data?.business_json?.gallery?.items || [];

  if (!galleryItems.length) {
    console.log("(no gallery items)");
  } else {
    galleryItems.forEach((item, i) => {
      console.log(`${i + 1}.`, item?.image_search_query || "(missing)");
    });
  }

  return data;
}

// ==========================
// LOGGING
// ==========================
function logTurn(question, answer, state) {
  sessionLog.push({
    turn,
    question,
    answer,
    state_snapshot: state
  });
}

function saveSession(completeResponse) {
  const filename = `session-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const filepath = path.join(logDir, filename);

  const payload = {
    meta: {
      slug: SLUG,
      api_base: API_BASE,
      saved_at: new Date().toISOString()
    },
    turns: sessionLog,
    intake_complete: completeResponse || null
  };

  fs.writeFileSync(filepath, JSON.stringify(payload, null, 2));

  console.log(`\n💾 Session saved to: ${filepath}\n`);
}

// ==========================
// RUN
// ==========================
start();