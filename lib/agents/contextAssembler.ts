/**
 * Context Assembler
 * Builds lightweight context for coordinator decisions
 */

import { CoordinationContext, CoordinatorDecision } from "./types";

/**
 * Maximum conversation history to include
 */
const MAX_CONVERSATION_HISTORY = 6; // Last 6 messages (3 turns)

/**
 * Maximum length for each message
 */
const MAX_MESSAGE_LENGTH = 200;

/**
 * Assemble context for coordinator
 */
export function assembleContext(options: {
  userId?: string;
  conversationId?: string;
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp?: string;
  }>;
  userProfile?: {
    major?: string;
    year?: string;
    interests?: string[];
    gpa?: number;
  };
  previousDecisions?: CoordinatorDecision[];
  metadata?: Record<string, any>;
}): CoordinationContext {
  const {
    userId,
    conversationId,
    conversationHistory,
    userProfile,
    previousDecisions,
    metadata,
  } = options;

  // Trim conversation history to recent messages
  const trimmedHistory = conversationHistory
    ? conversationHistory
        .slice(-MAX_CONVERSATION_HISTORY)
        .map((msg) => ({
          role: msg.role,
          content: truncateMessage(msg.content),
          timestamp: msg.timestamp,
        }))
    : undefined;

  // Keep only recent decisions
  const trimmedDecisions = previousDecisions
    ? previousDecisions.slice(-3)
    : undefined;

  return {
    userId,
    conversationId,
    conversationHistory: trimmedHistory,
    userProfile,
    previousDecisions: trimmedDecisions,
    metadata,
  };
}

/**
 * Truncate long messages
 */
function truncateMessage(content: string, maxLength = MAX_MESSAGE_LENGTH): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.substring(0, maxLength) + "...";
}

/**
 * Build minimal context summary for display
 */
export function buildContextSummary(context: CoordinationContext): string {
  const parts: string[] = [];

  if (context.userProfile?.major) {
    parts.push(`Major: ${context.userProfile.major}`);
  }

  if (context.userProfile?.year) {
    parts.push(`Year: ${context.userProfile.year}`);
  }

  if (context.conversationHistory && context.conversationHistory.length > 0) {
    parts.push(`${context.conversationHistory.length} previous messages`);
  }

  if (context.previousDecisions && context.previousDecisions.length > 0) {
    const lastIntent = context.previousDecisions[context.previousDecisions.length - 1].intent;
    parts.push(`Last intent: ${lastIntent}`);
  }

  return parts.length > 0 ? parts.join(" | ") : "New conversation";
}

/**
 * Extract key entities from conversation history
 */
export function extractEntitiesFromHistory(
  history: Array<{ role: "user" | "assistant"; content: string }>
): string[] {
  const entities = new Set<string>();

  // Common academic terms
  const academicTerms = [
    "calculus",
    "physics",
    "chemistry",
    "biology",
    "english",
    "history",
    "economics",
    "psychology",
    "computer science",
    "engineering",
    "mathematics",
    "exam",
    "midterm",
    "final",
    "assignment",
    "gpa",
    "grade",
    "course",
    "study",
  ];

  // Common career terms
  const careerTerms = [
    "internship",
    "job",
    "resume",
    "interview",
    "career",
    "networking",
    "linkedin",
    "application",
    "company",
  ];

  // Common wellness terms
  const wellnessTerms = [
    "stress",
    "anxiety",
    "mental health",
    "counseling",
    "balance",
    "wellness",
    "sleep",
    "exercise",
  ];

  const allTerms = [...academicTerms, ...careerTerms, ...wellnessTerms];

  history.forEach((msg) => {
    const content = msg.content.toLowerCase();

    allTerms.forEach((term) => {
      if (content.includes(term)) {
        entities.add(term);
      }
    });
  });

  return Array.from(entities);
}

/**
 * Detect conversation continuity
 * Returns true if current query is related to previous conversation
 */
