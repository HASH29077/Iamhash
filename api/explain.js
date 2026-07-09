export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question, options, correctAnswer, userAnswer } = req.body || {};

  if (!question || !Array.isArray(options) || !correctAnswer) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const missedNote = userAnswer && userAnswer !== correctAnswer
    ? `The student picked "${userAnswer}", which is incorrect.`
    : `The student answered correctly.`;

  const prompt =
    `Question: ${question}\n` +
    `Options: ${options.join(' | ')}\n` +
    `Correct answer: ${correctAnswer}\n` +
    `${missedNote}\n\n` +
    `In 2-3 short sentences, explain why the correct answer is right. If the student got it wrong, ` +
    `briefly note why their choice was a common mix-up, if relevant. Keep it simple and encouraging.`;

  const systemInstruction = {
    parts: [{ text: 'You are a helpful, concise tutor explaining quiz answers to a first-year university student.' }]
  };

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          systemInstruction,
          generationConfig: { temperature: 0.5, maxOutputTokens: 300 }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errText);
      return res.status(502).json({ error: 'Assistant is temporarily unavailable' });
    }

    const data = await geminiRes.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!reply) {
      return res.status(502).json({ error: 'Assistant returned an empty response' });
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Explain handler error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
