"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { VoiceActivityDetector } from "@/lib/voice/vad";

interface VoiceRecorderProps {
  onTranscription: (text: string) => void | Promise<void>;
  maxDuration?: number;
  className?: string;
  listening?: boolean;
  autoLoop?: boolean;
  onInterrupt?: () => void;
}

export function VoiceRecorder({
  onTranscription,
  maxDuration = 60,
  className,
  listening = false,
  autoLoop = false,
  onInterrupt,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const listeningRef = useRef(listening);
  const autoLoopRef = useRef(autoLoop);
  const startInFlightRef = useRef(false);
  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const recordingMimeTypeRef = useRef<string>("audio/webm");

  useEffect(() => {
    console.log("VoiceRecorder listening changed:", listening);
    listeningRef.current = listening;
  }, [listening]);

  useEffect(() => {
    console.log("VoiceRecorder autoLoop changed:", autoLoop);
    autoLoopRef.current = autoLoop;
  }, [autoLoop]);
  
  useEffect(() => {
    console.log("VoiceRecorder mounted with props:", {
      listening,
      autoLoop,
      maxDuration,
    });
  }, []);

  // Cleanup on unmount only - DO NOT depend on isRecording!
  useEffect(() => {
    return () => {
      console.log("VoiceRecorder unmounting, cleaning up...");
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      vadRef.current?.stop();
    };
  }, []); // Empty dependency array - only run on unmount

  const cleanupTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const transcribeAudio = useCallback(
    async (audioBlob: Blob) => {
      setIsProcessing(true);
      try {
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        const response = await fetch("/api/voice/transcribe", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Transcription failed");
        }

        if (data.transcription) {
          await onTranscription(data.transcription);
        }
      } catch (err: any) {
        const message = err?.message || "Failed to transcribe audio";
        setError(message);
        console.error(err);
      } finally {
        setIsProcessing(false);
        setDuration(0);
      }
    },
    [onTranscription]
  );

  const stopRecording = useCallback(() => {
    console.log("stopRecording called, mediaRecorder state:", mediaRecorderRef.current?.state);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log("✋ Stopping MediaRecorder");
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      cleanupTimer();
      vadRef.current?.stop();
    } else {
      console.log("⚠️ MediaRecorder not in recording state, cannot stop");
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || isProcessing) return;
    try {
      setError(null);
      
      // Trigger interrupt callback to stop any playing audio/AI
      onInterrupt?.();
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });

      // Try to use the best available format
      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/webm";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "audio/ogg;codecs=opus";
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ""; // Use default
          }
        }
      }

      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      
      // Store the MIME type for later use
      recordingMimeTypeRef.current = mimeType || "audio/webm";
      console.log("Recording with MIME type:", recordingMimeTypeRef.current);

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: recordingMimeTypeRef.current });
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());
        
        // Check minimum duration (2 seconds for better quality)
        const recordingDuration = (Date.now() - startTimeRef.current) / 1000;
        console.log("Recording stopped, duration:", recordingDuration, "seconds");
        
        if (recordingDuration < 2) {
          console.warn("⚠️ Recording too short (minimum 2 seconds), skipping transcription");
          setIsProcessing(false);
          setDuration(0);
          
          // In auto-loop mode, restart recording
          if (autoLoopRef.current && listeningRef.current) {
            console.log("Auto-loop: Restarting recording...");
            setTimeout(() => {
              if (!startInFlightRef.current && !isProcessing) {
                startInFlightRef.current = true;
                startRecording().finally(() => {
                  startInFlightRef.current = false;
                });
              }
            }, 500);
          }
          return;
        }
        
        console.log("Audio blob created:", {
          type: recordingMimeTypeRef.current,
          size: audioBlob.size,
          duration: recordingDuration,
        });
        
        await transcribeAudio(audioBlob);
      };

      // Start recording with proper state management
      try {
        mediaRecorder.start();
        console.log("MediaRecorder started successfully");
      } catch (startError) {
        console.error("Failed to start MediaRecorder:", startError);
        stream.getTracks().forEach(track => track.stop());
        throw startError;
      }

      setIsRecording(true);
      setDuration(0);
      startTimeRef.current = Date.now();
      
      // Setup timer to update duration display
      cleanupTimer();
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          const newDuration = prev + 1;
          if (newDuration >= maxDuration) {
            console.log("⏰ Max duration reached, stopping");
            stopRecording();
            return maxDuration;
          }
          return newDuration;
        });
      }, 1000);
      
      console.log("✅ Recording timer started, timerRef:", timerRef.current);
      
      // Start VAD for auto-silence detection (with longer delays)
      if (autoLoopRef.current) {
        vadRef.current = new VoiceActivityDetector({
          silenceThreshold: 3000, // 3 seconds of silence before stopping
          volumeThreshold: 30, // Lower threshold for better sensitivity
          checkInterval: 200, // Check less frequently
          minSpeechDuration: 1000, // Must speak for 1 second to be considered speech
          activationDelay: 3000, // Wait 3 seconds after start before VAD becomes active
        });
        await vadRef.current.start(
          stream,
          () => {
            // User stopped speaking
            const recordingDuration = (Date.now() - startTimeRef.current) / 1000;
            console.log('VAD: Silence detected after', recordingDuration, 'seconds');
            
            // Only stop if we've been recording for at least 2 seconds
            if (recordingDuration >= 2) {
              console.log('VAD: Stopping recording');
              stopRecording();
            } else {
              console.log('VAD: Recording too short, ignoring silence detection');
            }
          },
          () => {
            // User started speaking
            console.log('VAD: Speech detected');
          }
        );
      }
    } catch (err) {
      console.error("Error starting recording:", err);
      setError("Failed to access microphone");
      setIsRecording(false);
      setIsProcessing(false);
      cleanupTimer();
    }
  }, [isProcessing, isRecording, maxDuration, stopRecording, transcribeAudio, onInterrupt]);

  // Auto-loop effect for voice mode
  useEffect(() => {
    const shouldAutoRecord = autoLoop && listening;
    
    if (!shouldAutoRecord) {
      console.log("❌ Auto-loop disabled or not listening");
      return;
    }
    
    if (isRecording || isProcessing || startInFlightRef.current) {
      console.log("⏸️ Auto-loop paused - already recording or processing");
      return;
    }

    console.log("⏰ Auto-loop: Starting timer to begin recording...");
    
    // Add delay before auto-starting to avoid immediate trigger
    const timer = setTimeout(() => {
      if (!isRecording && !isProcessing && !startInFlightRef.current && listening) {
        console.log("✅ Auto-starting recording in voice mode");
        startInFlightRef.current = true;
        startRecording()
          .then(() => {
            console.log("✅ Recording started successfully");
          })
          .catch((err) => {
            console.error("❌ Failed to start recording:", err);
            startInFlightRef.current = false;
          });
      } else {
        console.log("⏭️ Auto-start cancelled - state changed");
      }
    }, 1000); // Increased delay to 1 second

    return () => {
      clearTimeout(timer);
    };
  }, [autoLoop, listening, isRecording, isProcessing, startRecording]);

  useEffect(() => {
    if (!listening && isRecording) {
      stopRecording();
    }
  }, [listening, isRecording, stopRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderManualControls = () => (
    <>
      {!isRecording ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={startRecording}
          disabled={isProcessing}
          title="Start recording"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
      ) : (
        <>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={stopRecording}
            className="animate-pulse"
            title="Stop recording"
          >
            <Square className="h-4 w-4" />
          </Button>
          <span className="text-sm font-mono text-red-600">
            {formatDuration(duration)} / {formatDuration(maxDuration)}
          </span>
        </>
      )}
    </>
  );

  const renderAutoStatus = () => (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              isRecording ? "bg-emerald-500 animate-pulse" : isProcessing ? "bg-yellow-500" : "bg-gray-400"
            )}
          />
          <span className="text-sm font-medium text-foreground dark:text-white">
            {isRecording ? "Listening…" : isProcessing ? "Processing…" : "Idle"}
          </span>
        </div>
        {isRecording && (
          <>
            <span className="text-xs text-muted-foreground dark:text-white/70 font-mono">
              {formatDuration(duration)} / {formatDuration(maxDuration)}
            </span>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={stopRecording}
              className="h-7 px-3"
              title="Stop recording manually"
            >
              <Square className="h-3 w-3 mr-1" />
              Stop
            </Button>
          </>
        )}
      </div>
    </div>
  );

  const shouldAutoRecord = autoLoop && listening;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {shouldAutoRecord ? renderAutoStatus() : renderManualControls()}
      {error && <span className="text-sm text-red-500">{error}</span>}
    </div>
  );
}
