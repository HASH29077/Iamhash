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

  try {
    const xaiRes = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'grok-4.3',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful, concise tutor explaining quiz answers to a first-year university student.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 300
      })
    });

    if (!xaiRes.ok) {
      const errText = await xaiRes.text();
      console.error('xAI API error:', xaiRes.status, errText);
      return res.status(502).json({ error: 'Assistant is temporarily unavailable' });
    }

    const data = await xaiRes.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(502).json({ error: 'Assistant returned an empty response' });
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Explain handler error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
