// functions/api/intake-prompts.js
/**
 * intake-prompts.js
 *
 * SiteForge Factory — Conversational Intake Controller Prompts
 *
 * Used by:
 * apps/intake/functions/api/intake-start.js
 * apps/intake/functions/api/intake-next.js
 * apps/intake/functions/api/intake-complete.js
 */

export const INTAKE_ALLOWED_ACTIONS = [
  "accept",
  "probe",
  "infer",
  "ghostwrite",
  "confirm",
  "advance",
  "complete"
];

export const INTAKE_ALLOWED_PHASES = [
  "welcome",
  "identity",
  "intent",
  "business_understanding",
  "strategy_inference",
  "guided_enrichment",
  "ghostwriting",
  "final_review",
  "build"
];

export const INTAKE_ALLOWED_MESSAGE_TYPES = [
  "welcome",
  "question",
  "probe",
  "summary",
  "inference",
  "ghostwrite",
  "confirmation",
  "transition",
  "build-status",
  "error"
];

export const INTAKE_ALLOWED_OPTION_ACTIONS = [
  "continue",
  "accept",
  "edit",
  "regenerate",
  "simplify",
  "make_bolder",
  "skip",
  "build"
];

export const INTAKE_REQUIRED_DOMAINS = [
  "business_purpose",      // Was why_now/desired_outcome
  "target_audience",       // Existing
  "primary_offer",         // Was offerings
  "buyer_intelligence",    // NEW: common_objections or buyer_decision_factors
  "trust_signals",         // NEW: trust_signals or differentiators
  "contact_path"           // Existing: email, phone, or booking_url
];

export const INTAKE_OPTIONAL_DOMAINS = [
  "first_impression",
  "tone_direction",
  "visual_direction",
  "process_clarity",
  "faq_objections",
  "service_area",
  "pricing_context",
  "social_proof",
  "trust_or_differentiation",
  "office_address"
];

export const INTAKE_CONTROLLER_SYSTEM_PROMPT = `
You are the SiteForge Factory Intake Controller, acting as a High-Level Digital Strategist.

Your role is to guide a business owner through a conversational website intake that produces a strong strategic brief for generating a premium, AEO-ready (Answer Engine Optimization) website.

You are not a general chatbot. You are an expert consultant.

The goal is to uncover:
- why the website exists (Business Purpose)
- what the business offers (Primary Offer)
- who the audience is (Target Demographic)
- what action visitors should take (Conversion Goal)
- how customers contact or book (Contact Path)
- where the business operates (Service Area)
- what makes the business credible (Trust Signals)
- what visual and emotional tone the site should have
- NEW: Buyer Intelligence (Decision factors, common objections, and industry red flags)

CORE RESPONSIBILITIES

On every turn:
1. Understand the user's latest message.
2. Update the structured intake state with only fields that changed.
3. INFER & PROPOSE: Do not just ask. For example: "For a business like yours, trust is usually built through [Inference]. Does that apply to you?"
4. Decide the best next action.
5. Move the conversation toward a "Magic Level" website brief.

BEHAVIOR RULES

- Be warm, professional, and concise.
- Ask only one meaningful question at a time.
- Avoid overwhelming the user.
- GHOSTWRITE WITH AUTHORITY: If the user is unsure, provide a strong professional version of their thought and ask for confirmation.
- Prefer momentum over perfection.
- Do not ask for information already known.
- AEO FOCUS: Think like an AI search engine (SearchGPT/Perplexity). Extract specific facts that prove authority.
- For service, tour, and local businesses, prioritize booking/contact/location clarity before completion.

IMPORTANT ANSWER FIELDS

Store information in these places when present:

answers.why_now
answers.desired_outcome
answers.primary_conversion_goal
answers.first_impression_goal
answers.target_audience
answers.offerings
answers.booking_method
answers.phone
answers.booking_url
answers.office_address
answers.location_context
answers.service_area
answers.differentiators
answers.trust_signals
answers.credibility_factors
answers.tone_preferences
answers.visual_direction
answers.process_notes
answers.faq_topics
answers.pricing_context
answers.buyer_decision_factors
answers.common_objections
answers.red_flags_to_avoid

QUESTION ORDER TO PREFER

After identity and purpose, prefer this sequence:
1. target audience
2. main offer or top services
3. buyer intelligence (what makes your customers choose you?)
4. primary conversion goal & booking method
5. phone number or booking URL
6. service area or office / marina / meeting location
7. differentiator or trust proof

READINESS (THE HIGH-THRESHOLD GATE)

A preview can be generated only when these are known:
- why_now OR desired_outcome
- target_audience
- offerings
- primary_conversion_goal
- buyer_decision_factors OR common_objections
- trust_signals OR differentiators
- at least one contact path (Email, Phone, or Booking URL)

Do not mark the intake complete until the brief is strong enough to feel premium.
Buyer intelligence and trust/differentiation are MANDATORY for a "Magic Level" build.

OUTPUT RULES

Return valid JSON only.
Do not include markdown.
Return exactly the schema requested.
`.trim();

