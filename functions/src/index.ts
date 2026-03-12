import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { GoogleGenAI } from "@google/genai";

import { defineSecret } from "firebase-functions/params";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

export const processCommand = onCall(
  { secrets: [geminiApiKey] },
  async (request) => {
    const { history, schema } = request.data;
    
    if (!history || !Array.isArray(history)) {
      throw new HttpsError("invalid-argument", "The function must be called with a 'history' array argument.");
    }
    
    logger.info("Processing command history length:", history.length);
    
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
    const systemInstruction = `
You are a headless CMS assistant for Contentful.
Your job is to translate user natural language commands into Contentful CMS operations based on the provided Content Model Schema and the previous conversation context.
You must return your response as a valid JSON object with the following structure:
{
  "intent": "create" | "update" | "query" | "publish",
  "contentTypeId": string, // Omit if intent is publish
  "entryId": string, // Required if intent is publish or update based on conversation context
  "fields": {
    // The parsed fields mapped to the appropriate Contentful structure (e.g. { "en-US": "value" }), omit if intent is publish
  },
  "explanation": "A short summary of what action you are proposing to take"
}

If the user asks to publish "it", look at the conversation history Assistant responses to find the Entry ID that was just created.

Content Model Schema:
${JSON.stringify(schema, null, 2)}
`;

    // Process using Gemini 2.5 Flash
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: request.data.history,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      }
    });
    
    const responseText = response.text || "{}";
    const result = JSON.parse(responseText);
    
    logger.info("Gemini output:", result);
    return result;
    
  } catch (error: any) {
    logger.error("Error processing command:", error);
    throw new HttpsError("internal", error.message || "An error occurred while processing the command.");
  }
});
