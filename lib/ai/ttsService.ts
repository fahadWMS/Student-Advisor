import gtts from "gtts";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

export interface TTSResult {
  audioUrl: string;
  duration: number;
}

export async function synthesizeSpeech(
  text: string,
  userId: string,
  conversationId: string
): Promise<TTSResult> {
  try {
    // Limit text length for gtts (it can hang on very long text)
    const MAX_GTTS_LENGTH = 500;
    let processedText = text.trim();
    if (processedText.length > MAX_GTTS_LENGTH) {
      processedText = processedText.slice(0, MAX_GTTS_LENGTH);
    }

    // Generate speech using gTTS
    const speech = new gtts(processedText, "en");
    
    // Create temporary file
    const tempDir = path.join(process.cwd(), "tmp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFilePath = path.join(tempDir, `tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
    
    // Save to temporary file with timeout
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        speech.save(tempFilePath, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      }),
      new Promise<void>((_, reject) => 
        setTimeout(() => reject(new Error("gtts timeout after 10s")), 10000)
      )
    ]);

    // Read the file
    const audioBuffer = fs.readFileSync(tempFilePath);

    // Convert to base64 data URL
    const base64Audio = audioBuffer.toString('base64');
    const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;

    // Clean up temp file
    await unlink(tempFilePath);

    // Estimate duration (rough estimate: ~150 words per minute, ~2.5 chars per word)
    const estimatedDuration = (text.length / 2.5 / 150) * 60;

    return {
      audioUrl,
      duration: estimatedDuration,
    };
  } catch (error) {
    console.error("TTS error:", error);
    throw new Error("Failed to synthesize speech");
  }
}

// Alternative: ElevenLabs implementation (premium)
export async function synthesizeSpeechElevenLabs(
  text: string,
  userId: string,
  conversationId: string
): Promise<TTSResult> {
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error("ElevenLabs API key not configured");
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"}`,
      {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());

    // Upload to Supabase
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const fileName = `${userId}/${conversationId}/tts-${Date.now()}.mp3`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("audio")
      .upload(fileName, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: urlData } = supabase.storage
      .from("audio")
      .getPublicUrl(fileName);

    const estimatedDuration = (text.length / 2.5 / 150) * 60;

    return {
      audioUrl: urlData.publicUrl,
      duration: estimatedDuration,
    };
  } catch (error) {
    console.error("ElevenLabs TTS error:", error);
    throw new Error("Failed to synthesize speech with ElevenLabs");
  }
}
