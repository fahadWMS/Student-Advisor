"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Loader2, Paperclip, X, Mic, Bot, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageBubble } from "./MessageBubble";
import { ReasoningPanel } from "./ReasoningPanel";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { DEFAULT_TTS_PROVIDER, type TTSProviderId } from "@/lib/voice/config";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  persona?: string;
  ragUsed?: boolean;
  ragSources?: string[];
  reasoning?: Array<{ step: string; content: string }>;
  isVoiceMode?: boolean;
  modelUsed?: string;
  attachments?: Array<{ name: string; type: string; url: string }>;
  createdAt: Date;
}

interface ReasoningStep {
  step: string;
  content: string;
  timestamp?: number;
}

export function ChatInterface() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(false);
  
  // Reasoning state
  const [currentReasoning, setCurrentReasoning] = useState<ReasoningStep[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [currentMetadata, setCurrentMetadata] = useState<any>(null);
  
  // TTS state
  const [ttsProvider] = useState<TTSProviderId>(DEFAULT_TTS_PROVIDER);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [autoSpeakReplies, setAutoSpeakReplies] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsQueueRef = useRef<string[]>([]);
  const ttsProcessingRef = useRef(false);
  const streamBufferRef = useRef<string>("");
  const voiceModeRef = useRef(voiceModeEnabled);
  const autoSpeakRef = useRef(autoSpeakReplies);
  const conversationIdRef = useRef<string | null>(conversationId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      setConversationId(id);
      loadConversationHistory(id);
    } else {
      // Clear conversation for new chat
      setConversationId(null);
      setMessages([]);
    }
  }, [searchParams]);

  useEffect(() => {
    voiceModeRef.current = voiceModeEnabled;
    autoSpeakRef.current = autoSpeakReplies;
  }, [voiceModeEnabled, autoSpeakReplies]);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const loadConversationHistory = async (id: string) => {
    try {
      const response = await fetch(`/api/chat/conversations/${id}/messages`);
      if (response.ok) {
        const data = await response.json();
        const loadedMessages: Message[] = data.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          persona: msg.persona,
          ragUsed: msg.ragUsed,
          ragSources: msg.ragSources,
          reasoning: msg.reasoning?.steps || [],
          isVoiceMode: msg.isVoiceMode,
          modelUsed: msg.modelUsed,
          createdAt: new Date(msg.createdAt),
        }));
        setMessages(loadedMessages);
      }
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter((file) =>
        file.type.startsWith("image/")
      );
      if (files.length) {
        setAttachments((prev) => [...prev, ...files]);
      }
      e.target.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const synthesizeChunk = useCallback(async (text: string, convId: string) => {
    if (!text.trim()) return null;
    if (!convId) {
      console.warn("[TTS] No conversationId provided");
      return null;
    }
    
    console.log("[TTS] Synthesizing chunk:", text.slice(0, 50) + "...");
    
    // Limit to ~800 characters to stay under token limits
    const MAX_CHUNK_LENGTH = 800;
    let textToSynthesize = text.trim();
    
    if (textToSynthesize.length > MAX_CHUNK_LENGTH) {
      const truncated = textToSynthesize.slice(0, MAX_CHUNK_LENGTH);
      const lastPeriod = Math.max(
        truncated.lastIndexOf('. '),
        truncated.lastIndexOf('! '),
        truncated.lastIndexOf('? ')
      );
      if (lastPeriod > MAX_CHUNK_LENGTH * 0.6) {
        textToSynthesize = truncated.slice(0, lastPeriod + 1);
      } else {
        textToSynthesize = truncated;
      }
    }
    
    try {
      const response = await fetch("/api/voice/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToSynthesize,
          conversationId: convId,
          provider: ttsProvider,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.audioUrl) {
        console.error("TTS synthesis failed:", data.error);
        return null;
      }
      console.log("[TTS] Chunk synthesized successfully");
      return data.audioUrl;
    } catch (error) {
      console.error("TTS chunk synthesis error:", error);
      return null;
    }
  }, [ttsProvider]);

  const processAudioQueue = useCallback(async () => {
    if (ttsProcessingRef.current || ttsQueueRef.current.length === 0) return;
    
    console.log("[TTS] Starting audio queue processing, queue length:", ttsQueueRef.current.length);
    ttsProcessingRef.current = true;
    setIsSynthesizing(true);
    
    while (ttsQueueRef.current.length > 0) {
      const audioUrl = ttsQueueRef.current.shift();
      if (!audioUrl) continue;
      
      console.log("[TTS] Playing audio chunk...");
      try {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => {
            console.log("[TTS] Audio chunk finished playing");
            resolve();
          };
          audio.onerror = () => reject(new Error("Audio playback failed"));
          audio.play().catch(reject);
        });
      } catch (error) {
        console.error("[TTS] Audio playback error:", error);
      }
    }
    
    console.log("[TTS] Queue processing complete");
    ttsProcessingRef.current = false;
    setIsSynthesizing(false);
  }, []);

  const sendMessage = async (messageText: string, files: File[]) => {
    const trimmedMessage = messageText.trim();
    if (!trimmedMessage && files.length === 0) return;

    // Add user message
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: trimmedMessage,
      createdAt: new Date(),
      attachments: files.map((file) => ({
        name: file.name,
        type: file.type,
        url: URL.createObjectURL(file),
      })),
    };
    setMessages((prev) => [...prev, userMessage]);

    setIsLoading(true);
    setIsThinking(true);
    setCurrentReasoning([]);
    setStreamingMessage("");
    setCurrentMetadata(null);

    try {
      const formData = new FormData();
      formData.append("message", trimmedMessage);
      formData.append("voiceMode", voiceModeEnabled.toString());
      if (conversationId) {
        formData.append("conversationId", conversationId);
      }
      files.forEach((file) => formData.append("files", file));

      abortControllerRef.current = new AbortController();
      const response = await fetch("/api/chat/message", {
        method: "POST",
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                // Handle conversation ID
                if (data.type === "conversation" && data.conversationId) {
                  setConversationId(data.conversationId);
                  conversationIdRef.current = data.conversationId;
                }

                // Handle reasoning events
                else if (data.type === "reasoning") {
                  setCurrentReasoning((prev) => [
                    ...prev,
                    {
                      step: data.step,
                      content: data.content,
                      timestamp: data.timestamp,
                    },
                  ]);
                }

                // Handle decision event
                else if (data.type === "decision") {
                  setCurrentMetadata((prev: any) => ({
                    ...prev,
                    persona: data.persona,
                    intent: data.intent,
                    confidence: data.confidence,
                    ragNeeded: data.ragNeeded,
                  }));
                }

                // Handle response tokens
                else if (data.type === "token") {
                  setIsThinking(false);
                  fullResponse += data.content;
                  setStreamingMessage(fullResponse);
                  
                  // Streaming TTS: buffer text and speak complete sentences
                  const shouldDoTTS = voiceModeRef.current && autoSpeakRef.current && conversationIdRef.current;
                  if (shouldDoTTS) {
                    streamBufferRef.current += data.content;
                    
                    // Look for sentence boundaries
                    const sentenceEndRegex = /[.!?][\s\n]+/g;
                    const matches = [...streamBufferRef.current.matchAll(sentenceEndRegex)];
                    
                    if (matches.length > 0) {
                      const lastMatch = matches[matches.length - 1];
                      const endIndex = lastMatch.index! + lastMatch[0].length;
                      const textToSpeak = streamBufferRef.current.slice(0, endIndex).trim();
                      
                      if (textToSpeak.length >= 40 && textToSpeak.length <= 800) {
                        streamBufferRef.current = streamBufferRef.current.slice(endIndex);
                        synthesizeChunk(textToSpeak, conversationIdRef.current!).then((audioUrl) => {
                          if (audioUrl) {
                            ttsQueueRef.current.push(audioUrl);
                            if (!ttsProcessingRef.current) {
                              processAudioQueue();
                            }
                          }
                        });
                      }
                    }
                  }
                }

                // Handle completion
                else if (data.type === "done") {
                  console.log("[Chat] Done event metadata:", data.metadata);
                  const assistantMessage: Message = {
                    id: data.messageId || `temp-assistant-${Date.now()}`,
                    role: "assistant",
                    content: fullResponse,
                    persona: data.metadata?.persona,
                    ragUsed: data.metadata?.ragUsed,
                    ragSources: data.metadata?.ragSources,
                    reasoning: currentReasoning,
                    isVoiceMode: voiceModeEnabled,
                    modelUsed: data.metadata?.modelUsed,
                    createdAt: new Date(),
                  };
                  console.log("[Chat] Created message:", {
                    ragUsed: assistantMessage.ragUsed,
                    ragSources: assistantMessage.ragSources,
                    sourcesLength: assistantMessage.ragSources?.length
                  });
                  setMessages((prev) => [...prev, assistantMessage]);
                  setStreamingMessage("");
                  setCurrentReasoning([]);
                  setIsThinking(false);
                }

                // Handle saved message (update ID)
                else if (data.type === "saved") {
                  console.log("[Chat] Message saved with ID:", data.messageId);
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id.startsWith("temp-assistant-")
                        ? { ...msg, id: data.messageId }
                        : msg
                    )
                  );
                }

                // Handle errors
                else if (data.type === "error") {
                  throw new Error(data.content || "Unknown error");
                }
              } catch (e) {
                console.error("SSE parse error:", e);
              }
            }
          }
        }
      }

      // Speak any remaining buffered text
      if (voiceModeEnabled && autoSpeakReplies && streamBufferRef.current.trim() && conversationIdRef.current) {
        const finalText = streamBufferRef.current.trim();
        streamBufferRef.current = "";
        
        // Split into chunks if needed
        const chunks: string[] = [];
        for (let i = 0; i < finalText.length; i += 800) {
          chunks.push(finalText.slice(i, i + 800));
        }
        
        for (const chunk of chunks) {
          synthesizeChunk(chunk, conversationIdRef.current!).then((audioUrl) => {
            if (audioUrl) {
              ttsQueueRef.current.push(audioUrl);
              if (!ttsProcessingRef.current) {
                processAudioQueue();
              }
            }
          });
        }
      } else {
        streamBufferRef.current = "";
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("Request aborted");
      } else {
        console.error("Error sending message:", error);
        const errorMessage: Message = {
          id: `${Date.now()}`,
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
      setIsThinking(false);
      setCurrentReasoning([]);
      setStreamingMessage("");
      streamBufferRef.current = "";
      abortControllerRef.current = null;
    }
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;
    const currentInput = input;
    const currentAttachments = Array.from(attachments);
    setInput("");
    setAttachments([]);
    await sendMessage(currentInput, currentAttachments);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleVoiceTranscription = async (transcription: string) => {
    if (voiceModeEnabled) {
      await sendMessage(transcription, []);
    } else {
      setInput((prev) =>
        prev ? `${prev.trim()} ${transcription}` : transcription
      );
    }
  };

  return (
    <div className="relative flex flex-col h-[calc(100vh-4rem)] bg-background">
      {/* Header */}
      <div className="border-b px-4 py-4 bg-card/80 backdrop-blur">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-wide">
              AI Chat Assistant
            </p>
            <h2 className="text-2xl font-semibold">Student Advisor</h2>
            {isSynthesizing && (
              <p className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                <Volume2 className="h-3 w-3 animate-pulse" />
                Speaking...
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={voiceModeEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setVoiceModeEnabled(!voiceModeEnabled)}
              className="flex items-center gap-2"
            >
              <Mic className="h-4 w-4" />
              {voiceModeEnabled ? "Voice ON" : "Voice OFF"}
            </Button>
            {voiceModeEnabled && (
              <Button
                variant={autoSpeakReplies ? "secondary" : "outline"}
                size="sm"
                onClick={() => setAutoSpeakReplies(!autoSpeakReplies)}
                className="flex items-center gap-2"
                title={autoSpeakReplies ? "Auto-speak enabled" : "Auto-speak disabled"}
              >
                <Volume2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-6 max-w-2xl">
              <Bot className="h-16 w-16 text-blue-600 mx-auto" />
              <h2 className="text-3xl font-bold">Welcome!</h2>
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                I'm your AI student advisor. Ask me about academics, career, or
                wellness.
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {/* Active reasoning panel */}
            {(isThinking || streamingMessage) && (
              <div className="space-y-3">
                {currentReasoning.length > 0 && (
                  <ReasoningPanel
                    steps={currentReasoning}
                    isThinking={isThinking}
                    isExpanded={true}
                  />
                )}

                {streamingMessage && (
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 max-w-[80%] rounded-2xl p-4 border bg-muted">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {streamingMessage}
                        <span className="inline-block w-1 h-4 bg-blue-600 animate-pulse ml-1" />
                      </div>
                    </div>
                  </div>
                )}

                {isLoading && !streamingMessage && !isThinking && (
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-white" />
                    </div>
                    <div className="rounded-2xl border bg-muted p-4">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t bg-card/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto max-w-4xl space-y-3">
          {voiceModeEnabled ? (
            <div className="rounded-2xl border bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-blue-950 p-6">
              <div className="flex flex-col items-center gap-4">
                <VoiceRecorder
                  onTranscription={handleVoiceTranscription}
                  listening={!isLoading}
                  autoLoop
                />
                <p className="text-sm text-muted-foreground text-center">
                  Voice mode active. Speak naturally to send messages.
                </p>
              </div>
            </div>
          ) : (
            <>
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm"
                    >
                      <span>{file.name}</span>
                      <button
                        onClick={() => removeAttachment(index)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-2xl border bg-card/60 px-4 py-3 shadow-lg">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="flex items-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                  >
                    <Paperclip className="h-5 w-5" />
                  </Button>
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask me anything..."
                    className="min-h-[56px] max-h-[240px] flex-1 resize-none border-0 bg-transparent focus-visible:ring-0"
                    disabled={isLoading}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={(!input.trim() && attachments.length === 0) || isLoading}
                    size="icon"
                    className="h-14 w-14 rounded-2xl"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Press Enter to send, Shift+Enter for new line
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
