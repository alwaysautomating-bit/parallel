import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { base64Data, mimeType } = req.body;

  if (!base64Data || !mimeType) {
    return res.status(400).json({ error: 'Missing required fields: base64Data, mimeType' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
    You are a document assistant.
    Your ONLY job is to extract all readable text from the provided document image or PDF.
    Preserve the structure and formatting where possible (e.g. lists, times, headers).
    Do not add any commentary or summary. Just output the extracted text.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: "Extract the text from this document." }
        ]
      },
      config: {
        systemInstruction: systemInstruction,
      }
    });

    const text = response.text || "";
    return res.status(200).json({ text });
  } catch (error) {
    console.error("Document Extraction Error:", error);
    return res.status(500).json({ error: 'Failed to extract text from document.' });
  }
}
