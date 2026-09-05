/**
 * Grounded assistant.
 *
 * The model never answers from memory about a specific fruit in the user's
 * photo: the detections and the matching knowledge-base rows are injected as
 * context, and the system prompt forbids inventing shelf lives. If the OpenAI
 * key is missing the service degrades to a template answer built from the
 * same knowledge base, so the application still demos without a key.
 */
const OpenAI = require('openai');

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
let client = null;

function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

function systemPrompt(lang) {
  const language = lang === 'ar'
    ? 'Answer in Modern Standard Arabic.'
    : 'Answer in English.';
  return [
    'You are the assistant inside an AI fruit ripeness recognition app.',
    'A computer-vision model has already identified the fruit in the user\'s photo and its ripeness stage.',
    'The DETECTION CONTEXT below is the ground truth. Never contradict it and never invent a different fruit.',
    'Shelf-life numbers, storage advice and recommended actions must come from the DETECTION CONTEXT.',
    'If the user asks something the context does not cover (recipes, nutrition, general cooking) answer from general knowledge, briefly.',
    'If no fruit was detected, say so and ask for a clearer photo.',
    'Keep answers under 120 words unless the user asks for detail. Be practical, not chatty.',
    'Never give medical advice; for allergies or health conditions tell the user to consult a professional.',
    language,
  ].join(' ');
}

function fallbackAnswer(detections, lang) {
  if (!detections || detections.length === 0) {
    return lang === 'ar'
      ? 'لم يتم اكتشاف أي فاكهة في الصورة. جرّب صورة أوضح وبإضاءة أفضل.'
      : 'No fruit was detected in the image. Try a clearer photo with better lighting.';
  }
  return detections
    .map((d) => {
      const fruit = d.fruit_label || (d.fruit || '').replace(/_/g, ' ');
      const stage = d.stage_label || d.stage || '';
      const advice = d.advice ? `${d.advice} ` : '';
      // Shelf life is only quoted when we actually have it: a missing number
      // must drop the whole clause rather than print a placeholder.
      const hasDays = Number.isFinite(Number(d.days_room_temperature))
        && Number.isFinite(Number(d.days_refrigerated));
      const room = !hasDays ? '' : (lang === 'ar'
        ? `تقريبًا ${d.days_room_temperature} يوم في حرارة الغرفة، و${d.days_refrigerated} يوم في الثلاجة.`
        : `About ${d.days_room_temperature} day(s) at room temperature, `
          + `${d.days_refrigerated} day(s) refrigerated.`);
      return `${fruit} — ${stage}. ${advice}${room}`.trim();
    })
    .join('\n\n');
}

/**
 * @param {Array} history  [{role:'user'|'assistant', content:string}]
 */
async function ask({ question, detections = [], grounding = '', history = [], lang = 'en' }) {
  const api = getClient();
  if (!api) {
    return { answer: fallbackAnswer(detections, lang), source: 'knowledge-base' };
  }

  const context = [
    'DETECTION CONTEXT',
    detections.length
      ? detections
          .map((d, i) => `${i + 1}. ${d.fruit} — ${d.stage} (confidence ${(d.confidence * 100).toFixed(0)}%)`)
          .join('\n')
      : 'no fruit detected',
    '',
    'VERIFIED GUIDANCE (use these numbers verbatim)',
    grounding || 'none',
  ].join('\n');

  const messages = [
    { role: 'system', content: systemPrompt(lang) },
    { role: 'system', content: context },
    ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ];

  try {
    const res = await api.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 350,
    });
    return { answer: res.choices[0].message.content.trim(), source: MODEL };
  } catch (err) {
    console.error('[llm]', err.message);
    return { answer: fallbackAnswer(detections, lang), source: 'knowledge-base (LLM unavailable)' };
  }
}

module.exports = { ask, fallbackAnswer };
