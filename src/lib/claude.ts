import { generateText } from 'ai';

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
      model: 'anthropic/claude-sonnet-4-20250514',
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

export async function generateReadinessNarrative(scoreData: ScoreComponents): Promise<string> {
  try {
    const { text } = await generateText({
      model: 'anthropic/claude-sonnet-4-20250514',
      maxOutputTokens: 80,
      system: `You are a health narrator for Pause, a menopause tracking app.
Write ONE short sentence (under 25 words) explaining today's readiness score.
Be specific about what contributed most. Never give medical advice.
Use warm, natural language.`,
      prompt: JSON.stringify(scoreData, null, 2),
    });

    return text.trim();
  } catch (error) {
    console.error('Failed to generate readiness narrative:', error);

    if (scoreData.readiness >= 70) {
      return 'Your readiness is looking solid today — sleep and mood are working in your favor.';
    } else if (scoreData.readiness >= 40) {
      return 'A mixed day ahead — some factors are strong, others need a little care.';
    } else {
      return 'Today might feel tougher than usual — be extra gentle with yourself.';
    }
  }
}
