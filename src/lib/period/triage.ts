/**
 * Period tracker triage helpers:
 * - Determine source category from event type
 * - GP flag logic
 * - Validation
 */

// Map event type → source category
const TYPE_TO_CATEGORY: Record<string, string> = {
  period_start: "period",
  period_daily: "period",
  period_end: "period",
  spotting: "spotting",
  light_bleeding: "maybe_period",
  hrt_bleeding: "hrt",
  post_meno_bleeding: "urgent",
};

export function getSourceCategory(type: string): string {
  return TYPE_TO_CATEGORY[type] || "spotting";
}

/**
 * Determine if a GP flag should be set on this event.
 */
export function shouldFlagGP(params: {
  type: string;
  flowIntensity?: string | null;
  hasClotting?: boolean | null;
  clotSize?: string | null;
  hasDeclaredMenopause: boolean;
}): boolean {
  // Post-menopause bleeding is always flagged
  if (params.type === "post_meno_bleeding") return true;

  // Any bleeding after declaring menopause
  if (params.hasDeclaredMenopause && params.type !== "hrt_bleeding") return true;

  // Very heavy flow with large clots
  if (
    params.flowIntensity === "very_heavy" &&
    params.hasClotting === true &&
    params.clotSize === "large"
  ) {
    return true;
  }

  // Heavy flow with any clotting
  if (
    params.flowIntensity === "very_heavy" &&
    params.hasClotting === true
  ) {
    return true;
  }

  return false;
}

/**
 * Validate event data before saving.
 * Returns error message or null if valid.
 */
export function validateEventData(params: {
  type: string;
  eventDate: string;
  flowIntensity?: string | null;
}): string | null {
  // Valid types
  const validTypes = [
    "period_start",
    "period_daily",
    "period_end",
    "spotting",
    "light_bleeding",
    "hrt_bleeding",
    "post_meno_bleeding",
  ];
  if (!validTypes.includes(params.type)) {
    return `Invalid event type: ${params.type}`;
  }

  // No future dates
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const eventDate = new Date(params.eventDate);
  if (eventDate > today) {
    return "Cannot log events in the future";
  }

  // Valid flow intensities
  if (params.flowIntensity) {
    const validFlows = ["spotting", "light", "medium", "heavy", "very_heavy"];
    if (!validFlows.includes(params.flowIntensity)) {
      return `Invalid flow intensity: ${params.flowIntensity}`;
    }
  }

  return null;
}

/**
 * Determine peak flow from an array of flow intensities.
 */
const FLOW_RANK: Record<string, number> = {
  spotting: 1,
  light: 2,
  medium: 3,
  heavy: 4,
  very_heavy: 5,
};

export function getPeakFlow(flows: (string | null)[]): string | null {
  let peak = 0;
  let peakFlow: string | null = null;
  for (const f of flows) {
    if (f && FLOW_RANK[f] > peak) {
      peak = FLOW_RANK[f];
      peakFlow = f;
    }
  }
  return peakFlow;
}
