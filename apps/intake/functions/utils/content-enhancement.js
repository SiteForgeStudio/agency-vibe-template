// content-enhancement.js — optional copy polish from signalBlob + behavior (no schema / intake changes).

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isGuidedDecisionMode(decisionMode) {
  const s = cleanString(decisionMode).toLowerCase();
  return s === "guided" || s === "consultative" || s.includes("guided");
}

export function enhanceProcessSteps(processSteps, signalBlob, behavior) {
  if (!Array.isArray(processSteps)) return processSteps;

  const narrative = cleanString(signalBlob?.process_model?.process_narrative);
  const decisionMode = signalBlob?.experience_model?.decision_mode;

  return processSteps.map((step) => {
    let description = step.description || "";

    if (isGuidedDecisionMode(decisionMode)) {
      description = makeConsultative(description, narrative);
    }

    if (behavior?.trust_sensitivity === "high") {
      description = addReassurance(description);
    }

    return {
      ...step,
      description: truncate(description, 220)
    };
  });
}

export function enhanceFeatures(features, signalBlob, behavior) {
  if (!Array.isArray(features)) return features;

  const trustRequirement = cleanString(signalBlob?.experience_model?.trust_requirement).toLowerCase();

  return features.map((f) => {
    let description = f.description || "";

    if (trustRequirement === "high_technical" || trustRequirement.includes("technical")) {
      description = makeTechnical(description);
    }

    if (behavior?.trust_sensitivity === "high") {
      description = addReassurance(description);
    }

    return {
      ...f,
      description: truncate(description, 220)
    };
  });
}

export function enhanceHero(hero, signalBlob, behavior) {
  if (!hero) return hero;

  let headline = hero.headline || "";
  let subtext = hero.subtext || "";

  const positioning = cleanString(signalBlob?.positioning);
  const angle = cleanString(signalBlob?.angle);
  const decisionMode = signalBlob?.experience_model?.decision_mode;

  if (angle) {
    headline = angle;
  } else if (positioning) {
    headline = positioning;
  }

  if (isGuidedDecisionMode(decisionMode)) {
    subtext = makeConsultative(subtext, positioning);
  }

  if (behavior?.trust_sensitivity === "high") {
    subtext = addReassurance(subtext);
  }

  return {
    ...hero,
    headline: truncateAtWordBoundary(headline, 120),
    subtext: truncateAtWordBoundary(subtext, 260)
  };
}

/* ---------------- HELPERS ---------------- */

export function truncateAtWordBoundary(str, max) {
  if (!str) return "";
  if (str.length <= max) return str;
  const budget = max - 3;
  const slice = str.slice(0, budget);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > Math.floor(budget * 0.5)) return `${slice.slice(0, lastSpace).trim()}...`;
  return `${slice.trim()}...`;
}

function makeConsultative(text, narrative) {
  if (!text) return narrative || "";
  return `${text} We guide you through each step so you feel confident in every decision.`;
}

function addReassurance(text) {
  if (!text) return text;
  return `${text} Built with care and attention to detail you can trust.`;
}

function makeTechnical(text) {
  if (!text) return text;
  return `${text} Using professional-grade materials and proven techniques.`;
}

function truncate(str, max) {
  return truncateAtWordBoundary(str, max);
}
