
// API service for Parallel co-parenting assistant
// Calls serverless functions that securely access Gemini API

import { AnalysisResponse, ResponseMode, SafetyCheckResponse } from "../types";

/**
 * Extracts text from a document image or PDF.
 */
export const extractDocumentText = async (base64Data: string, mimeType: string): Promise<string> => {
  const response = await fetch('/api/extract-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data, mimeType })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to extract text from document.');
  }

  const data = await response.json();
  return data.text;
};

/**
 * Analyzes an incoming message for conflict and generates a neutral response.
 */
export const analyzeMessage = async (
  message: string,
  mode: ResponseMode,
  decreeContext?: string,
  planContext?: string
): Promise<AnalysisResponse> => {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, mode, decreeContext, planContext })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to analyze message. Please try again.');
  }

  return response.json();
};

/**
 * Checks the tone of a drafted response and offers a neutral rewrite if needed.
 */
export const checkDraftSafety = async (draft: string): Promise<SafetyCheckResponse> => {
  const response = await fetch('/api/safety-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to check draft safety.');
  }

  return response.json();
};
