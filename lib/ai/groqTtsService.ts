import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

export interface GroqTTSResult {
  audioUrl: string;
  duration: number;
  rateLimitHit?: boolean;
}

export async function synthesizeSpeechGroq(
  text: string
): Promise<GroqTTSResult> {
  try {
    // Use Groq's TTS endpoint (Play.ai integration)
    const response = await fetch("https://api.groq.com/openai/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "playai-tts",
        input: text,
        voice: "Ruby-PlayAI",
        response_format: "mp3",
        speed: 1.0,
      }),
    });

    // Check for rate limit or request too large
    if (response.status === 429 || response.status === 413) {
      const errorData = await response.json().catch(() => ({}));
      console.warn(`Groq TTS ${response.status} error:`, errorData);
      return {
        audioUrl: "",
        duration: 0,
        rateLimitHit: true,
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq TTS API error: ${response.status} ${errorText}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const base64Audio = audioBuffer.toString("base64");
    const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;

    // Estimate duration (rough: ~150 words/min, ~2.5 chars/word)
    const estimatedDuration = (text.length / 2.5 / 150) * 60;

    return {
      audioUrl,
      duration: estimatedDuration,
      rateLimitHit: false,
    };
  } catch (error) {
    console.error("Groq TTS error:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to synthesize speech with Groq"
    );
  }
}
