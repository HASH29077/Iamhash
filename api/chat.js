export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history, file } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Missing "message" in request body' });
  }

  const safeHistory = Array.isArray(history) ? history.slice(-20) : []; // cap context sent

  const currentParts = [{ text: message }];
  if (file && typeof file.mimeType === 'string' && typeof file.data === 'string') {
    currentParts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
  }

  // Gemini uses "contents" with role "user"/"model" (not "assistant"), and each
  // message's text goes inside a "parts" array.
  const contents = [
    ...safeHistory
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
    { role: 'user', parts: currentParts }
  ];

  const systemInstruction = {
    parts: [{
      text:
        "You are the study assistant inside HashQuiz, a practice-quiz app for university students. " +
        "Be encouraging, concise, and clear. Help students understand topics, quiz them, or explain concepts. " +
        "Keep replies short and mobile-friendly (a few sentences at most), unless the student asks for more detail."
    }]
  };

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction,
          generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
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
    console.error('Chat handler error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
