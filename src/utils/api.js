import { getItem } from './storage.js';

/**
 * Send the canvas drawing to OpenRouter for AI calligraphy feedback.
 *
 * @param {string} apiKey      — OpenRouter API key
 * @param {string} imageBase64 — Base64-encoded JPEG of the canvas (no data URI prefix)
 * @param {string} letterName  — English name of the letter (e.g. "Ba")
 * @param {string} letterChar  — The Arabic character (e.g. "ب")
 * @param {string} romanName   — Romanized pronunciation (e.g. "b")
 * @param {string} formDescription — Human-friendly form label (e.g. "isolated (stand-alone)")
 * @returns {Promise<string>}  — The AI feedback text
 */
export async function getAIFeedback(
  apiKey,
  imageBase64,
  letterName,
  letterChar,
  romanName,
  formDescription,
) {
  const model = getItem('openrouter_model') || 'google/gemini-3-flash-preview';

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      messages: [
        {
          role: 'system',
          content:
            "You are an expert Arabic calligraphy instructor teaching beginners. The student's drawing is in dark ink; the faint watermark in the background is the correct reference stroke they are trying to copy. When giving feedback, compare the student's strokes directly against the reference shape — look at proportions, stroke curvature, entry/exit angles, dot placement (if applicable), and overall shape fidelity. Arabic is written right-to-left, so stroke direction and flow matter. Structure your response: (1) Start with a score tag in this exact format: [SCORE:N] where N is 1–5 (1=unrecognizable, 2=rough attempt, 3=recognizable with issues, 4=good with minor issues, 5=excellent). (2) One specific thing they did well — be concrete, e.g. 'Your baseline is steady'; (3) one or two specific things to improve, e.g. 'The downward stroke should taper more at the tip'; (4) a short encouraging close. 3–5 sentences total after the score tag, conversational not clinical, use the letter's name naturally.",
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
            {
              type: 'text',
              text: `The student is practicing the ${formDescription} form of the Arabic letter ${letterName} (${letterChar}), romanized as "${romanName}". Their attempt is in dark ink; the faint background is the correct reference. Please compare them and give structured feedback.`,
            },
          ],
        },
      ],
    }),
  });

  const data = await response.json();

  if (data.error) {
    const msg = data.error.message || '';
    const code = data.error.code ?? response.status;

    if (code === 401 || response.status === 401) {
      throw new Error(
        'Invalid API key. Go to Settings → Change key and enter a valid OpenRouter key.',
      );
    }
    if (code === 402 || response.status === 402) {
      throw new Error(
        'Insufficient credits. Top up your OpenRouter balance at openrouter.ai/credits.',
      );
    }
    if (code === 429 || response.status === 429) {
      throw new Error('Rate limit reached. Wait a few seconds and try again.');
    }
    if (code === 503 || response.status === 503) {
      throw new Error('The AI model is temporarily unavailable. Try switching models in Settings.');
    }
    throw new Error(msg || `Unexpected error (${response.status}).`);
  }

  return (
    (data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content) ||
    'No feedback.'
  );
}
