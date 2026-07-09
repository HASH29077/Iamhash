export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Missing "message" in request body' });
  }

  const safeHistory = Array.isArray(history) ? history.slice(-20) : []; // cap context sent

  const messages = [
    {
      role: 'system',
      content:
        "You are the study assistant inside HashQuiz, a practice-quiz app for university students. " +
        "Be encouraging, concise, and clear. Help students understand topics, quiz them, or explain concepts. " +
        "Keep replies short and mobile-friendly (a few sentences at most), unless the student asks for more detail."
    },
    ...safeHistory
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message }
  ];

  try {
    const xaiRes = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'grok-4.3',
        messages,
        temperature: 0.7,
        max_tokens: 500
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
    console.error('Chat handler error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
