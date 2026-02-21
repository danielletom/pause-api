import { generateText } from 'ai';
import { gateway } from '@ai-sdk/gateway';

export interface WeekSummary {
  topSymptoms: { name: string; avgSeverity: number; dayCount: number }[];
  avgSleepHours: number;
  avgMood: number;
  bestDay: { date: string; mood: number; symptomCount: number } | null;
  worstDay: { date: string; mood: number; symptomCount: number } | null;
  streak: number;
  topCorrelations: { factor: string; symptom: string; direction: string; effectSizePct: number }[];
  totalLogs: number;
}

export interface ScoreComponents {
  readiness: number;
  sleep: number;
  mood: number;
  symptomLoad: number;
  stressors: number;
  sleepHours: number | null;
  topSymptom: string | null;
}

export async function generateWeeklyNarrative(weekData: WeekSummary): Promise<string> {
  try {
    const { text } = await generateText({
      model: gateway('anthropic/claude-sonnet-4-20250514'),
      maxOutputTokens: 200,
      system: `You are a compassionate health data narrator for Pause, a menopause wellness app.
Given a user's weekly data summary, write a 2-3 sentence narrative that:
- Highlights the biggest positive change or achievement
- Names the most likely cause from their data if one stands out
- Gives one specific, actionable suggestion for next week
- Uses warm, encouraging language — never clinical or alarming
- Never mentions specific medical diagnoses or treatments
- Keep it under 60 words`,
      prompt: JSON.stringify(weekData, null, 2),
    });

    return text.trim();
  } catch (error) {
    console.error('Failed to generate weekly narrative:', error);

    const topSymptom = weekData.topSymptoms[0]?.name ?? 'your symptoms';
    const sleepRounded = Math.round(weekData.avgSleepHours * 10) / 10;

    return `You logged ${weekData.totalLogs} times this week — great consistency! Your average sleep was ${sleepRounded} hours, and ${topSymptom} was your most tracked symptom. Keep building on that momentum next week.`;
  }
}

export async function generateReadinessNarrative(
  scoreData: ScoreComponents,
  correlations?: { factor: string; symptom: string; direction: string; effectSizePct: number; humanLabel: string }[],
): Promise<string> {
  try {
    const promptData = {
      ...scoreData,
      correlations: correlations?.slice(0, 2) ?? [],
    };

    const { text } = await generateText({
      model: gateway('anthropic/claude-sonnet-4-20250514'),
      maxOutputTokens: 120,
      system: `You are a compassionate health narrator for Pause, a menopause tracking app for women 45-60.
Write 2 concise sentences (under 40 words total) explaining today's readiness score.

Rules:
- First sentence: Explain WHY the score is what it is using their actual data (sleep hours, symptom load, mood, stress)
- Second sentence: Give ONE specific, actionable suggestion backed by their correlation data if available
- If a correlation shows something "reduces" symptoms by X%, mention it as evidence (e.g., "your data shows exercise reduces hot flashes by 33%")
- Use warm, supportive language — like a knowledgeable friend, not a doctor
- Never give medical advice or mention diagnoses
- Be specific with numbers from their data, not generic
- Address the reader as "your" not "you"`,
      prompt: JSON.stringify(promptData, null, 2),
    });

    return text.trim();
  } catch (error) {
    console.error('Failed to generate readiness narrative:', error);

    // Conversational fallback using actual data
    const topSymptomLabel = scoreData.topSymptom ? scoreData.topSymptom.replace(/_/g, ' ') : null;

    let corrTip = '';
    if (correlations && correlations.length > 0) {
      const c = correlations[0];
      const factor = c.factor.replace(/_/g, ' ');
      const symptom = c.symptom.replace(/_/g, ' ');
      const pct = Math.round(Math.abs(c.effectSizePct));
      corrTip = c.direction === 'negative'
        ? ` Your data shows ${factor} reduces ${symptom} by ${pct}%.`
        : ` We've noticed ${factor} tends to increase ${symptom} by ${pct}%.`;
    }

    if (scoreData.readiness >= 70) {
      const sleepNote = scoreData.sleepHours ? `${scoreData.sleepHours} hours of sleep is paying off` : 'Your body feels well-rested';
      return `${sleepNote} — you're in a good place today.${corrTip || ' A good day to be active if you feel up to it.'}`;
    } else if (scoreData.readiness >= 40) {
      const sleepNote = scoreData.sleepHours ? `You got ${scoreData.sleepHours} hours of sleep` : 'Some things are working in your favour';
      const dragNote = topSymptomLabel ? `but ${topSymptomLabel} is weighing on things` : 'but your body could use some extra care';
      return `${sleepNote}, ${dragNote}. Listen to what your body needs today.${corrTip}`;
    } else {
      const context = scoreData.sleepHours && scoreData.sleepHours < 6
        ? `Only ${scoreData.sleepHours} hours of sleep is making everything feel harder`
        : topSymptomLabel
          ? `${topSymptomLabel.charAt(0).toUpperCase() + topSymptomLabel.slice(1)} is weighing heavily today`
          : 'Your body is carrying a lot today';
      return `${context}. Be extra gentle with yourself — rest is productive too.${corrTip}`;
    }
  }
}
