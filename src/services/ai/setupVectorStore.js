// Setup script to populate vector store with knowledge base documents
// Run this once to initialize the vector store with FAQ data

require('dotenv').config();

const { initVectorStore, bulkAddDocuments, createVectorIndex, clearAll } = require('./vectorStore');
const { getAllDocuments } = require('./knowledgeBase');

async function setup() {
  console.log('🚀 Setting up Vector Store...\n');

  // Step 1: Initialize vector store
  console.log('1️⃣ Initializing vector store...');
  const initialized = await initVectorStore();
  if (!initialized) {
    console.error('❌ Failed to initialize vector store. Check MONGODB_URI in .env');
    process.exit(1);
  }
  console.log('✅ Vector store initialized\n');

  // Step 2: Clear existing data (optional - comment out if you want to keep existing data)
  console.log('2️⃣ Clearing existing vector store data...');
  await clearAll();
  console.log('✅ Cleared\n');

  // Step 3: Get all knowledge base documents
  console.log('3️⃣ Loading knowledge base documents...');
  const documents = getAllDocuments();
  console.log(`✅ Loaded ${documents.length} documents\n`);

  // Step 4: Add documents to vector store
  console.log('4️⃣ Adding documents to vector store (this may take a minute)...');
  const docsToAdd = documents.map(doc => ({
    id: doc.id,
    content: doc.content,
    metadata: doc.metadata,
  }));

  const added = await bulkAddDocuments(docsToAdd);
  if (!added) {
    console.error('❌ Failed to add documents');
    process.exit(1);
  }
  console.log(`✅ Added ${docsToAdd.length} documents to vector store\n`);

  // Step 5: Create vector search index
  console.log('5️⃣ Creating vector search index...');
  const indexCreated = await createVectorIndex();
  if (!indexCreated) {
    console.warn('⚠️  Index may already exist or failed to create');
  } else {
    console.log('✅ Vector search index created\n');
  }

  // Step 6: Verify
  console.log('6️⃣ Verifying setup...');
  const stats = await require('./vectorStore').getStats();
  console.log(`✅ Vector store now contains ${stats.total} documents\n`);

  console.log('🎉 Vector store setup complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Make sure you have a GROQ_API_KEY in your .env file');
  console.log('2. Start your server: npm start');
  console.log('3. Test the chatbot with queries like:');
  console.log('   - "What is your return policy?"');
  console.log('   - "How do I track my order?"');
  console.log('   - "What payment methods do you accept?"');
  console.log('\n💡 Check the console logs to see RAG retrieval in action!');
}

setup().catch(error => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});

module.exports = { setup };