export function detectContinuity(
  currentQuery: string,
  context: CoordinationContext
): {
  isContinuation: boolean;
  relevantHistory: Array<{ role: "user" | "assistant"; content: string }>;
  confidence: number;
} {
  if (!context.conversationHistory || context.conversationHistory.length === 0) {
    return {
      isContinuation: false,
      relevantHistory: [],
      confidence: 0,
    };
  }

  const currentLower = currentQuery.toLowerCase();

  // Check for continuation indicators
  const continuationWords = [
    "also",
    "additionally",
    "furthermore",
    "and",
    "but",
    "however",
    "more",
    "what about",
    "how about",
    "tell me more",
    "continue",
  ];

  const hasContinuationWord = continuationWords.some((word) =>
    currentLower.includes(word)
  );

  // Check for pronouns (indicates reference to previous context)
  const pronouns = ["it", "that", "this", "them", "they", "these", "those"];
  const hasPronouns = pronouns.some((pronoun) =>
    new RegExp(`\\b${pronoun}\\b`, "i").test(currentQuery)
  );

  // Extract entities from current query
  const currentEntities = extractEntitiesFromHistory([
    { role: "user", content: currentQuery },
  ]);

  // Extract entities from previous conversation
  const historyEntities = extractEntitiesFromHistory(context.conversationHistory);

  // Calculate entity overlap
  const overlap = currentEntities.filter((e) => historyEntities.includes(e));
  const overlapRatio =
    currentEntities.length > 0 ? overlap.length / currentEntities.length : 0;

  // Determine if it's a continuation
  let confidence = 0;

  if (hasContinuationWord) confidence += 0.4;
  if (hasPronouns) confidence += 0.3;
  confidence += overlapRatio * 0.3;

  const isContinuation = confidence > 0.5;

  // Get relevant history (last 4 messages)
  const relevantHistory = context.conversationHistory.slice(-4);

  return {
    isContinuation,
    relevantHistory,
    confidence: Math.min(confidence, 1.0),
  };
}

/**
 * Infer persona from conversation history
 */
export function inferPersonaFromHistory(
  context: CoordinationContext
): "academic" | "career" | "wellness" | "general" | null {
  if (!context.previousDecisions || context.previousDecisions.length === 0) {
    return null;
  }

  // Count persona occurrences in last 3 decisions
  const recentDecisions = context.previousDecisions.slice(-3);
  const personaCounts: Record<string, number> = {};

  recentDecisions.forEach((decision) => {
    personaCounts[decision.persona] = (personaCounts[decision.persona] || 0) + 1;
  });

  // Find most common persona
  let maxCount = 0;
  let dominantPersona: any = null;

  Object.entries(personaCounts).forEach(([persona, count]) => {
    if (count > maxCount) {
      maxCount = count;
      dominantPersona = persona;
    }
  });

  // Only return if there's a clear pattern (at least 2 occurrences)
  return maxCount >= 2 ? dominantPersona : null;
}

/**
 * Build conversation summary for context
 */
export function buildConversationSummary(
  history: Array<{ role: "user" | "assistant"; content: string }>
): string {
  if (history.length === 0) {
    return "New conversation";
  }

  const lastUserMessage =
    history
      .slice()
      .reverse()
      .find((msg) => msg.role === "user")?.content || "";

  const summary = truncateMessage(lastUserMessage, 80);

  return `Recent: "${summary}"`;
}

/**
 * Check if query is a simple greeting
 */
export function isGreeting(query: string): boolean {
  const lowerQuery = query.toLowerCase().trim();

  const greetings = [
    "hi",
    "hello",
    "hey",
    "greetings",
    "good morning",
    "good afternoon",
    "good evening",
    "what's up",
    "whats up",
    "sup",
    "yo",
  ];

  return greetings.some((greeting) => {
    const pattern = new RegExp(`^${greeting}[!.?]*$`, "i");
    return pattern.test(lowerQuery);
  });
}

/**
 * Check if query needs clarification
 */
export function needsClarification(query: string): boolean {
  const lowerQuery = query.toLowerCase().trim();

  // Very short queries
  if (lowerQuery.length < 10) {
    return true;
  }

  // Vague questions
  const vaguePatterns = [
    /^(what|how|when|where|why)[\s?!.]*$/i,
    /^(help|assist|support)[\s?!.]*$/i,
    /^i need help[\s?!.]*$/i,
    /^can you help[\s?!.]*$/i,
    /^what should i do[\s?!.]*$/i,
    /^i don't know[\s?!.]*$/i,
  ];

  return vaguePatterns.some((pattern) => pattern.test(lowerQuery));
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input: string): string {
  // Remove excessive whitespace
  let sanitized = input.replace(/\s+/g, " ").trim();

  // Remove potential injection attempts
  sanitized = sanitized.replace(/[<>]/g, "");

  // Limit length
  const MAX_INPUT_LENGTH = 1000;
  if (sanitized.length > MAX_INPUT_LENGTH) {
    sanitized = sanitized.substring(0, MAX_INPUT_LENGTH);
  }

  return sanitized;
}
