"use client";

import { Brain, ChevronDown, Loader2 } from "lucide-react";
import { useState } from "react";

interface ReasoningStep {
  step: string;
  content: string;
  timestamp?: number;
}

interface ReasoningPanelProps {
  steps: ReasoningStep[];
  isThinking?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

const STEP_ICONS: Record<string, string> = {
  analyze: "🔍",
  classify: "📋",
  search: "🔎",
  found: "📚",
  route: "🎯",
  generate: "✍️",
  thinking: "💭",
  action: "⚡",
  observation: "👁️",
  decision: "✅",
  check_context: "📝",
  prepare_search: "🔎",
  rag_queries: "🔍",
  classified: "✅",
  image: "🖼️",
};

function getStepIcon(step: string): string {
  return STEP_ICONS[step] || "•";
}

export function ReasoningPanel({
  steps,
  isThinking = false,
  isExpanded: controlledExpanded,
  onToggle,
}: ReasoningPanelProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);

  const isExpanded =
    controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  if (steps.length === 0 && !isThinking) {
    return null;
  }

  return (
    <div className="reasoning-panel border border-gray-200 dark:border-gray-700 rounded-lg mb-3 bg-white dark:bg-gray-800 shadow-sm">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors rounded-t-lg"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <Brain className="h-4 w-4 text-blue-500" />
          {isThinking ? (
            <>
              <span>Thinking</span>
              <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
            </>
          ) : (
            <>
              <span>View reasoning</span>
              <span className="text-xs text-gray-500">
                ({steps.length} steps)
              </span>
            </>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {isExpanded && (
        <div className="p-4 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2 text-sm">
          {steps.map((step, i) => (
            <div
              key={i}
              className="flex items-start gap-3 text-gray-700 dark:text-gray-300 animate-in fade-in slide-in-from-top-2 duration-300"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span className="text-lg leading-none mt-0.5">
                {getStepIcon(step.step)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-relaxed break-words">
                  {step.content}
                </p>
                {step.timestamp && (
                  <span className="text-xs text-gray-400 mt-1 block">
                    {new Date(step.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          ))}
          {isThinking && steps.length > 0 && (
            <div className="flex items-center gap-2 text-blue-500 text-xs pt-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Processing...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
