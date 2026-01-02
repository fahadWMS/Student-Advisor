import Groq from "groq-sdk";

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is required');
  }
  return new Groq({ apiKey });
}

export interface ImageAnalysisResult {
  description: string;
  extractedText?: string;
  keyElements: string[];
  educationalContext: string;
}

export async function analyzeImage(
  imageBase64: string,
  imageType: string,
  userPrompt?: string
): Promise<ImageAnalysisResult> {
  try {
    // Validate image formats
    if (!["image/jpeg", "image/png", "image/jpg", "image/webp"].includes(imageType)) {
      console.warn(`[Image Analysis] Unsupported format: ${imageType}. Proceeding anyway...`);
    }

    const groq = getGroqClient();
    
    const defaultPrompt = `Analyze this image thoroughly.
• Describe the content clearly.
• Extract visible text, numbers, diagrams, or writing.
• Identify key information.
• Provide educational relevance if applicable.`;

    // Groq's latest vision models (Llama 4)
    const modelNames = [
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "meta-llama/llama-4-maverick-17b-128e-instruct"
    ];

    let responseText: string | undefined = undefined;
    let lastError: any = null;
    
    for (const modelName of modelNames) {
      try {
        console.log(`[Image Analysis] Trying model: ${modelName}`);
        
        const completion = await groq.chat.completions.create({
          model: modelName,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: userPrompt || defaultPrompt,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${imageType};base64,${imageBase64}`,
                  },
                },
              ] as any,
            },
          ],
          max_tokens: 1200,
          temperature: 0.2,
        });

        responseText = completion.choices?.[0]?.message?.content;
        
        if (responseText) {
          console.log(`[Image Analysis] ✔ Success using: ${modelName}`);
          break;
        }
      } catch (error: any) {
        console.log(`[Image Analysis] ❌ Failed on ${modelName}: ${error.message?.slice(0, 200)}`);
        lastError = error;
      }
    }
    
    // If all models fail → safe structured fallback (don't throw)
    if (!responseText) {
      console.warn("[Image Analysis] All vision models failed. Returning empty analysis.");
      
      return {
        description: "Vision model could not process the image. No analysis available.",
        extractedText: undefined,
        keyElements: [],
        educationalContext: ""
      };
    }

    // Parse response to extract structured information
    const keyElements = extractKeyElements(responseText);
    const educationalContext = extractEducationalContext(responseText);
    const extractedText = extractText(responseText);

    return {
      description: responseText,
      extractedText,
      keyElements,
      educationalContext,
    };
  } catch (error) {
    console.error("Image analysis fatal error:", error);
    
    // Return safe fallback instead of throwing
    return {
      description: "Image analysis failed unexpectedly.",
      extractedText: undefined,
      keyElements: [],
      educationalContext: ""
    };
  }
}

function extractKeyElements(text: string): string[] {
  const keywords = text
    .toLowerCase()
    .match(/\b(diagram|chart|graph|equation|formula|concept|theory|principle|note|assignment|problem|solution|table)\b/g);
  
  return keywords ? [...new Set(keywords)] : [];
}

function extractEducationalContext(text: string): string {
  const sentences = text.split(/[.!?]+/);
  const educational = sentences.filter((s) =>
    /\b(explains|illustrates|represents|formula|concept|theory|principle|definition|topic|demonstrates|shows)\b/i.test(s)
  );
  
  return educational.slice(0, 3).join(". ").trim();
}

function extractText(text: string): string | undefined {
  // Look for patterns like: "Extracted text: ..."
  const match = text.match(/(extracted text|detected text|text found|visible text)[^\n:]*[:\-]\s*(.+)/i);
  if (match) return match[2].trim();

  // Secondary: look for quoted text
  const quotes = text.match(/"([^"]{3,})"/g);
  if (quotes) return quotes.map((q) => q.replace(/"/g, "")).join("\n");

  return undefined;
}
