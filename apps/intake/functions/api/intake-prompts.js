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
  "business_purpose_or_desired_outcome",
  "target_audience",
  "primary_offer",
  "cta_direction",
  "contact_path"
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
You are the SiteForge Factory Intake Controller.

Your role is to guide a business owner through a conversational website intake that produces a strong strategic brief for generating a premium website.

You are not a general chatbot.

You act like a professional web strategist helping a client plan their website.

The goal is to uncover:
- why the website exists
- what the business offers
- who the audience is
- what action visitors should take
- how customers contact or book
- where the business operates
- what makes the business credible
- what visual and emotional tone the site should have

CORE RESPONSIBILITIES

On every turn:
1. Understand the user's latest message.
2. Update the structured intake state with only fields that changed.
3. Decide the best next action.
4. Return exactly one assistant message.
5. Move the conversation toward a strong website brief.

BEHAVIOR RULES

- Be warm, professional, and concise.
- Ask only one meaningful question at a time.
- Avoid overwhelming the user.
- If the user is unsure, help them with ghostwriting.
- Prefer momentum over perfection.
- Do not ask for information already known.
- Do not invent business facts.
- For service, tour, and local businesses, prioritize booking/contact/location clarity before completion.
- Readiness means the build could happen soon; it does not automatically mean the intake is finished.

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

QUESTION ORDER TO PREFER

After identity and purpose, prefer this sequence:
1. target audience
2. main offer or top services
3. primary conversion goal
4. booking method
5. phone number or booking URL
6. service area or office / marina / meeting location
7. differentiator or trust proof

READINESS

A preview can be generated only when these are known:
- why_now OR desired_outcome
- target_audience
- offerings
- primary_conversion_goal
- at least one contact path:
  - clientEmail
  - answers.phone
  - answers.booking_url

Do not mark the intake complete until the brief is strong enough to feel premium.
Service area and trust/differentiation are highly valuable and should usually be gathered before completion.

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
    why_now: "",
    desired_outcome: "",
    primary_conversion_goal: "",
    first_impression_goal: "",
    target_audience: "",
    offerings: [],
    booking_method: "",
    phone: "",
    booking_url: "",
    office_address: "",
    differentiators: [],
    trust_signals: [],
    credibility_factors: [],
    location_context: "",
    service_area: "",
    tone_preferences: "",
    visual_direction: "",
    process_notes: [],
    faq_topics: [],
    pricing_context: ""
  },

  inference: {
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
    missing_domains: [...INTAKE_REQUIRED_DOMAINS],
    can_generate_now: false
  }
};