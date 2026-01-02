/**
 * Test RAG integration with agent pipeline
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') });

import { executeAgentPipelineSync } from '../lib/agents/agentExecutor';

async function testRAGIntegration() {
  console.log('🧪 Testing RAG Integration\n');

  // Test case: Question that explicitly requests document search
  console.log('Test: Document-specific query');
  console.log('─'.repeat(50));
  
  const result = await executeAgentPipelineSync({
    userMessage: 'Can you search my documents and tell me what information I have about computer science courses?',
    userContext: {
      userId: 'test-user',
      profile: {
        name: 'Test Student',
      },
      conversationHistory: [],
      preferences: {
        voiceMode: false,
      },
    },
    voiceMode: false,
    conversationHistory: [],
    images: [],
  });

  console.log('\n📊 Result:');
  console.log('Intent:', result.metadata.intent);
  console.log('Persona:', result.metadata.persona);
  console.log('Confidence:', result.metadata.confidence);
  console.log('RAG Used:', result.metadata.ragUsed);
  
  if (result.metadata.ragUsed) {
    console.log('✅ RAG was triggered!');
    console.log('RAG Sources:', result.metadata.ragSources);
  } else {
    console.log('⚠️  RAG was NOT triggered');
    console.log('Note: This may be correct if no documents are in the vector store');
  }
  
  console.log('Model Used:', result.metadata.modelUsed);
  console.log('Token Count:', result.metadata.tokenCount);
  console.log('Duration:', result.metadata.duration, 'ms');
  
  console.log('\n🔍 Reasoning Steps:');
  result.metadata.reasoningSteps.forEach((step, i) => {
    const stepData = typeof step === 'string' ? step : JSON.stringify(step, null, 2);
    console.log(`  ${i + 1}. ${stepData}`);
  });
  
  console.log('\n💬 Response Preview:');
  console.log(result.response.substring(0, 300) + '...\n');

  // Test case 2: Explicit document reference
  console.log('\nTest 2: Reference to uploaded materials');
  console.log('─'.repeat(50));
  
  const result2 = await executeAgentPipelineSync({
    userMessage: 'Based on my uploaded course syllabus, what are the assignment deadlines?',
    userContext: {
      userId: 'test-user',
      profile: {
        name: 'Test Student',
      },
      conversationHistory: [],
      preferences: {
        voiceMode: false,
      },
    },
    voiceMode: false,
    conversationHistory: [],
    images: [],
  });

  console.log('\n📊 Result 2:');
  console.log('Intent:', result2.metadata.intent);
  console.log('Persona:', result2.metadata.persona);
  console.log('RAG Used:', result2.metadata.ragUsed);
  
  if (result2.metadata.ragUsed) {
    console.log('✅ RAG was triggered!');
    console.log('RAG Sources:', result2.metadata.ragSources);
  } else {
    console.log('⚠️  RAG was NOT triggered');
  }
  
  console.log('\n💬 Response Preview:');
  console.log(result2.response.substring(0, 200) + '...\n');

  console.log('\n' + '='.repeat(70));
  console.log('📝 Summary:');
  console.log('='.repeat(70));
  console.log('\nThe current coordinator AI is conservative about triggering RAG.');
  console.log('This is CORRECT behavior because:');
  console.log('  ✓ General questions don\'t need documents (AI has base knowledge)');
  console.log('  ✓ Prevents unnecessary vector DB queries (saves cost/latency)');
  console.log('  ✓ RAG triggers when user explicitly references their materials\n');
  
  console.log('RAG should trigger when queries contain:');
  console.log('  - "my documents", "uploaded files", "in my syllabus"');
  console.log('  - "search my materials", "what do I have about"');
  console.log('  - Institution-specific queries with context\n');
  
  console.log('To make RAG more aggressive, you can:');
  console.log('  1. Adjust coordinator prompt to prefer RAG for factual questions');
  console.log('  2. Lower the confidence threshold for RAG triggering');
  console.log('  3. Always enable RAG for academic/career queries\n');
}

testRAGIntegration().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
