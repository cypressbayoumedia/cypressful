"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.processCommand = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const genai_1 = require("@google/genai");
const params_1 = require("firebase-functions/params");
const geminiApiKey = (0, params_1.defineSecret)("GEMINI_API_KEY");
exports.processCommand = (0, https_1.onCall)({ secrets: [geminiApiKey] }, async (request) => {
    const { history, schema } = request.data;
    if (!history || !Array.isArray(history)) {
        throw new https_1.HttpsError("invalid-argument", "The function must be called with a 'history' array argument.");
    }
    logger.info("Processing command history length:", history.length);
    try {
        const ai = new genai_1.GoogleGenAI({ apiKey: geminiApiKey.value() });
        const systemInstruction = `
You are a headless CMS assistant for Contentful.
Your job is to translate user natural language commands into Contentful CMS operations based on the provided Content Model Schema and the previous conversation context.
You must return your response as a valid JSON object with the following structure:
{
  "intent": "create" | "update" | "query" | "publish",
  "contentTypeId": string, // Required for create, update, and query intents
  "entryId": string, // Required if intent is publish. For update, provide if known from conversation context.
  "entryTitle": string, // For update intent: if entryId is unknown, provide the title/name of the entry to search for
  "fields": {
    // The parsed fields mapped to the appropriate Contentful structure (e.g. { "en-US": "value" }), omit if intent is publish
  },
  "explanation": "A short summary of what action you are proposing to take"
}

IMPORTANT RULES:
- If the user asks to publish "it", look at the conversation history Assistant responses to find the Entry ID that was just created.
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
    }
    catch (error) {
        logger.error("Error processing command:", error);
        throw new https_1.HttpsError("internal", error.message || "An error occurred while processing the command.");
    }
});
//# sourceMappingURL=index.js.map