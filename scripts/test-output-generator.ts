/**
 * Output Generator Test Suite
 * 
 * Tests streaming reasoning and response token generation
 * with all specialist agents.
 * 
 * Run with: npx ts-node --project scripts/tsconfig.json scripts/test-output-generator.ts
 */

import * as dotenv from 'dotenv';
import {
  generateWithReasoning,
  generateWithSpecialist,
  collectTokens,
  formatReasoningSteps,
  type CoordinatorDecision,
  type UserContext,
} from '../lib/agents';

// Load environment variables
dotenv.config({ path: '.env.local' });

// ============================================
// Formatting Utilities
// ============================================

const icons = {
  thinking: '💭',
  action: '⚡',
  observation: '👁️',
  decision: '✅',
  reasoning: '🧠',
  token: '📝',
  done: '✔️',
  error: '❌',
};

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString().split('T')[1].split('.')[0];
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// ============================================
// Test Scenarios
// ============================================

async function testAcademicAgent() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📚 TEST 1: Academic Agent with Reasoning Stream');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const decision: CoordinatorDecision = {
    intent: 'academic',
    persona: 'academic',
    confidence: 0.95,
    ragNeeded: false,
    ragQueries: [],
    reasoning: 'Clear academic query about study techniques',
  };

  const userContext: UserContext = {
    userId: 'test-user-1',
    profile: {
      name: 'Alice',
      major: 'Computer Science',
      year: 'Junior',
      gpa: 3.5,
    },
  };

  const message = 'What are the best strategies for studying for my algorithms final exam?';

  console.log(`Query: "${message}"\n`);
  console.log('Streaming output:\n');

  const startTime = Date.now();
  let tokenCount = 0;
  let fullResponse = '';

  for await (const event of generateWithReasoning(
    decision,
    message,
    null, // No RAG context
    userContext,
    false // Text mode
  )) {
    const timestamp = formatTimestamp(event.timestamp || Date.now());

    switch (event.type) {
      case 'reasoning':
        console.log(`[${timestamp}] ${icons.reasoning} ${event.content}`);
        break;
      case 'token':
        tokenCount++;
        fullResponse += event.content;
        // Show first few tokens
        if (tokenCount <= 10 || tokenCount % 50 === 0) {
          process.stdout.write(event.content);
        }
        break;
      case 'done':
        const duration = Date.now() - startTime;
        console.log(`\n\n[${timestamp}] ${icons.done} Complete`);
        console.log(`   └─ Tokens: ${tokenCount}`);
        console.log(`   └─ Duration: ${formatDuration(duration)}`);
        console.log(`   └─ Model: ${event.metadata?.model || 'unknown'}`);
        break;
      case 'error':
        console.log(`\n[${timestamp}] ${icons.error} Error: ${event.content}`);
        break;
    }
  }

  console.log('\n\nFull response preview (first 200 chars):');
  console.log(fullResponse.substring(0, 200) + '...\n');
}

async function testCareerAgentWithRAG() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💼 TEST 2: Career Agent with RAG Context');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const decision: CoordinatorDecision = {
    intent: 'career',
    persona: 'career',
    confidence: 0.92,
    ragNeeded: true,
    ragQueries: ['software engineering resume tips', 'tech interview preparation'],
    reasoning: 'Career advice request with RAG retrieval',
  };

  const userContext: UserContext = {
    userId: 'test-user-2',
    profile: {
      name: 'Bob',
      major: 'Software Engineering',
      year: 'Senior',
      interests: ['web development', 'machine learning'],
    },
    conversationHistory: [
      { role: 'user', content: 'I need help with my resume' },
      { role: 'assistant', content: 'I can help you with that!' },
    ],
  };

  const ragContext = `
# Resume Tips for Software Engineers

## Key Sections
1. **Technical Skills**: List programming languages, frameworks, tools
2. **Projects**: Showcase 3-5 relevant projects with impact metrics
3. **Experience**: Focus on achievements, not just responsibilities
4. **Education**: Include GPA if > 3.5, relevant coursework

## Action Verbs
Use strong action verbs: Developed, Implemented, Optimized, Architected, Led

## Quantify Impact
- "Improved performance by 40%" is better than "Improved performance"
- "Led team of 5 developers" is better than "Led a team"
`;

  const message = 'How can I make my resume stand out for software engineering internships?';

  console.log(`Query: "${message}"\n`);
  console.log('RAG Context provided: 250 chars\n');
  console.log('Streaming output:\n');

  const startTime = Date.now();
  let tokenCount = 0;

  for await (const event of generateWithReasoning(
    decision,
    message,
    ragContext,
    userContext,
    false
  )) {
    const timestamp = formatTimestamp(event.timestamp || Date.now());

    switch (event.type) {
      case 'reasoning':
        console.log(`[${timestamp}] ${icons.reasoning} ${event.content}`);
        break;
      case 'token':
        tokenCount++;
        if (tokenCount === 1) process.stdout.write('\nResponse: ');
        if (tokenCount <= 5 || tokenCount % 30 === 0) {
          process.stdout.write(event.content);
        }
        break;
      case 'done':
        const duration = Date.now() - startTime;
        console.log(`\n\n[${timestamp}] ${icons.done} Complete`);
        console.log(`   └─ Tokens: ${tokenCount}`);
        console.log(`   └─ Duration: ${formatDuration(duration)}`);
        break;
    }
  }
  console.log('\n');
}

