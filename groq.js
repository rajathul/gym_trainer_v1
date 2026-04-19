// Groq LLM integration — transforms deterministic feedback into motivating coaching cues.
// Loaded as a regular script before app.js. Exposes window.groqCoach.

const GROQ_API_KEY =
  window.SQUAT_CONFIG_SECRETS?.groqApiKey ||
  window.SQUAT_CONFIG?.groqApiKey ||
  '';

const GROQ_MODEL      = 'llama-3.1-8b-instant';
const GROQ_TIMEOUT_MS = 3000;

const SYSTEM_PROMPT =
  'You are an intense, motivating squat coach giving real-time rep feedback. ' +
  'Rewrite the coaching cue as ONE punchy sentence, 12 words max. ' +
  'Keep the core technical advice. Sound like a real coach — direct, energetic, human. ' +
  'No hashtags. No emojis. No quotation marks. Just the sentence.';

window.groqCoach = {
  get isReady() {
    return Boolean(GROQ_API_KEY);
  },

  async enhance(message) {
    const call = fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: message },
        ],
        max_tokens: 40,
        temperature: 0.8,
      }),
    })
      .then(r => {
        if (!r.ok) throw new Error(`Groq ${r.status}`);
        return r.json();
      })
      .then(d => d.choices[0].message.content.trim());

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Groq timeout')), GROQ_TIMEOUT_MS)
    );

    return Promise.race([call, timeout]);
  },
};
