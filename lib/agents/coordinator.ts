/**
 * Coordinator Agent with Reasoning Stream
 * Routes queries and streams reasoning steps to UI
 */

import {
  CoordinationContext,
  CoordinatorDecision,
  CoordinatorResult,
  ReasoningEvent,
  ClassificationResult,
  IntentType,
} from "./types";
import { PersonaType } from "./tools/types";
import { buildCoordinatorPrompt } from "./prompts/coordinatorPrompt";
import { callWithRotation, getModelsForTask, GroqModel } from "./modelRotation";
import {
  assembleContext,
  sanitizeInput,
  isGreeting,
  needsClarification,
  detectContinuity,
  inferPersonaFromHistory,
} from "./contextAssembler";

/**
 * Coordinator with reasoning stream
 * Yields reasoning events as it makes decisions
 */
export async function* coordinateWithReasoning(
  message: string,
  context: CoordinationContext,
  onReasoning?: (event: ReasoningEvent) => void
): AsyncGenerator<ReasoningEvent | CoordinatorDecision> {
  const startTime = Date.now();

  // Sanitize input
  const sanitizedMessage = sanitizeInput(message);

  // Helper to emit reasoning events
  function emitReasoning(
    type: ReasoningEvent["type"],
    step: string,
    content: string,
    metadata?: Record<string, any>
  ): ReasoningEvent {
    const event: ReasoningEvent = {
      type,
      step,
      content,
      timestamp: Date.now(),
      metadata,
    };

    if (onReasoning) {
      onReasoning(event);
    }

    return event;
  }

  try {
    // Step 1: Initial thinking
    yield emitReasoning(
      "thinking",
      "analyze",
      "Analyzing your query to understand what you need..."
    );

    // Step 2: Quick checks for special cases
    if (isGreeting(sanitizedMessage)) {
      yield emitReasoning(
        "observation",
        "greeting_detected",
        "Detected a friendly greeting"
      );

      const decision: CoordinatorDecision = {
        intent: "greeting",
        persona: "general",
        confidence: 1.0,
        ragNeeded: false,
        ragQueries: [],
        reasoning:
          "This is a greeting. I'll respond warmly and ask how I can help!",
        thinking: "Simple greeting detected, no need for complex routing",
      };

      yield emitReasoning(
        "decision",
        "route",
        "Routing to general advisor for greeting"
      );

      yield decision;
      return;
    }

    if (needsClarification(sanitizedMessage)) {
      yield emitReasoning(
        "observation",
        "unclear_query",
        "Your query needs more details to help effectively"
      );

      const decision: CoordinatorDecision = {
        intent: "clarification",
        persona: "general",
        confidence: 0.3,
        ragNeeded: false,
        ragQueries: [],
        reasoning:
          "I need a bit more information to help you best. Could you provide more details?",
        thinking: "Query is too vague, need clarification from user",
      };

      yield emitReasoning(
        "decision",
        "clarify",
        "Requesting more information from you"
      );

      yield decision;
      return;
    }

    // Step 3: Check conversation continuity
    yield emitReasoning(
      "action",
      "check_context",
      "Checking conversation history for context..."
    );

    const continuity = detectContinuity(sanitizedMessage, context);

    if (continuity.isContinuation) {
      yield emitReasoning(
        "observation",
        "continuation_detected",
        `This seems related to our previous conversation (${Math.round(continuity.confidence * 100)}% confident)`,
        { confidence: continuity.confidence }
      );

      // Infer persona from history
      const inferredPersona = inferPersonaFromHistory(context);
      if (inferredPersona) {
        yield emitReasoning(
          "observation",
          "inferred_persona",
          `Continuing with ${inferredPersona} context from previous discussion`
        );
      }
    }

    // Step 4: Classify intent with LLM
    yield emitReasoning(
      "action",
      "classify",
      "Analyzing query intent and topic..."
    );

    const classification = await classifyIntent(
      sanitizedMessage,
      context,
      (event) => {
        // Forward sub-reasoning events
        const subEvent = emitReasoning(
          "thinking",
          "llm_reasoning",
          event,
          { source: "llm" }
        );
        return subEvent;
      }
    );

    yield emitReasoning(
      "observation",
      "classified",
      `Identified as: ${classification.intent} (${classification.persona} advisor)`,
      {
        intent: classification.intent,
        persona: classification.persona,
        confidence: classification.confidence,
      }
    );

    // Step 5: Determine RAG need
    if (classification.ragNeeded) {
      yield emitReasoning(
        "action",
        "prepare_search",
        `Preparing to search knowledge base with ${classification.ragQueries.length} queries...`,
        { queries: classification.ragQueries }
      );

      yield emitReasoning(
        "observation",
        "rag_queries",
        `Search queries: ${classification.ragQueries.map((q) => `"${q}"`).join(", ")}`
      );
    } else {
      yield emitReasoning(
        "observation",
        "no_search_needed",
        "No knowledge base search needed - proceeding with direct response"
      );
    }

    // Step 6: Build final decision
    const decision: CoordinatorDecision = {
      intent: classification.intent,
      persona: classification.persona,
      confidence: classification.confidence,
      ragNeeded: classification.ragNeeded,
      ragQueries: classification.ragQueries,
      reasoning: classification.reasoning,
      thinking: classification.thinking,
      entities: classification.entities,
      multiPersona: classification.multiPersona,
    };

    // Step 7: Final routing decision
    yield emitReasoning(
      "decision",
      "route",
      `Routing to ${decision.persona} advisor${decision.multiPersona ? " (with multi-persona support)" : ""}`,
      {
        confidence: decision.confidence,
        latency: Date.now() - startTime,
      }
    );

    yield decision;
  } catch (error) {
    console.error("Coordinator error:", error);

    yield emitReasoning(
      "observation",
      "error",
      "Encountered an error during routing, falling back to general advisor"
    );

    // Fallback decision
    const fallbackDecision: CoordinatorDecision = {
      intent: "general",
      persona: "general",
      confidence: 0.5,
      ragNeeded: false,
      ragQueries: [],
      reasoning: "I'll help you with this as best I can!",
      thinking: "Error occurred, using fallback routing",
    };

    yield fallbackDecision;
  }
}

