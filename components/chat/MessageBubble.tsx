"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { ReasoningPanel } from "./ReasoningPanel";
import { cn } from "@/lib/utils";
import {
  GraduationCap,
  Briefcase,
  Heart,
  MessageCircle,
  FileText,
  Volume2,
} from "lucide-react";

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
  audioUrl?: string;
  attachments?: any[];
  createdAt: Date;
}

interface MessageBubbleProps {
  message: Message;
  onPlayAudio?: (url: string) => void;
}

const PERSONA_CONFIG: Record<
  string,
  { name: string; icon: React.ReactNode; color: string }
> = {
  academic: {
    name: "Academic Advisor",
    icon: <GraduationCap className="h-3 w-3" />,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  career: {
    name: "Career Advisor",
    icon: <Briefcase className="h-3 w-3" />,
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  },
  wellness: {
    name: "Wellness Advisor",
    icon: <Heart className="h-3 w-3" />,
    color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  },
  general: {
    name: "General Advisor",
    icon: <MessageCircle className="h-3 w-3" />,
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
};

export function MessageBubble({ message, onPlayAudio }: MessageBubbleProps) {
  const [reasoningExpanded, setReasoningExpanded] = useState(false);
  const isUser = message.role === "user";

  const personaConfig = message.persona
    ? PERSONA_CONFIG[message.persona] || PERSONA_CONFIG.general
    : null;

  return (
    <div
      className={cn(
        "flex gap-3 mb-4",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] space-y-2",
          isUser ? "items-end" : "items-start"
        )}
      >
        {/* Message metadata header (for assistant messages) */}
        {!isUser && (
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {personaConfig && (
              <Badge
                variant="outline"
                className={cn("text-xs flex items-center gap-1", personaConfig.color)}
              >
                {personaConfig.icon}
                <span>{personaConfig.name}</span>
              </Badge>
            )}
            {message.ragUsed && (
              <Badge
                variant="secondary"
                className="text-xs flex items-center gap-1"
              >
                <FileText className="h-3 w-3" />
                <span>Used {message.ragSources?.length || 0} document(s)</span>
              </Badge>
            )}
            {message.isVoiceMode && (
              <Badge
                variant="secondary"
                className="text-xs flex items-center gap-1"
              >
                <Volume2 className="h-3 w-3" />
                <span>Voice response</span>
              </Badge>
            )}
          </div>
        )}

        {/* Reasoning panel (only for assistant messages with reasoning) */}
        {!isUser && message.reasoning && message.reasoning.length > 0 && (
          <ReasoningPanel
            steps={message.reasoning}
            isThinking={false}
            isExpanded={reasoningExpanded}
            onToggle={() => setReasoningExpanded(!reasoningExpanded)}
          />
        )}

        {/* Message content bubble */}
        <div
          className={cn(
            "rounded-lg px-4 py-3 shadow-sm",
            isUser
              ? "bg-blue-600 text-white"
              : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          )}
        >
          {/* User attachments */}
          {isUser && message.attachments && message.attachments.length > 0 && (
            <div className="mb-2 space-y-1">
              {message.attachments.map((attachment: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs text-blue-100"
                >
                  <FileText className="h-3 w-3" />
                  <span>{attachment.name || `Attachment ${idx + 1}`}</span>
                </div>
              ))}
            </div>
          )}

          {/* Message text */}
          <div
            className={cn(
              "prose prose-sm max-w-none",
              isUser
                ? "prose-invert"
                : "prose-gray dark:prose-invert"
            )}
          >
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                code: ({ children, className }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">
                      {children}
                    </code>
                  ) : (
                    <code className={className}>{children}</code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Audio player */}
          {!isUser && message.audioUrl && onPlayAudio && (
            <button
              onClick={() => onPlayAudio(message.audioUrl!)}
              className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition"
            >
              <Volume2 className="h-3 w-3" />
              <span>Play audio response</span>
            </button>
          )}
        </div>

        {/* RAG sources details (if expanded) */}
        {!isUser &&
          message.ragUsed &&
          message.ragSources &&
          message.ragSources.length > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-2">
              <details className="cursor-pointer">
                <summary className="hover:text-gray-700 dark:hover:text-gray-300">
                  View sources
                </summary>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  {message.ragSources.map((source, idx) => (
                    <li key={idx}>{source}</li>
                  ))}
                </ul>
              </details>
            </div>
          )}

        {/* Timestamp */}
        <div
          className={cn(
            "text-xs text-gray-500 dark:text-gray-400 mt-1",
            isUser ? "text-right" : "text-left"
          )}
        >
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}
