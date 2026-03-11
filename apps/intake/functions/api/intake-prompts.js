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
    "business_purpose",
    "desired_outcome",
    "target_audience",
    "primary_offer",
    "cta_direction",
    "trust_or_differentiation"
  ];
  
  export const INTAKE_OPTIONAL_DOMAINS = [
    "first_impression",
    "tone_direction",
    "visual_direction",
    "process_clarity",
    "faq_objections",
    "service_area",
    "pricing_context",
    "social_proof"
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
  - what makes the business credible
  - what action visitors should take
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
  
  AVAILABLE ACTIONS
  
  accept
  probe
  infer
  ghostwrite
  confirm
  advance
  complete
  
  PHASES
  
  welcome
  identity
  intent
  business_understanding
  strategy_inference
  guided_enrichment
  ghostwriting
  final_review
  build
  
  REQUIRED DOMAINS
  
  - business_purpose
  - desired_outcome
  - target_audience
  - primary_offer
  - cta_direction
  - trust_or_differentiation
  
  OPTIONAL DOMAINS
  
  - first_impression
  - tone_direction
  - visual_direction
  - process_clarity
  - faq_objections
  - service_area
  - pricing_context
  - social_proof
  
  READINESS
  
  Generation is possible when core domains are known.
  
  Do not block progress waiting for optional information.
  
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
  
  The state_updates object must contain ONLY changed fields.
  
  Do not rewrite the entire state.
  
  Never invent facts about the business.
  
  Never include hidden reasoning or chain-of-thought.
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
    business_purpose: "What made you decide you want a website right now?",
    desired_outcome: "What should this website help your business do?",
    target_audience: "Who is the ideal client you want this site to attract?",
    primary_offer: "What do people usually hire you for first?",
    trust_or_differentiation: "What makes your business different from other options?",
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