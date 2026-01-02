export type TTSProviderId = "google-tts" | "elevenlabs-tts" | "groq-tts";

type TTSProvider = {
  id: TTSProviderId;
  label: string;
  vendor: "google" | "elevenlabs" | "groq";
  freeTier: string;
  bestFor: string;
  requirements: string[];
  docs: string;
  default: boolean;
};

export const TTS_PROVIDERS: TTSProvider[] = [
  {
    id: "groq-tts",
    label: "Groq Play.ai TTS",
    vendor: "groq",
    bestFor: "Fast, natural speech synthesis",
    freeTier: "Rate limited",
    requirements: ["GROQ_API_KEY"],
    docs: "https://console.groq.com",
    default: true,
  },
  {
    id: "google-tts",
    label: "Google gTTS",
    vendor: "google",
    bestFor: "Instant playback with lightweight voices",
    freeTier: "Free (gTTS library)",
    requirements: [],
    docs: "https://cloud.google.com/text-to-speech",
    default: false,
  },
  {
    id: "elevenlabs-tts",
    label: "ElevenLabs",
    vendor: "elevenlabs",
    bestFor: "Hyper-real voices & cloning",
    freeTier: "10k chars/mo",
    requirements: ["ELEVENLABS_API_KEY"],
    docs: "https://docs.elevenlabs.io/",
    default: false,
  },
];

export const DEFAULT_TTS_PROVIDER: TTSProviderId =
  TTS_PROVIDERS.find((p) => p.default)?.id || "groq-tts";