/**
 * Coordinate without streaming (returns final result)
 */
export async function coordinate(
  message: string,
  context: CoordinationContext
): Promise<CoordinatorResult> {
  const reasoning: ReasoningEvent[] = [];
  let decision: CoordinatorDecision | null = null;
  const startTime = Date.now();

  // Collect all reasoning events and decision
  for await (const event of coordinateWithReasoning(message, context, (e) =>
    reasoning.push(e)
  )) {
    if ("intent" in event) {
      decision = event as CoordinatorDecision;
    }
  }

  if (!decision) {
    throw new Error("Coordinator did not produce a decision");
  }

  return {
    decision,
    reasoning,
    latency: Date.now() - startTime,
  };
}

/**
 * Classify intent using LLM
 */
async function classifyIntent(
  message: string,
  context: CoordinationContext,
  onThinking?: (thought: string) => void
): Promise<ClassificationResult> {
  // Build system prompt
  const systemPrompt = buildCoordinatorPrompt(context);

  // Build messages
  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: message },
  ];

  try {
    if (onThinking) {
      onThinking("Sending query to language model for classification...");
    }

    // Call GROQ with rotation (classification models)
    const models = getModelsForTask("classification");
    const { content, model } = await callWithRotation(
      messages,
      {
        temperature: 0.3, // Lower temperature for more consistent classification
        maxTokens: 1024,
        responseFormat: { type: "json_object" },
      },
      models
    );

    if (onThinking) {
      onThinking(`Received classification from ${model}`);
    }

    // Parse JSON response
    const parsed = parseClassificationResponse(content);

    if (onThinking && parsed.thinking) {
      onThinking(`LLM reasoning: ${parsed.thinking}`);
    }

    return parsed;
  } catch (error) {
    console.error("Classification error:", error);

    // Fallback to simple keyword-based classification
    if (onThinking) {
      onThinking("LLM classification failed, using keyword fallback...");
    }

    return fallbackClassification(message);
  }
}

/**
 * Parse classification response from LLM
 */
function parseClassificationResponse(response: string): ClassificationResult {
  try {
    const parsed = JSON.parse(response);

    // If ragQueries exist and not empty, then RAG is needed
    const hasRagQueries = Array.isArray(parsed.ragQueries) && parsed.ragQueries.length > 0;
    const ragNeeded = parsed.ragNeeded === true || hasRagQueries;

    return {
      intent: parsed.intent || "general",
      persona: parsed.persona || "general",
      confidence: parsed.confidence || 0.5,
      ragNeeded,
      ragQueries: parsed.ragQueries || [],
      reasoning: parsed.reasoning || "I'll help you with this.",
      thinking: parsed.thinking,
      entities: parsed.entities || [],
      multiPersona: parsed.multiPersona || false,
    };
  } catch (error) {
    console.error("Failed to parse classification JSON:", error);
    throw new Error("Invalid classification response from LLM");
  }
}

/**
 * Fallback classification using keywords
 */
