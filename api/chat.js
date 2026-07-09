export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Missing "message" in request body' });
  }

  const safeHistory = Array.isArray(history) ? history.slice(-20) : []; // cap context sent

  // Groq uses the OpenAI-style "messages" array with role "user"/"assistant"/"system"
  // (unlike Gemini's "contents"/"parts"/"model" format), so this is simpler than before.
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

  // Note: image/file attachments from the old Gemini version aren't included here.
  // Groq supports images only on specific vision models — ask if you want that added back.

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages,
        temperature: 0.7,
        max_completion_tokens: 500
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq API error:', groqRes.status, errText);
      return res.status(502).json({ error: 'Assistant is temporarily unavailable' });
    }

    const data = await groqRes.json();
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