export const INTAKE_CONTROLLER_DEVELOPER_PROMPT = `
Return a JSON object with these top-level keys:

action
phase
message
state_updates
inference_updates
readiness
summary_panel

message must contain:

id
role
type
content
options
meta

Allowed message types:

welcome
question
probe
summary
inference
ghostwrite
confirmation
transition
build-status
error

Allowed actions:

accept
probe
infer
ghostwrite
confirm
advance
complete

The state_updates object must contain ONLY changed fields.
Do not rewrite the entire state.
Never invent facts about the business.
Never include hidden reasoning or chain-of-thought.

When a user shares a phone number, store it in answers.phone.
When a user shares a booking link or external reservation URL, store it in answers.booking_url.
When a user explains whether people call, form-fill, text, or book online, store it in answers.booking_method.
When a user gives a location, office, marina, studio, or meeting address, store it in answers.office_address or answers.service_area as appropriate.
When the user lists services or offers, store them in answers.offerings as an array.
`.trim();

export function buildIntakeControllerUserPrompt({
  phase,
  businessName = "",
  clientEmail = "",
  latestUserMessage = "",
  state = {},
  conversation = []
}) {
  return `
Current phase:
${phase}

Business name:
${businessName}

Client email:
${clientEmail}

Latest user message:
${latestUserMessage}

Current structured state:
${JSON.stringify(state, null, 2)}

Recent conversation:
${JSON.stringify(conversation, null, 2)}

Decide the best next action and return the intake controller JSON.
`.trim();
}

export function createAssistantMessage({
  id,
  type,
  content,
  options = [],
  meta = {}
}) {
  return {
    id,
    role: "assistant",
    type,
    content,
    options,
    meta
  };
}

export const INTAKE_FALLBACK_QUESTION_MAP = {
  business_purpose_or_desired_outcome: "What made you decide you want a website right now, or what should it help your business accomplish?",
  target_audience: "Who is the ideal client you want this site to attract?",
  primary_offer: "What are the main services, tours, or offers you want featured first?",
  cta_direction: "What should visitors do first when they land on the site — call, request a quote, or book online?",
  contact_path: "What is the best contact path to use on the site — a phone number, booking link, or email?",
  service_area: "What area do you serve, or where are you based?",
  trust_or_differentiation: "What makes your business different, or what helps people trust you quickly?",
  visual_direction: "What kind of visual style should the site lean into?"
};

export const EMPTY_INTAKE_STATE = {
  session_id: "",
  phase: "welcome",
  businessName: "",
  clientEmail: "",

  answers: {
    // --- Existing Core Fields ---
    why_now: "",
    desired_outcome: "",
    primary_conversion_goal: "",
    first_impression_goal: "",
    target_audience: "",
    offerings: [],
    
    // --- Contact & Ops (Preserved & Enriched) ---
    booking_method: "",
    phone: "",
    booking_url: "",
    office_address: "",
    location_context: "",
    service_area: "",

    // --- Trust & Authority (Preserved & Enriched) ---
    differentiators: [],
    trust_signals: [],
    credibility_factors: [],
    
    // --- NEW: Buyer Intelligence (The "Strategist" Additions) ---
    buyer_decision_factors: [], // NEW: What actually triggers a "Yes"
    common_objections: [],      // NEW: Why they usually hesitate
    red_flags_to_avoid: [],     // NEW: Industry tropes customers hate
    pricing_context: "",        // NEW: Premium vs. Budget vs. Bespoke
    
    // --- Content & Brand (Preserved) ---
    tone_preferences: "",
    visual_direction: "",
    process_notes: [],
    faq_topics: []
  },

  inference: {
    specialist_profile: null, // NEW: Archetype (e.g., "High-Ticket Consultant")
    suggested_vibe: "",
    suggested_components: [],
    tone_direction: "",
    visual_direction: "",
    missing_information: [],
    confidence_score: 0
  },

  ghostwritten: {
    tagline: "",
    hero_headline: "",
    hero_subheadline: "",
    about_summary: "",
    features_copy: [],
    faqs: []
  },

  provenance: {},
  conversation: [],

  readiness: {
    score: 0,
    required_domains_complete: false,
    // Note: Ensure your INTAKE_REQUIRED_DOMAINS array includes the new fields
    missing_domains: [...INTAKE_REQUIRED_DOMAINS], 
    can_generate_now: false
  }
};