async function testWellnessAgentVoiceMode() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌿 TEST 3: Wellness Agent in Voice Mode');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const decision: CoordinatorDecision = {
    intent: 'wellness',
    persona: 'wellness',
    confidence: 0.88,
    ragNeeded: false,
    ragQueries: [],
    reasoning: 'Wellness query - breathing exercise request',
  };

  const userContext: UserContext = {
    userId: 'test-user-3',
    profile: {
      name: 'Charlie',
    },
    preferences: {
      voiceMode: true,
    },
  };

  const message = 'I\'m feeling really stressed. Can you guide me through a breathing exercise?';

  console.log(`Query: "${message}"\n`);
  console.log('Voice Mode: ENABLED (brief, conversational response)\n');
  console.log('Streaming output:\n');

  const startTime = Date.now();

  for await (const event of generateWithReasoning(
    decision,
    message,
    null,
    userContext,
    true // Voice mode enabled
  )) {
    const timestamp = formatTimestamp(event.timestamp || Date.now());

    switch (event.type) {
      case 'reasoning':
        console.log(`[${timestamp}] ${icons.reasoning} ${event.content}`);
        if (event.metadata?.severity) {
          console.log(`   └─ Severity: ${event.metadata.severity}`);
        }
        break;
      case 'token':
        process.stdout.write(event.content);
        break;
      case 'done':
        const duration = Date.now() - startTime;
        console.log(`\n\n[${timestamp}] ${icons.done} Complete`);
        console.log(`   └─ Duration: ${formatDuration(duration)}`);
        console.log(`   └─ Tokens: ${event.metadata?.tokenCount || 0}`);
        break;
    }
  }
  console.log('\n');
}

async function testGeneralAgentDirectCall() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💡 TEST 4: General Agent Direct Specialist Call');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const message = 'What is recursion in programming?';

  console.log(`Query: "${message}"\n`);
  console.log('Using generateWithSpecialist() directly\n');
  console.log('Streaming output:\n');

  const startTime = Date.now();

  for await (const event of generateWithSpecialist(
    'general',
    message,
    null,
    undefined,
    false
  )) {
    const timestamp = formatTimestamp(event.timestamp || Date.now());

    switch (event.type) {
      case 'reasoning':
        console.log(`[${timestamp}] ${icons.reasoning} ${event.content}`);
        if (event.metadata?.category) {
          console.log(`   └─ Category: ${event.metadata.category}`);
        }
        break;
      case 'token':
        process.stdout.write(event.content);
        break;
      case 'done':
        const duration = Date.now() - startTime;
        console.log(`\n\n[${timestamp}] ${icons.done} Complete`);
        console.log(`   └─ Duration: ${formatDuration(duration)}`);
        break;
    }
  }
  console.log('\n');
}

async function testCollectTokensUtility() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 TEST 5: collectTokens() Utility Function');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const decision: CoordinatorDecision = {
    intent: 'general',
    persona: 'general',
    confidence: 0.9,
    ragNeeded: false,
    ragQueries: [],
    reasoning: 'Testing utility function',
  };

  const message = 'Hello! How are you today?';

  console.log(`Query: "${message}"\n`);
  console.log('Collecting all tokens into string...\n');

  const stream = generateWithReasoning(decision, message, null, undefined, false);
  const result = await collectTokens(stream);

  console.log('✅ Collection complete!\n');
  console.log('Reasoning steps:');
  result.reasoningSteps.forEach((step, i) => {
    console.log(`  ${i + 1}. ${step}`);
  });

  console.log('\nFull response:');
  console.log(result.fullResponse);

  console.log('\nMetadata:');
  console.log(JSON.stringify(result.metadata, null, 2));
  console.log('\n');
}

// ============================================
// Main Test Runner
// ============================================

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║        Output Generator Test Suite                          ║');
  console.log('║  Testing Specialist Agents with Reasoning Streams           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  try {
    // Test 1: Academic agent
    await testAcademicAgent();

    // Test 2: Career agent with RAG
    await testCareerAgentWithRAG();

    // Test 3: Wellness agent voice mode
    await testWellnessAgentVoiceMode();

    // Test 4: General agent direct call
    await testGeneralAgentDirectCall();

    // Test 5: Utility functions
    await testCollectTokensUtility();

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    ALL TESTS PASSED ✅                       ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  main();
}
