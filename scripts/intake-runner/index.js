import readline from "readline";
import fs from "fs";
import path from "path";

// ==========================
// CONFIG
// ==========================
const API_BASE = "https://intake.getsiteforge.com/api";
const SLUG = "summit-ridge-window-cleaning-v2";

const MODE = "interactive"; // "interactive" or "scripted"

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

    if (!state?.blueprint?.question_plan) {
      console.log("\n✅ Intake complete.");
      saveSession();
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
  const bp = newState.blueprint;

  console.log("\n📊 STATE SNAPSHOT:");

  console.log("→ Bundle:", bp.question_plan?.bundle_id);
  console.log("→ Primary Field:", bp.question_plan?.primary_field);
  console.log("→ Targets:", bp.question_plan?.target_fields);

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

function saveSession() {
  const filename = `session-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const filepath = path.join(logDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(sessionLog, null, 2));

  console.log(`\n💾 Session saved to: ${filepath}\n`);
}

// ==========================
// RUN
// ==========================
start();