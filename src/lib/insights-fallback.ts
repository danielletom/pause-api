import type { NaturopathInsight, UserInsightContext } from './naturopath-agent';

// ---------------------------------------------------------------------------
// Templated fallback — produces a NaturopathInsight without AI
// Mirrors the shape of the naturopath output so the delivery agent
// can process it identically.
// ---------------------------------------------------------------------------

function formatFactor(factor: string): string {
  if (factor.startsWith('med_')) {
    const name = factor.slice(4);
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return factor
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSymptom(symptom: string): string {
  return symptom.replace(/_/g, ' ');
}

export function generateFallbackInsight(
  ctx: UserInsightContext,
): NaturopathInsight {
  // --- Correlation insights (templated) ---
  const correlationInsights = ctx.correlations.map((c) => {
    const factorLabel = formatFactor(c.factorA);
    const symptomLabel = formatSymptom(c.factorB);
    const absPp = Math.round(Math.abs(c.effectSizePct));
    const verb = c.direction === 'positive' ? 'increases' : 'reduces';
    const confidence =
      c.occurrences >= 30 ? 'high' : c.occurrences >= 15 ? 'moderate' : 'low';

    return {
      factor: c.factorA,
      symptom: c.factorB,
      direction: c.direction,
      effectPp: c.effectSizePct,
      explanation: `Your data shows ${factorLabel.toLowerCase()} ${verb} ${symptomLabel} by ${absPp}%.`,
      mechanism: '',
      actionable: absPp >= 20,
      recommendation:
        absPp >= 20
          ? `Consider discussing ${factorLabel.toLowerCase()} with your healthcare provider.`
          : 'Keep tracking — more data will clarify this pattern.',
      caveat:
        confidence === 'low'
          ? `Based on ${c.occurrences} observations — early signal, needs more data.`
          : null,
      confidenceLevel: confidence as 'high' | 'moderate' | 'low',
    };
  });

  // --- Helps / Hurts ---
  const helps: NaturopathInsight['helpsHurts']['helps'] = [];
  const hurts: NaturopathInsight['helpsHurts']['hurts'] = [];

  for (const c of ctx.correlations) {
    const entry = {
      factor: c.factorA,
      symptom: c.factorB,
      explanation: `${formatFactor(c.factorA)} ${c.direction === 'negative' ? 'reduces' : 'increases'} ${formatSymptom(c.factorB)} by ${Math.round(Math.abs(c.effectSizePct))}%.`,
      strength: Math.abs(c.effectSizePct),
    };
    if (c.direction === 'negative') {
      helps.push(entry);
    } else {
      hurts.push(entry);
    }
  }

  helps.sort((a, b) => b.strength - a.strength);
  hurts.sort((a, b) => b.strength - a.strength);

  // --- Contradictions ---
  const contradictions: NaturopathInsight['contradictions'] = [];
  const factorDirectionMap = new Map<
    string,
    { positive: string[]; negative: string[] }
  >();

  for (const c of ctx.correlations) {
    if (!factorDirectionMap.has(c.factorA)) {
      factorDirectionMap.set(c.factorA, { positive: [], negative: [] });
    }
    const entry = factorDirectionMap.get(c.factorA)!;
    if (c.direction === 'positive') {
      entry.positive.push(c.factorB);
    } else {
      entry.negative.push(c.factorB);
    }
  }

  for (const [factor, dirs] of factorDirectionMap) {
    if (dirs.positive.length > 0 && dirs.negative.length > 0) {
      contradictions.push({
        factor,
        helpsSymptom: formatSymptom(dirs.negative[0]),
        hurtsSymptom: formatSymptom(dirs.positive[0]),
        explanation: `${formatFactor(factor)} appears to help with ${formatSymptom(dirs.negative[0])} but worsen ${formatSymptom(dirs.positive[0])}. This can happen when a factor affects different body systems. Discuss timing or dosage with your doctor.`,
      });
    }
  }

  // --- Daily narrative (templated) ---
  let dailyNarrative = '';
  if (ctx.todayScore) {
    const r = ctx.todayScore.readiness;
    const sleep = ctx.todayScore.sleepHours;
    const topSym = ctx.todayScore.topSymptom?.replace(/_/g, ' ');

    if (r != null && r >= 70) {
      dailyNarrative = sleep
        ? `${sleep} hours of sleep is paying off — you're in a good place today.`
        : 'Your body feels well-rested today.';
      dailyNarrative += ' A good day to be active if you feel up to it.';
    } else if (r != null && r >= 40) {
      dailyNarrative = sleep
        ? `You got ${sleep} hours of sleep, which is helping.`
        : 'Some things are working in your favour.';
      dailyNarrative += topSym
        ? ` ${topSym.charAt(0).toUpperCase() + topSym.slice(1)} is weighing on things — listen to what your body needs.`
        : ' Listen to what your body needs today.';
    } else {
      dailyNarrative =
        sleep && sleep < 6
          ? `Only ${sleep} hours of sleep makes everything feel harder.`
          : topSym
            ? `${topSym.charAt(0).toUpperCase() + topSym.slice(1)} is weighing heavily today.`
            : 'Your body is carrying a lot today.';
      dailyNarrative += ' Be extra gentle with yourself — rest is productive too.';
    }
  }

  // --- Weekly story (templated) ---
  let weeklyStory = '';
  if (ctx.recentScores.length >= 3) {
    const avgReadiness =
      ctx.recentScores.reduce((sum, s) => sum + (s.readiness ?? 0), 0) /
      ctx.recentScores.length;
    const rounded = Math.round(avgReadiness);
    weeklyStory = `Your average readiness this week was ${rounded}. `;
    weeklyStory +=
      rounded >= 60
        ? 'Things are trending well — keep up the habits that are working.'
        : 'Some tough days, but each one gives us better data to work with.';
  }

  // --- Forecast (templated) ---
  let forecast = '';
  if (ctx.todayScore?.readiness != null) {
    const r = ctx.todayScore.readiness;
    forecast =
      r >= 60
        ? 'If you sleep well tonight, tomorrow could be even better.'
        : 'A calm evening and early bedtime could help turn things around tomorrow.';
  }

  // --- Nudge ---
  let insightNudge = { title: 'Keep tracking', body: 'More data means better insights. Log daily to see clearer patterns.' };
  if (ctx.correlations.length > 0) {
    const top = ctx.correlations[0];
    const factorLabel = formatFactor(top.factorA);
    const symptomLabel = formatSymptom(top.factorB);
    insightNudge = {
      title: 'Pattern detected',
      body: `${factorLabel} affects your ${symptomLabel}. We saw this in ${top.occurrences} observations.`,
    };
  }

  // --- Symptom guidance (basic) ---
  const symptomGuidance: NaturopathInsight['symptomGuidance'] = {};
  const activeSymptoms = new Set<string>();

  for (const log of ctx.recentLogs) {
    for (const [sym, sev] of Object.entries(log.symptoms)) {
      if (sev > 0) activeSymptoms.add(sym);
    }
  }

  for (const sym of activeSymptoms) {
    const related = ctx.correlations
      .filter((c) => c.factorB === sym)
      .map((c) => c.factorA);

    symptomGuidance[sym] = {
      explanation: `You've been tracking ${formatSymptom(sym)} recently.`,
      recommendations: [
        'Keep logging daily to strengthen pattern detection.',
        'Note any new triggers or changes in routine.',
      ],
      relatedFactors: related,
    };
  }

  return {
    correlationInsights,
    dailyNarrative,
    weeklyStory,
    forecast,
    insightNudge,
    helpsHurts: { helps: helps.slice(0, 5), hurts: hurts.slice(0, 5) },
    contradictions,
    symptomGuidance,
  };
}
