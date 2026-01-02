/**
 * Test Coordinator Agent with Reasoning Stream
 * Demonstrates real-time reasoning events
 */

import dotenv from "dotenv";
import { coordinateWithReasoning, coordinate } from "../lib/agents/coordinator";
import { CoordinationContext, ReasoningEvent } from "../lib/agents/types";

// Load environment variables
dotenv.config({ path: ".env.local" });

/**
 * Format reasoning event for console output
 */
function formatReasoningEvent(event: ReasoningEvent): string {
  const icons = {
    thinking: "💭",
    action: "⚡",
    observation: "👁️",
    decision: "✅",
  };

  const icon = icons[event.type] || "📌";
  return `${icon} [${event.type.toUpperCase()}] ${event.step}: ${event.content}`;
}

/**
 * Test streaming coordination
 */
async function testStreamingCoordination() {
  console.log("=".repeat(80));
  console.log("🧪 Test 1: Streaming Coordination with Reasoning");
  console.log("=".repeat(80));

  const query = "I'm struggling with calculus and feeling really stressed about my midterm";

  console.log(`\n📝 Query: "${query}"\n`);

  const context: CoordinationContext = {
    userId: "test-user-123",
    conversationId: "test-conv-456",
    userProfile: {
      major: "Computer Science",
      year: "Sophomore",
      gpa: 3.2,
    },
  };

  console.log("🔄 Streaming reasoning events:\n");

  let decision;

  for await (const event of coordinateWithReasoning(query, context)) {
    if ("intent" in event) {
      // This is the final decision
      decision = event;
      console.log("\n" + "=".repeat(80));
      console.log("🎯 Final Decision:");
      console.log("=".repeat(80));
      console.log(JSON.stringify(decision, null, 2));
    } else {
      // This is a reasoning event
      console.log(formatReasoningEvent(event as ReasoningEvent));
    }
  }

  console.log("\n✅ Test 1 Complete\n");
}

/**
 * Test non-streaming coordination
 */
async function testNonStreamingCoordination() {
  console.log("=".repeat(80));
  console.log("🧪 Test 2: Non-Streaming Coordination");
  console.log("=".repeat(80));

  const query = "How do I find tech internships?";

  console.log(`\n📝 Query: "${query}"\n`);

  const context: CoordinationContext = {
    userId: "test-user-789",
    conversationHistory: [
      {
        role: "user",
        content: "I want to work at a tech company",
      },
      {
        role: "assistant",
        content: "That's great! What specifically interests you about tech?",
      },
    ],
  };

  console.log("⏳ Processing (non-streaming)...\n");

  const startTime = Date.now();
  const result = await coordinate(query, context);
  const latency = Date.now() - startTime;

  console.log("📊 Results:");
  console.log(`   Latency: ${latency}ms`);
  console.log(`   Reasoning steps: ${result.reasoning.length}`);
  console.log(`   Model: ${result.model || "N/A"}`);
  console.log("\n🎯 Decision:");
  console.log(JSON.stringify(result.decision, null, 2));

  console.log("\n📜 Reasoning trace:");
  result.reasoning.forEach((event, index) => {
    console.log(`   ${index + 1}. ${formatReasoningEvent(event)}`);
  });

  console.log("\n✅ Test 2 Complete\n");
}

/**
 * Test multiple queries
 */
async function testMultipleQueries() {
  console.log("=".repeat(80));
  console.log("🧪 Test 3: Multiple Query Types");
  console.log("=".repeat(80));

  const queries = [
    "Hi there!",
    "What's my GPA?",
    "help",
    "I need to improve my study habits for chemistry",
    "Also, how do I manage stress better?",
  ];

  const context: CoordinationContext = {
    userId: "test-user-multi",
  };

  for (const query of queries) {
    console.log(`\n📝 Query: "${query}"`);
    console.log("-".repeat(40));

    let decision;

    for await (const event of coordinateWithReasoning(query, context)) {
      if ("intent" in event) {
        decision = event;
      }
    }

    if (decision) {
      console.log(`   Intent: ${decision.intent}`);
      console.log(`   Persona: ${decision.persona}`);
      console.log(`   Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
      console.log(`   RAG Needed: ${decision.ragNeeded}`);
      if (decision.ragQueries.length > 0) {
        console.log(`   RAG Queries: ${decision.ragQueries.join(", ")}`);
      }

      // Update context with decision
      if (!context.previousDecisions) {
        context.previousDecisions = [];
      }
      context.previousDecisions.push(decision);
    }
  }

  console.log("\n✅ Test 3 Complete\n");
}

/**
 * Test with conversation history
 */
async function testWithHistory() {
  console.log("=".repeat(80));
  console.log("🧪 Test 4: Conversation Continuity");
  console.log("=".repeat(80));

  const context: CoordinationContext = {
    userId: "test-user-history",
    conversationHistory: [
      {
        role: "user",
        content: "I'm taking Calculus II this semester",
      },
      {
        role: "assistant",
        content: "That's great! Calculus II covers integration and series. How can I help?",
      },
      {
        role: "user",
        content: "I'm struggling with integration by parts",
      },
      {
        role: "assistant",
        content: "Integration by parts can be tricky. Let me help you understand the LIATE rule...",
      },
    ],
  };

  const followUpQuery = "What about u-substitution?";

  console.log("📚 Conversation history:");
  context.conversationHistory?.forEach((msg, i) => {
    console.log(`   ${msg.role}: ${msg.content.substring(0, 60)}...`);
  });

  console.log(`\n📝 Follow-up query: "${followUpQuery}"\n`);

  for await (const event of coordinateWithReasoning(followUpQuery, context)) {
    if ("intent" in event) {
      console.log("\n🎯 Decision:");
      console.log(JSON.stringify(event, null, 2));
    } else {
      console.log(formatReasoningEvent(event as ReasoningEvent));
    }
  }

  console.log("\n✅ Test 4 Complete\n");
}

/**
 * Run all tests
 */
async function runTests() {
  console.log("\n");
  console.log("╔" + "═".repeat(78) + "╗");
  console.log("║" + " ".repeat(20) + "COORDINATOR AGENT TEST SUITE" + " ".repeat(30) + "║");
  console.log("╚" + "═".repeat(78) + "╝");
  console.log("\n");

  try {
    await testStreamingCoordination();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await testNonStreamingCoordination();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await testMultipleQueries();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await testWithHistory();

    console.log("\n");
    console.log("╔" + "═".repeat(78) + "╗");
    console.log("║" + " ".repeat(26) + "ALL TESTS PASSED ✅" + " ".repeat(33) + "║");
    console.log("╚" + "═".repeat(78) + "╝");
    console.log("\n");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

// Run tests
runTests();
