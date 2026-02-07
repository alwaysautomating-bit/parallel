import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

const safetySchema = {
  type: Type.OBJECT,
  properties: {
    isSafe: {
      type: Type.BOOLEAN,
      description: "True if the text is emotionally neutral and factual. False if it contains emotion, defense, or escalation."
    },
    emotionalWords: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of words or phrases identified as emotional or defensive."
    },
    neutralSuggestion: {
      type: Type.STRING,
      description: "A rewritten version of the text that is perfectly neutral and 'Grey Rock'."
    }
  },
  required: ["isSafe", "emotionalWords", "neutralSuggestion"]
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { draft } = req.body;

  if (!draft) {
    return res.status(400).json({ error: 'Missing required field: draft' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
    You are a tone-check filter for 'Parallel', a high-conflict co-parenting app.
    The input text is a draft written BY the user, intended to be sent TO their co-parent.

    YOUR JOB:
    1. Analyze the draft for emotional bait, defensiveness, or apologies.
    2. Ensure it follows the "Grey Rock" method: Boring, factual, zero emotion.
    3. REWRITE the draft if it is unsafe.

    PERSPECTIVE GUIDELINES:
    - The rewrite must be written FROM the user's perspective (e.g., use 'I' correctly, as in 'I will be there at 5').
    - Maintain correct grammar and sentence structure for a direct message to a co-parent.

    NEUTRAL REWRITE STRATEGIES:
    - Use the phrase "Your feelings have been noted" to acknowledge emotional statements or complaints without defending or validating them.
    - Remove all JADE (Justification, Argument, Defense, Explanation).
    - Remove all emotional language, apologies ("I'm sorry"), and pleasantries.
    - Keep it brief and strictly child-related.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: draft,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: safetySchema,
        temperature: 0.1,
      }
    });

    const jsonText = response.text;
    if (!jsonText) {
      return res.status(500).json({ error: 'Empty response from AI' });
    }

    return res.status(200).json(JSON.parse(jsonText));
  } catch (error) {
    console.error("Safety Check Error:", error);
    return res.status(500).json({ error: 'Failed to check draft safety.' });
  }
}
