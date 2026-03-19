import OpenAI from "openai";
import { env } from "../config/env.js";
import { logger } from "../logger.js";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a brutally honest productivity analyst. You never sugarcoat.
You receive a user's stated morning intentions and their actual browser
activity for the day. Write a 150–200 word end-of-day report that:

1. States clearly which goals were met and which were not.
2. Names the specific domains where time was wasted, with durations.
3. Identifies one concrete pattern (e.g. you check YouTube every time
   you open a new tab).
4. Ends with ONE specific, actionable change for tomorrow.

Tone: Like a coach who genuinely wants you to succeed but will not
lie to you. No filler phrases like "it looks like" or "it seems".
Be direct. Second person. Present tense for observations.`;

/**
 * @param {{ goals: string[] }} intentions
 * @param {{ domain: string, seconds: number, category: string }[]} domainSummary
 * @param {number} totalActiveMin
 * @param {string} dateLabel
 */
function buildUserPrompt(intentions, domainSummary, totalActiveMin, dateLabel) {
  const goalsBlock =
    intentions.goals?.length > 0
      ? intentions.goals.map((g, i) => `${i + 1}. ${g}`).join("\n")
      : "(none set)";

  const top = domainSummary.slice(0, 10).map(
    (d) => `- ${d.domain}: ${Math.round(d.seconds / 60)} min (${d.category})`
  );

  return `DATE: ${dateLabel}
TOTAL ACTIVE BROWSER TIME: ${totalActiveMin} minutes

MORNING INTENTIONS:
${goalsBlock}

ACTUAL TIME BREAKDOWN (top 10 domains):
${top.join("\n")}`;
}

/**
 * @param {{ goals: string[] }} intentions
 * @param {{ domain: string, seconds: number, category: string }[]} domainSummary
 * @param {number} totalActiveMin
 * @param {string} dateLabel
 */
export async function generateAccountabilityReport(intentions, domainSummary, totalActiveMin, dateLabel) {
  const userPrompt = buildUserPrompt(intentions, domainSummary, totalActiveMin, dateLabel);

  const reportCompletion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  const ai_summary = reportCompletion.choices[0]?.message?.content?.trim() ?? "";

  const scoreCompletion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          'Return ONLY a JSON object: {"score": <1-10 integer>, "goals_met": string[], "goals_missed": string[]} judging intentions vs behaviour.',
      },
      {
        role: "user",
        content: `${userPrompt}\n\nREPORT:\n${ai_summary}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  let score = 5;
  /** @type {string[]} */
  let goals_met = [];
  /** @type {string[]} */
  let goals_missed = [];

  try {
    const raw = scoreCompletion.choices[0]?.message?.content;
    if (raw) {
      const parsed = JSON.parse(raw);
      score = parsed.score;
      goals_met = parsed.goals_met ?? [];
      goals_missed = parsed.goals_missed ?? [];
    }
  } catch (e) {
    logger.warn({ err: e }, "score json parse");
  }

  return {
    ai_summary,
    score,
    goals_met,
    goals_missed,
  };
}
