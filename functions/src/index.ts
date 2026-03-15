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
  "intent": "create" | "update" | "query" | "publish" | "unpublish" | "delete",
  "contentTypeId": string, // Required for create, update, and query intents
  "entryId": string, // Required if intent is publish, unpublish, or delete. For update, provide if known from conversation context.
  "entryTitle": string, // For update/delete intent: if entryId is unknown, provide the title/name of the entry to search for
  "fields": {
    // The parsed fields mapped to the appropriate Contentful structure (e.g. { "en-US": "value" }), omit if intent is publish/unpublish/delete
  },
  "explanation": "A short summary of what action you are proposing to take"
}

IMPORTANT RULES:
- If the user asks to publish "it", look at the conversation history Assistant responses to find the Entry ID that was just created.
- If the user asks to "unpublish" or "take down" or "revert to draft" an entry, use intent "unpublish".
- If the user asks to "delete" or "remove" an entry permanently, use intent "delete".
- For update intent: if you know the entry ID from conversation history, use "entryId". If you only know the entry title/name, use "entryTitle" so the system can look it up.
- For linking an uploaded image/asset to an entry field, use the Contentful Link structure:
  { "en-US": { "sys": { "type": "Link", "linkType": "Asset", "id": "<ASSET_ID>" } } }
  The Asset ID will be provided in the conversation context as "[Context: Image uploaded as Asset ID: xxx]".

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
