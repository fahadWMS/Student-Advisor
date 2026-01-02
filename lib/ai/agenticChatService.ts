/**
 * Agentic Chat Service
 * Integrates RAG with Gemini for intelligent, context-aware responses
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  enhancePromptWithRAG,
  retrieveUserHistory,
  storeConversationContext,
  RAGContext,
} from "./ragService";

export interface AgenticChatOptions {
  userId?: string;
  conversationId?: string;
  category?: "academic" | "career" | "wellness" | "general";
  useRAG?: boolean;
  usePersonalization?: boolean;
  temperature?: number;
}

export interface AgenticChatResponse {
  message: string;
  contexts: RAGContext[];
  category: string;
  timestamp: string;
}

/**
 * Initialize Gemini client
 */
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  return new GoogleGenerativeAI(apiKey);
}

/**
 * Determine query category using AI
 */
async function detectCategory(
  query: string
): Promise<"academic" | "career" | "wellness" | "general"> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `Classify this student query into ONE category: academic, career, wellness, or general.

Query: "${query}"

Respond with ONLY ONE WORD: academic, career, wellness, or general.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text().trim().toLowerCase();

    if (["academic", "career", "wellness", "general"].includes(response)) {
      return response as "academic" | "career" | "wellness" | "general";
    }

    return "general";
  } catch (error) {
    console.error("Error detecting category:", error);
    return "general";
  }
}

/**
 * Generate context-aware response using RAG + Gemini
 */
export async function generateAgenticResponse(
  userQuery: string,
  options: AgenticChatOptions = {}
): Promise<AgenticChatResponse> {
  const {
    userId,
    conversationId,
    category: providedCategory,
    useRAG = true,
    usePersonalization = true,
    temperature = 0.7,
  } = options;

  try {
    // Auto-detect category if not provided
    const category = providedCategory || (await detectCategory(userQuery));
    console.log(`📂 Detected category: ${category}`);

    let contexts: RAGContext[] = [];
    let enhancedPrompt = userQuery;

    // Retrieve relevant context from knowledge base
    if (useRAG) {
      const ragResult = await enhancePromptWithRAG(userQuery, {
        category,
        topK: 5,
        namespace: category,
        minScore: 0.7,
      });

      contexts = ragResult.contexts;
      enhancedPrompt = ragResult.prompt;

      console.log(`📚 Retrieved ${contexts.length} relevant contexts`);
    }

    // Retrieve user-specific history for personalization
    if (usePersonalization && userId) {
      const userHistory = await retrieveUserHistory(userId, userQuery, 2);
      
      if (userHistory.length > 0) {
        console.log(`👤 Retrieved ${userHistory.length} personalized contexts`);
        
        const historyText = userHistory
          .map((ctx) => `Previous interaction: ${ctx.text}`)
          .join("\n");

        enhancedPrompt = `${historyText}\n\n${enhancedPrompt}`;
        contexts.push(...userHistory);
      }
    }

    // Generate response with Gemini
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-pro",
      generationConfig: {
        temperature,
        maxOutputTokens: 1000,
      },
    });

    const systemPrompt = getSystemPrompt(category);
    const fullPrompt = `${systemPrompt}\n\n${enhancedPrompt}`;

    const result = await model.generateContent(fullPrompt);
    const responseText = result.response.text();

    // Store conversation for future personalization
    if (userId && conversationId && usePersonalization) {
      await storeConversationContext(
        userId,
        conversationId,
        `Q: ${userQuery}\nA: ${responseText}`,
        category
      );
    }

    return {
      message: responseText,
      contexts,
      category,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error generating agentic response:", error);
    throw new Error("Failed to generate response");
  }
}

/**
 * Get system prompt based on category
 */
function getSystemPrompt(
  category: "academic" | "career" | "wellness" | "general"
): string {
  const basePrompt = `You are an intelligent student consultation assistant. Be helpful, empathetic, and provide actionable advice.`;

  const categoryPrompts = {
    academic: `${basePrompt} You specialize in academic success, study strategies, time management, and educational guidance. Focus on helping students achieve their academic goals.`,
    career: `${basePrompt} You specialize in career counseling, professional development, job search strategies, and career planning. Help students prepare for their professional future.`,
    wellness: `${basePrompt} You specialize in student wellness, mental health support, stress management, and work-life balance. Provide compassionate guidance for student well-being.`,
    general: `${basePrompt} Provide comprehensive assistance across academic, career, and wellness topics.`,
  };

  return categoryPrompts[category];
}

/**
 * Stream response for real-time chat (optional enhancement)
 */
export async function* streamAgenticResponse(
  userQuery: string,
  options: AgenticChatOptions = {}
): AsyncGenerator<string, void, unknown> {
  const {
    category: providedCategory,
    useRAG = true,
    temperature = 0.7,
  } = options;

  try {
    const category = providedCategory || (await detectCategory(userQuery));
    let enhancedPrompt = userQuery;

    if (useRAG) {
      const ragResult = await enhancePromptWithRAG(userQuery, {
        category,
        topK: 5,
        namespace: category,
      });
      enhancedPrompt = ragResult.prompt;
    }

    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-pro",
      generationConfig: {
        temperature,
        maxOutputTokens: 1000,
      },
    });

    const systemPrompt = getSystemPrompt(category);
    const fullPrompt = `${systemPrompt}\n\n${enhancedPrompt}`;

    const result = await model.generateContentStream(fullPrompt);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      yield text;
    }
  } catch (error) {
    console.error("Error streaming response:", error);
    yield "Sorry, I encountered an error generating a response.";
  }
}
