'use server';

interface TranslationResult {
  uk?: string;
  en?: string;
  error?: string;
  modelUsed?: string;
}

export async function translateText(text: string, targetLang?: 'uk' | 'en'): Promise<TranslationResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  const MODEL_NAME = 'gemini-2.5-flash'; // HARDCODED MODEL
  
  if (!apiKey) {
    return { error: 'API Key is missing on server' };
  }

  if (!text || text.trim().length === 0) {
    return { error: 'Text is empty' };
  }

  try {
    let prompt;
    
    if (targetLang === 'uk') {
      prompt = `
        You are a professional translator for UI interfaces.
        Translate the following text from Russian to Ukrainian.
        Keep the tone professional and concise.
        IMPORTANT: Preserve any HTML tags (like <br/>, <b>, etc) or variables in brackets exactly as they are. Do NOT translate or remove them.
        
        Input text: "${text}"
        
        Return ONLY a raw JSON object with this exact structure:
        {
          "uk": "translation here"
        }
      `;
    } else if (targetLang === 'en') {
      prompt = `
        You are a professional translator for UI interfaces.
        Translate the following text from Russian to English.
        Keep the tone professional and concise.
        IMPORTANT: Preserve any HTML tags (like <br/>, <b>, etc) or variables in brackets exactly as they are. Do NOT translate or remove them.
        
        Input text: "${text}"
        
        Return ONLY a raw JSON object with this exact structure:
        {
          "en": "translation here"
        }
      `;
    } else {
      prompt = `
        You are a professional translator for UI interfaces.
        Translate the following text from Russian to Ukrainian and English.
        Keep the tone professional and concise.
        IMPORTANT: Preserve any HTML tags (like <br/>, <b>, etc) or variables in brackets exactly as they are. Do NOT translate or remove them.
        
        Input text: "${text}"
        
        Return ONLY a raw JSON object with this exact structure:
        {
          "uk": "translation here",
          "en": "translation here"
        }
      `;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return { error: `Gemini API Error: ${errorData.error?.message || response.statusText}` };
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) return { error: 'Empty response from AI' };

    const jsonString = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      const result = JSON.parse(jsonString);
      return { uk: result.uk, en: result.en, modelUsed: MODEL_NAME };
    } catch (parseError) {
      return { error: 'Failed to parse AI response' };
    }

  } catch (error: any) {
    return { error: error.message || 'Unknown error' };
  }
}
