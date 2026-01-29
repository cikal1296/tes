export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    // Parse request body
    const { message, history } = await req.json();
    
    if (!message || !message.trim()) {
      return new Response(
        JSON.stringify({ reply: 'Silakan tulis pesan.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get API key from environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set');
      return new Response(
        JSON.stringify({ reply: 'API key not configured. Please add GEMINI_API_KEY to environment variables.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Prepare conversation history
    const contents = [];
    
    // Add history if available (optional)
    if (history && Array.isArray(history)) {
      history.forEach(msg => {
        if (msg.role && msg.content) {
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          });
        }
      });
    }
    
    // Add current message
    contents.push({
      role: 'user',
      parts: [{ text: message.trim() }]
    });

    // Call Gemini API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        }
      }),
    });

    // Check response status
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      throw new Error(`Gemini API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    // Extract reply
    let reply = "Maaf, tidak ada jawaban dari AI.";
    
    if (data.candidates && 
        data.candidates[0] && 
        data.candidates[0].content && 
        data.candidates[0].content.parts && 
        data.candidates[0].content.parts[0]) {
      reply = data.candidates[0].content.parts[0].text;
    } else if (data.error) {
      reply = `Error: ${data.error.message || 'Unknown error from Gemini'}`;
    }

    // Return success response
    return new Response(
      JSON.stringify({ reply }),
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      }
    );

  } catch (error) {
    console.error('Server error:', error);
    
    // Return error response
    return new Response(
      JSON.stringify({ 
        reply: `Maaf, terjadi kesalahan: ${error.message}. Silakan coba lagi.`
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
