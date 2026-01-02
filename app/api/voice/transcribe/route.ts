import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-helpers";
import { transcribeAudio } from "@/lib/ai/transcribeService";

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await getAuthenticatedUser();
    if (error || !user) {
      return unauthorizedResponse();
    }

    // Get audio file from form data
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;
    const provider = (formData.get("provider") as string) || "groq-whisper";

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (audioFile.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 5MB limit" }, { status: 400 });
    }

    // Validate MIME type
    const normalizedType = audioFile.type?.split(";")[0] || "audio/webm";
    const supportedTypes = [
      "audio/webm",
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/m4a",
      "audio/mp4",
      "audio/ogg",
    ];
    if (!supportedTypes.includes(normalizedType)) {
      return NextResponse.json(
        { error: "Unsupported audio format. Use webm, mp3, wav, or m4a" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.info("Transcribe request", {
      type: normalizedType,
      bytes: buffer.byteLength,
    });

    // Transcribe audio
    const result = await transcribeAudio(buffer, normalizedType, provider as any);

    return NextResponse.json({
      success: true,
      transcription: result.transcription,
      duration: result.duration,
      language: result.language,
    });
  } catch (error: any) {
    console.error("Transcription API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to transcribe audio" },
      { status: error.message?.includes("not enabled") ? 400 : 500 }
    );
  }
}
