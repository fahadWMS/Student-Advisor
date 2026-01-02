import { GoogleGenerativeAI } from "@google/generative-ai";
import { SYSTEM_PROMPTS } from "./promptTemplates";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export async function generateGeminiResponse(
  message: string,
  model: string,
  persona: 'academic' | 'career' | 'wellness' | 'general' = 'general',
  conversationHistory?: Array<{ role: string; content: string }>,
  images?: Buffer[]
): Promise<string> {
  try {
    const systemPrompt = SYSTEM_PROMPTS[persona];
    
    const geminiModel = genAI.getGenerativeModel({ 
      model,
      systemInstruction: systemPrompt,
    });

    const chat = geminiModel.startChat({
      history: conversationHistory?.map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      })) || [],
    });

    let parts: any[] = [{ text: message }];

    if (images && images.length > 0) {
      for (const imageBuffer of images) {
        parts.push({
          inlineData: {
            data: imageBuffer.toString("base64"),
            mimeType: "image/jpeg",
          },
        });
      }
    }

    const result = await chat.sendMessage(parts);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    console.error("Gemini API error:", error);
    throw new Error(`Gemini API error: ${error.message}`);
  }
}
