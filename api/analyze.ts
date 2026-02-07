import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

enum ClassificationType {
  CHILD_LOGISTICS = 'CHILD_LOGISTICS',
  MIXED = 'MIXED',
  PERSONAL_BAIT = 'PERSONAL_BAIT',
  UNKNOWN = 'UNKNOWN'
}

enum RecommendedAction {
  RESPOND = 'RESPOND',
  NO_RESPONSE = 'NO_RESPONSE',
  WAIT_24_HOURS = 'WAIT_24_HOURS'
}

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    classification: {
      type: Type.STRING,
      enum: [
        ClassificationType.CHILD_LOGISTICS,
        ClassificationType.MIXED,
        ClassificationType.PERSONAL_BAIT,
        ClassificationType.UNKNOWN
      ],
      description: "Classify the incoming message based on content."
    },
    manipulationTags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of manipulative tactics found (e.g., 'Guilt Bait', 'Urgency', 'Blame Shift', 'Topic Drift'). Empty if none."
    },
    reasoning: {
      type: Type.STRING,
      description: "Brief, non-judgmental explanation of why this classification and action were chosen."
    },
    recommendedAction: {
      type: Type.STRING,
      enum: [RecommendedAction.RESPOND, RecommendedAction.NO_RESPONSE, RecommendedAction.WAIT_24_HOURS],
      description: "The recommended course of action."
    },
    draftResponse: {
      type: Type.STRING,
      description: "A neutral, grey-rock response if action is RESPOND. Null if NO_RESPONSE.",
      nullable: true
    }
  },
  required: ["classification", "manipulationTags", "reasoning", "recommendedAction"]
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, mode, decreeContext, planContext } = req.body;

  if (!message || !mode) {
    return res.status(400).json({ error: 'Missing required fields: message, mode' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
    You are 'Parallel', an AI assistant helping a high-conflict co-parent maintain boundaries using the 'Grey Rock' method.

    YOUR GOAL:
    1. Identify manipulation.
    2. Restrict engagement to child-related logistics only.
    3. Generate neutral, court-safe responses.

    DEFINITIONS:
    - CHILD_LOGISTICS: Pertains strictly to pick-up/drop-off, medical, school, or direct child needs.
    - PERSONAL_BAIT: Attacks on character, past relationship issues, emotional dumping, non-child topics.
    - MIXED: Contains both logistics and bait.

    RESPONSE GUIDELINES (Grey Rock):
    - Boring, factual, brief.
    - No emotion, no defense, no JADE (Justify, Argue, Defend, Explain).
    - Remove all salutations (like "Hi", "Dear") unless strictly necessary.
    - Remove all pleasantries (like "Hope you are well").
    - Focus ONLY on the logistical question asked.
    - If the classification is PERSONAL_BAIT, the recommended action MUST be NO_RESPONSE.
    - If the classification is MIXED, ignore the bait completely and only address the logistic.
    - When acknowledging non-logistical emotional statements that require a brief "closure" without engagement, you can use the phrase "Your feelings have been noted."

    CURRENT USER MODE: ${mode}
    - Logistics Only: Strip everything but data.
    - Schedule Only: Focus on dates/times.
    - Court Safe: Extremely formal, polite but distant. Use complete sentences.
    - Parallel Parenting: Minimal contact. Refer to the parenting plan/decree if applicable.

    USER CONTEXT:
    1. DIVORCE DECREE / COURT ORDER (Legal Custody Rules):
    ${decreeContext ? decreeContext : "No specific decree details provided."}

    2. PARENTING PLAN (Schedule/Time):
    ${planContext ? planContext : "No specific schedule provided."}

    INSTRUCTION:
    If the user provided court order or parenting plan details, ensure the draft response strictly adheres to them (e.g., adherence to exchange times, locations, holiday schedules). If the incoming message contradicts the documents, politely and neutrally reference them (e.g., "Per the parenting plan, my time begins at 5 PM on Friday").
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: message,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        temperature: 0.2,
      }
    });

    const jsonText = response.text;
    if (!jsonText) {
      return res.status(500).json({ error: 'Empty response from AI' });
    }

    return res.status(200).json(JSON.parse(jsonText));
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return res.status(500).json({ error: 'Failed to analyze message. Please try again.' });
  }
}
