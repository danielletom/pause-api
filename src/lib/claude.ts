import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

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
      model: openai('gpt-4o-mini'),
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

    // Pre-process data into natural language so the model doesn't fall back to raw JSON
    const sleepDesc = scoreData.sleepHours
      ? (scoreData.sleepHours < 6 ? `only ${scoreData.sleepHours} hours of sleep` : `${scoreData.sleepHours} hours of sleep`)
      : 'unknown sleep';
    const moodDesc = scoreData.mood >= 70 ? 'good mood' : scoreData.mood >= 40 ? 'okay mood' : 'low mood';
    const symptomDesc = scoreData.symptomLoad <= 30 ? 'symptoms are quiet' : scoreData.symptomLoad <= 60 ? 'some symptoms present' : 'symptoms are heavy';
    const stressDesc = scoreData.stressors >= 60 ? 'stress is high' : scoreData.stressors >= 30 ? 'some stress' : 'stress is low';
    const topSymptomDesc = scoreData.topSymptom ? scoreData.topSymptom.replace(/_/g, ' ') : null;

    let corrHint = '';
    if (correlations && correlations.length > 0) {
      const c = correlations[0];
      const f = c.factor.replace(/_/g, ' ');
      const s = c.symptom.replace(/_/g, ' ');
      const pct = Math.round(Math.abs(c.effectSizePct));
      corrHint = c.direction === 'negative'
        ? `Correlation insight: ${f} tends to reduce ${s} by ${pct}%.`
        : `Correlation insight: ${f} tends to increase ${s} by ${pct}%.`;
    }

    const userPrompt = `Today's picture: ${sleepDesc}, ${moodDesc}, ${symptomDesc}, ${stressDesc}.${topSymptomDesc ? ` Top symptom: ${topSymptomDesc}.` : ''}${corrHint ? ` ${corrHint}` : ''}

Write the message:`;

    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      maxOutputTokens: 150,
      system: `You write the daily message inside a perimenopause health app called Pause.

TASK: Write exactly 2 sentences, under 45 words. The message sits inside a card on the home screen.

TONE: Like a warm, wise older sister. Conversational. Gentle. Never clinical.

STRUCTURE:
Sentence 1 — Name what's hard or what's good today in plain English. Weave sleep, mood, symptoms together naturally.
Sentence 2 — One specific, encouraging suggestion. If correlation data is provided, use it.

EXAMPLES OF GREAT MESSAGES:
- "7.5 hours of sleep and your mood is shining — stress is the only thing dragging today down. A short walk might help shake some of that off."
- "Rough night with only 4 hours, and that makes everything feel heavier. Tonight, try winding down 30 minutes earlier — even small shifts help."
- "Your body is doing well today — symptoms stayed quiet and your mood is steady. A great day to enjoy something active if you're up for it."
- "Sleep was decent but stress crept in, and hot flashes showed up again. Your data shows exercise tends to calm those — even 15 minutes counts."

NEVER DO THIS:
- "Good sleep (7.5h) + good mood + low symptom load + high stress" ← NEVER use + signs to list things
- "Low sleep (4h) + great mood" ← NEVER put numbers in parentheses like a formula
- Do not mention scores, numbers out of 100, or the word "readiness"
- Do not give medical advice`,
      prompt: userPrompt,
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
