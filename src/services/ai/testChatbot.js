// Test script to verify chatbot functionality
// Run with: node src/services/ai/testChatbot.js

const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
// Register Category model for standalone test (needed by getProductRecommendations populate)
require('../../models/Category');
const { chat, clearChatHistory } = require('./chatbot');

// Test user ID - use a valid MongoDB ObjectId format for proper DB queries
const TEST_USER_ID = '000000000000000000000001';

// Sample queries to test
const testQueries = [
  'How many total orders do we have?',
  'What is your return policy?',
  'How do I track my order?',
  'What payment methods do you accept?',
  'Tell me about your products',
];

async function runTests() {
  console.log('🧪 Starting Chatbot Tests\n');
  console.log('=' .repeat(60));
  
  // Connect to MongoDB if MONGODB_URI is set
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri);
      console.log('✅ MongoDB connected for test');
    } catch (dbErr) {
      console.log('⚠️ MongoDB not available, DB queries will return empty: ' + dbErr.message);
    }
  } else {
    console.log('⚠️ No MONGODB_URI found, DB queries will return empty');
  }

  // Clear any existing chat history
  clearChatHistory(TEST_USER_ID);

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n📝 Test ${i + 1}/${testQueries.length}: "${query}"`);
    console.log('-'.repeat(60));

    try {
      const startTime = Date.now();
      const response = await chat(TEST_USER_ID, query);
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`✅ Response (${duration}ms):`);
      console.log(`   ${response}`);
    } catch (error) {
      console.error(`❌ Error:`, error.message);
    }

    // Small delay between queries
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 All tests completed!');
  console.log('\n💡 Check the console output above to verify:');
  console.log('   1. RAG retrieval logs show relevant documents');
  console.log('   2. Responses use correct database statistics');
  console.log('   3. Response times are fast (< 5 seconds)');
  console.log('   4. Answers are accurate and helpful');
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});