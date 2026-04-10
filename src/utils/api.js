/**
 * Send the canvas drawing to OpenRouter for AI calligraphy feedback.
 *
 * @param {string} apiKey      — OpenRouter API key
 * @param {string} imageBase64 — Base64-encoded PNG of the canvas (no data URI prefix)
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
  formDescription
) {
  const model =
    localStorage.getItem('openrouter_model') || 'google/gemini-3-flash-preview';

  const response = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
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
              "You are an expert Arabic calligraphy instructor teaching beginners. The student's drawing is in dark ink; the faint watermark in the background is the correct reference stroke they are trying to copy. When giving feedback, compare the student's strokes directly against the reference shape — look at proportions, stroke curvature, entry/exit angles, dot placement (if applicable), and overall shape fidelity. Arabic is written right-to-left, so stroke direction and flow matter. Structure your response: (1) one specific thing they did well — be concrete, e.g. 'Your baseline is steady'; (2) one or two specific things to improve, e.g. 'The downward stroke should taper more at the tip'; (3) a short encouraging close. 3–5 sentences total, conversational not clinical, use the letter's name naturally.",
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`,
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
    }
  );

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return (
    (data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content) ||
    'No feedback.'
  );
}
