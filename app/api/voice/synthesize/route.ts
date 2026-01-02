import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { synthesizeSpeech, synthesizeSpeechElevenLabs } from "@/lib/ai/ttsService";
import { synthesizeSpeechGroq } from "@/lib/ai/groqTtsService";

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await getAuthenticatedUser();
    if (error || !user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { text, conversationId, provider = "groq-tts" } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (!conversationId) {
      return NextResponse.json({ error: "Conversation ID is required" }, { status: 400 });
    }

    // Generate speech
    let result;
    if (provider === "elevenlabs-tts") {
      result = await synthesizeSpeechElevenLabs(text, user.id, conversationId);
    } else if (provider === "groq-tts") {
      try {
        result = await synthesizeSpeechGroq(text);
        if (result.rateLimitHit) {
          return NextResponse.json(
            { error: "Rate limit reached", rateLimitHit: true },
            { status: 429 }
          );
        }
      } catch (groqError: any) {
        // If Groq fails (413 or other errors), fallback to gtts
        console.warn("Groq TTS failed, falling back to gtts:", groqError.message);
        result = await synthesizeSpeech(text, user.id, conversationId);
      }
    } else {
      result = await synthesizeSpeech(text, user.id, conversationId);
    }

    return NextResponse.json({
      success: true,
      audioUrl: result.audioUrl,
      duration: result.duration,
      provider,
    });
  } catch (error: any) {
    console.error("TTS API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to synthesize speech" },
      { status: 500 }
    );
  }
}
