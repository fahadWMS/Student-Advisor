"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Download, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  audioUrl: string;
  className?: string;
}

export function AudioPlayer({ audioUrl, className }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleSpeedChange = () => {
    const speeds = [1, 1.25, 1.5, 1.75, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleRestart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = "audio.mp3";
    a.click();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn("flex flex-col gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg", className)}>
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={togglePlayPause}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          className="flex-1"
        />

        <span className="text-xs text-gray-600 dark:text-gray-400 font-mono min-w-[80px]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleSpeedChange}
          title="Playback speed"
        >
          {playbackSpeed}x
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleRestart}
          title="Restart"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleDownload}
          title="Download"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
