import Groq, { toFile } from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

export interface TranscriptionResult {
  transcription: string;
  duration: number;
  language: string;
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
  provider: "groq-whisper" | "google-stt" = "groq-whisper"
): Promise<TranscriptionResult> {
  try {
    if (provider !== "groq-whisper") {
      throw new Error(`Provider ${provider} is not enabled yet`);
    }

    // Determine file extension and format
    let filename = "voice-input.webm";
    let fileType = mimeType;
    
    // Groq Whisper supports webm, mp3, mp4, mpeg, mpga, m4a, wav, and ogg
    if (mimeType.includes("webm")) {
      filename = "voice-input.webm";
      fileType = "audio/webm";
    } else if (mimeType.includes("wav")) {
      filename = "voice-input.wav";
      fileType = "audio/wav";
    } else if (mimeType.includes("mp3") || mimeType.includes("mpeg")) {
      filename = "voice-input.mp3";
      fileType = "audio/mpeg";
    }

    const audioFile = await toFile(audioBuffer, filename, {
      type: fileType,
    });

    console.log("Transcribing audio:", {
      filename,
      type: fileType,
      size: audioBuffer.length,
    });

    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-large-v3-turbo",
      response_format: "verbose_json",
      language: "en",
      temperature: 0.0,
    });

    return {
      transcription: transcription.text,
      duration: (transcription as any).duration || 0,
      language: (transcription as any).language || "en",
    };
  } catch (error) {
    console.error("Transcription error:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to transcribe audio"
    );
  }
}


