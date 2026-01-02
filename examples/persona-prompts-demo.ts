/**
 * Example: Using Refactored Persona Prompts
 * Demonstrates text/voice modes and context injection
 */

import {
  PERSONA_PROMPTS,
  composePrompt,
  PersonaType,
  ResponseMode,
} from "../lib/ai/promptTemplates";

/**
 * Example 1: Get persona information
 */
function explorePersonas() {
  console.log("=".repeat(80));
  console.log("Available Personas:");
  console.log("=".repeat(80));

  Object.values(PERSONA_PROMPTS).forEach((persona) => {
    console.log(`\n📌 ${persona.displayName} (${persona.id})`);
    console.log(`   Description: ${persona.description}`);
    console.log(`   Capabilities: ${persona.capabilities.join(", ")}`);
  });
}

/**
 * Example 2: Compose prompts for different modes
 */
function demonstrateTextVsVoice() {
  console.log("\n\n" + "=".repeat(80));
  console.log("Text Mode vs Voice Mode:");
  console.log("=".repeat(80));

  const persona: PersonaType = "academic";

  // Text mode - comprehensive
  const textPrompt = composePrompt(persona, "text");
  console.log("\n📝 TEXT MODE (first 300 chars):");
  console.log(textPrompt.substring(0, 300) + "...\n");

  // Voice mode - concise
  const voicePrompt = composePrompt(persona, "voice");
  console.log("🎙️  VOICE MODE (first 300 chars):");
  console.log(voicePrompt.substring(0, 300) + "...\n");
}

/**
 * Example 3: Context injection
 */
function demonstrateContextInjection() {
  console.log("\n\n" + "=".repeat(80));
  console.log("Context Injection:");
  console.log("=".repeat(80));

  const userContext = `Student: John Doe
Major: Computer Science
Year: Junior (3rd year)
GPA: 3.4
Current Courses: Data Structures, Algorithms, Web Development`;

  const ragContext = `From your uploaded syllabus:
- Midterm exam covers chapters 1-5
- Focus on binary trees, graph algorithms, and dynamic programming
- Exam format: 40% multiple choice, 60% coding problems`;

  const fullPrompt = composePrompt(
    "academic",
    "text",
    userContext,
    ragContext
  );

  console.log("\n✅ Composed Prompt with Context:");
  console.log("-".repeat(80));

  // Show the sections
  const lines = fullPrompt.split("\n");
  let inUserContext = false;
  let inRagContext = false;

  lines.forEach((line) => {
    if (line.includes("USER CONTEXT:")) {
      console.log("\n🔹 USER CONTEXT SECTION:");
      inUserContext = true;
      inRagContext = false;
    } else if (line.includes("RELEVANT INFORMATION")) {
      console.log("\n🔹 RAG CONTEXT SECTION:");
      inUserContext = false;
      inRagContext = true;
    } else if (line.includes("RESPONSE GUIDELINES")) {
      inUserContext = false;
      inRagContext = false;
    }

    if (inUserContext || inRagContext) {
      console.log(line);
    }
  });
}

/**
 * Example 4: Compare all personas in voice mode
 */
function compareVoicePrompts() {
  console.log("\n\n" + "=".repeat(80));
  console.log("Voice Prompts Comparison:");
  console.log("=".repeat(80));

  const personas: PersonaType[] = ["academic", "career", "wellness", "general"];

  personas.forEach((persona) => {
    const voicePrompt = composePrompt(persona, "voice");
    console.log(`\n🎙️  ${PERSONA_PROMPTS[persona].displayName.toUpperCase()}`);
    console.log("-".repeat(80));

    // Extract just the main instructions (before example)
    const mainPart = voicePrompt.split("Example:")[0];
    console.log(mainPart.trim());
  });
}

/**
 * Example 5: Usage in chat application
 */
function usageExample() {
  console.log("\n\n" + "=".repeat(80));
  console.log("Usage Example in Chat Application:");
  console.log("=".repeat(80));

  console.log(`
/**
 * In your chat service:
 */
import { composePrompt, PERSONA_PROMPTS } from '@/lib/ai/promptTemplates';

async function generateResponse(
  userMessage: string,
  persona: PersonaType,
  isVoiceMode: boolean,
  user?: User,
  ragResults?: RagSearchResult
) {
  // 1. Build user context
  const userContext = user 
    ? \`Student: \${user.name}
       Major: \${user.major || 'Undeclared'}
       Year: \${user.year || 'N/A'}
       GPA: \${user.gpa || 'N/A'}\`
    : undefined;

  // 2. Build RAG context
  const ragContext = ragResults?.chunks
    ? \`From your documents:\\n\${ragResults.chunks
        .map(c => \`- \${c.text.substring(0, 200)}...\`)
        .join('\\n')}\`
    : undefined;

  // 3. Compose prompt
  const systemPrompt = composePrompt(
    persona,
    isVoiceMode ? 'voice' : 'text',
    userContext,
    ragContext
  );

  // 4. Call LLM
  const response = await callLLM({
    systemPrompt,
    userMessage,
    temperature: isVoiceMode ? 0.7 : 0.8,
    maxTokens: isVoiceMode ? 150 : 2000, // Shorter for voice
  });

  return response;
}

/**
 * Getting persona info:
 */
const academicInfo = PERSONA_PROMPTS.academic;
console.log(academicInfo.displayName);  // "Academic Advisor"
console.log(academicInfo.capabilities); // ['study-strategies', ...]

/**
 * Checking capabilities:
 */
function canHandleQuery(query: string, persona: PersonaType): boolean {
  const capabilities = PERSONA_PROMPTS[persona].capabilities;
  
  // Simple keyword matching
  const queryLower = query.toLowerCase();
  return capabilities.some(cap => 
    queryLower.includes(cap.replace('-', ' '))
  );
}
  `);
}

/**
 * Run all examples
 */
function runExamples() {
  console.log("\n");
  console.log("╔" + "═".repeat(78) + "╗");
  console.log("║" + " ".repeat(18) + "PERSONA PROMPTS SYSTEM DEMO" + " ".repeat(33) + "║");
  console.log("╚" + "═".repeat(78) + "╝");

  explorePersonas();
  demonstrateTextVsVoice();
  demonstrateContextInjection();
  compareVoicePrompts();
  usageExample();

  console.log("\n\n" + "=".repeat(80));
  console.log("✅ Demo Complete!");
  console.log("=".repeat(80));
  console.log("\nKey Features:");
  console.log("  ✅ Professional AI identity (transparent about being AI)");
  console.log("  ✅ Text mode: Comprehensive with Markdown formatting");
  console.log("  ✅ Voice mode: 2-4 sentences, conversational");
  console.log("  ✅ Context placeholders: {{USER_CONTEXT}} and {{RAG_CONTEXT}}");
  console.log("  ✅ Capability tracking for each persona");
  console.log("  ✅ Legacy support for existing code");
  console.log("\n");
}

// Run if executed directly
if (require.main === module) {
  runExamples();
}

export { runExamples };
