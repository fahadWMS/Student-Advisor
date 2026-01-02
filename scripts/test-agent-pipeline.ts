/**
 * Test script for agent pipeline with reasoning stream
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') });

import { executeAgentPipelineSync } from '../lib/agents/agentExecutor';

async function testAgentPipeline() {
  console.log('🧪 Testing Agent Pipeline\n');

  // Test case 1: Simple academic question (no RAG)
  console.log('Test 1: Simple academic question');
  console.log('─'.repeat(50));
  
  const result1 = await executeAgentPipelineSync({
    userMessage: 'What are the benefits of active learning?',
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

  console.log('\n📊 Result 1:');
  console.log('Intent:', result1.metadata.intent);
  console.log('Persona:', result1.metadata.persona);
  console.log('Confidence:', result1.metadata.confidence);
  console.log('RAG Used:', result1.metadata.ragUsed);
  console.log('Model Used:', result1.metadata.modelUsed);
  console.log('Token Count:', result1.metadata.tokenCount);
  console.log('Duration:', result1.metadata.duration, 'ms');
  console.log('\n🔍 Reasoning Steps:');
  result1.metadata.reasoningSteps.forEach((step, i) => {
    console.log(`  ${i + 1}. ${typeof step === 'string' ? step : JSON.stringify(step, null, 2)}`);
  });
  console.log('\n💬 Response Preview:');
  console.log(result1.response.substring(0, 200) + '...\n');

  // Test case 2: Question requiring RAG
  console.log('\nTest 2: Question requiring document search');
  console.log('─'.repeat(50));
  
  const result2 = await executeAgentPipelineSync({
    userMessage: 'What are the course prerequisites for Computer Science?',
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
  console.log('Confidence:', result2.metadata.confidence);
  console.log('RAG Used:', result2.metadata.ragUsed);
  if (result2.metadata.ragSources.length > 0) {
    console.log('RAG Sources:', result2.metadata.ragSources);
  }
  console.log('Model Used:', result2.metadata.modelUsed);
  console.log('Token Count:', result2.metadata.tokenCount);
  console.log('Duration:', result2.metadata.duration, 'ms');
  console.log('\n🔍 Reasoning Steps:');
  result2.metadata.reasoningSteps.forEach((step, i) => {
    console.log(`  ${i + 1}. ${typeof step === 'string' ? step : JSON.stringify(step, null, 2)}`);
  });
  console.log('\n💬 Response Preview:');
  console.log(result2.response.substring(0, 200) + '...\n');

  // Test case 3: Career guidance
  console.log('\nTest 3: Career guidance question');
  console.log('─'.repeat(50));
  
  const result3 = await executeAgentPipelineSync({
    userMessage: 'How can I prepare for a software engineering internship?',
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

  console.log('\n📊 Result 3:');
  console.log('Intent:', result3.metadata.intent);
  console.log('Persona:', result3.metadata.persona);
  console.log('Confidence:', result3.metadata.confidence);
  console.log('RAG Used:', result3.metadata.ragUsed);
  console.log('Model Used:', result3.metadata.modelUsed);
  console.log('Token Count:', result3.metadata.tokenCount);
  console.log('Duration:', result3.metadata.duration, 'ms');
  console.log('\n🔍 Reasoning Steps:');
  result3.metadata.reasoningSteps.forEach((step, i) => {
    console.log(`  ${i + 1}. ${typeof step === 'string' ? step : JSON.stringify(step, null, 2)}`);
  });
  console.log('\n💬 Response Preview:');
  console.log(result3.response.substring(0, 200) + '...\n');

  console.log('\n✅ All tests completed successfully!');
}

testAgentPipeline().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