function fallbackClassification(message: string): ClassificationResult {
  const lowerMessage = message.toLowerCase();

  // Academic keywords
  const academicKeywords = [
    "course",
    "class",
    "exam",
    "midterm",
    "final",
    "study",
    "gpa",
    "grade",
    "assignment",
    "homework",
    "professor",
    "lecture",
    "calculus",
    "physics",
    "chemistry",
    "biology",
  ];

  // Career keywords
  const careerKeywords = [
    "job",
    "internship",
    "resume",
    "interview",
    "career",
    "company",
    "application",
    "networking",
    "linkedin",
    "hiring",
  ];

  // Wellness keywords
  const wellnessKeywords = [
    "stress",
    "anxiety",
    "mental health",
    "counseling",
    "wellness",
    "balance",
    "sleep",
    "tired",
    "overwhelmed",
    "depressed",
  ];

  let academicCount = 0;
  let careerCount = 0;
  let wellnessCount = 0;

  academicKeywords.forEach((kw) => {
    if (lowerMessage.includes(kw)) academicCount++;
  });
  careerKeywords.forEach((kw) => {
    if (lowerMessage.includes(kw)) careerCount++;
  });
  wellnessKeywords.forEach((kw) => {
    if (lowerMessage.includes(kw)) wellnessCount++;
  });

  // Determine persona
  let persona: PersonaType = "general";
  let intent: IntentType = "general";
  let confidence = 0.6;

  if (academicCount > careerCount && academicCount > wellnessCount) {
    persona = "academic";
    intent = "academic";
    confidence = 0.7;
  } else if (careerCount > academicCount && careerCount > wellnessCount) {
    persona = "career";
    intent = "career";
    confidence = 0.7;
  } else if (wellnessCount > academicCount && wellnessCount > careerCount) {
    persona = "wellness";
    intent = "wellness";
    confidence = 0.7;
  }

  // Check if multiple domains
  const multiPersona =
    (academicCount > 0 ? 1 : 0) +
      (careerCount > 0 ? 1 : 0) +
      (wellnessCount > 0 ? 1 : 0) >=
    2;

  if (multiPersona) {
    intent = "multi";
  }

  // Determine RAG need
  const questionWords = ["how", "what", "when", "where", "why", "explain", "tell"];
  const ragNeeded = questionWords.some((word) =>
    lowerMessage.includes(word)
  );

  return {
    intent,
    persona,
    confidence,
    ragNeeded,
    ragQueries: ragNeeded ? [message] : [],
    reasoning: `Based on keyword analysis, this seems like a ${persona} question. I'll route it to the ${persona} advisor.`,
    thinking: "Using fallback keyword-based classification",
    entities: [],
    multiPersona,
  };
}

/**
 * Validate decision confidence
 */
export function validateDecision(decision: CoordinatorDecision): boolean {
  // Check required fields
  if (!decision.intent || !decision.persona) {
    return false;
  }

  // Check confidence range
  if (decision.confidence < 0 || decision.confidence > 1) {
    return false;
  }

  // Check RAG consistency
  if (decision.ragNeeded && decision.ragQueries.length === 0) {
    return false;
  }

  return true;
}

/**
 * Get coordinator statistics
 */
export function getCoordinatorStats(results: CoordinatorResult[]): {
  totalDecisions: number;
  averageLatency: number;
  averageConfidence: number;
  personaDistribution: Record<PersonaType, number>;
  intentDistribution: Record<IntentType, number>;
  ragUsageRate: number;
} {
  if (results.length === 0) {
    return {
      totalDecisions: 0,
      averageLatency: 0,
      averageConfidence: 0,
      personaDistribution: { academic: 0, career: 0, wellness: 0, general: 0 },
      intentDistribution: {
        academic: 0,
        career: 0,
        wellness: 0,
        general: 0,
        multi: 0,
        greeting: 0,
        clarification: 0,
      },
      ragUsageRate: 0,
    };
  }

  const totalLatency = results.reduce((sum, r) => sum + r.latency, 0);
  const totalConfidence = results.reduce(
    (sum, r) => sum + r.decision.confidence,
    0
  );

  const personaDistribution: Record<PersonaType, number> = {
    academic: 0,
    career: 0,
    wellness: 0,
    general: 0,
  };

  const intentDistribution: Record<IntentType, number> = {
    academic: 0,
    career: 0,
    wellness: 0,
    general: 0,
    multi: 0,
    greeting: 0,
    clarification: 0,
  };

  let ragUsageCount = 0;

  results.forEach((result) => {
    personaDistribution[result.decision.persona]++;
    intentDistribution[result.decision.intent]++;
    if (result.decision.ragNeeded) ragUsageCount++;
  });

  return {
    totalDecisions: results.length,
    averageLatency: totalLatency / results.length,
    averageConfidence: totalConfidence / results.length,
    personaDistribution,
    intentDistribution,
    ragUsageRate: ragUsageCount / results.length,
  };
}
