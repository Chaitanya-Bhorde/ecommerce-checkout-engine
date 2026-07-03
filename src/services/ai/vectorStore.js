// Vector Store Service - Handles RAG (Retrieval-Augmented Generation)
// Uses MongoDB Atlas Vector Search for intelligent information retrieval

const { MongoClient } = require('mongodb');

// MongoDB connection for vector search
let client = null;
let db = null;

/**
 * Initialize MongoDB connection for vector store
 */
async function initVectorStore() {
  try {
    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
      console.warn('MONGODB_URI not found in environment variables');
      return false;
    }

    client = new MongoClient(uri);
    await client.connect();
    
    // Extract database name from URI or use default
    const dbName = uri.split('/').pop().split('?')[0] || 'ecommerce';
    db = client.db(dbName);
    
    console.log('✅ Vector Store initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Vector Store:', error);
    return false;
  }
}

/**
 * Create vector embeddings for text
 * Simple embedding function (in production, use proper embedding model)
 * @param {string} text - Text to embed
 * @returns {Array} Embedding vector
 */
function createEmbedding(text) {
  // Simple hash-based embedding for demo
  // In production, use: OpenAI embeddings, Cohere, or HuggingFace models
  const words = text.toLowerCase().split(/\s+/);
  const embedding = new Array(384).fill(0); // 384-dimensional vector
  
  words.forEach((word, index) => {
    const hash = hashString(word);
    const position = Math.abs(hash) % 384;
    embedding[position] += 1;
  });
  
  // Normalize the vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

/**
 * Simple string hash function
 * @param {string} str - String to hash
 * @returns {number} Hash value
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

/**
 * Add document to vector store
 * @param {string} id - Document ID
 * @param {string} content - Document content
 * @param {object} metadata - Additional metadata
 */
async function addDocument(id, content, metadata = {}) {
  try {
    if (!db) {
      console.warn('Vector store not initialized');
      return false;
    }

    const embedding = createEmbedding(content);
    
    const document = {
      _id: id,
      content: content,
      embedding: embedding,
      metadata: metadata,
      createdAt: new Date(),
    };

    await db.collection('vector_store').insertOne(document);
    return true;
  } catch (error) {
    console.error('Error adding document to vector store:', error);
    return false;
  }
}

/**
 * Search vector store for similar documents
 * @param {string} query - Search query
 * @param {number} topK - Number of results to return
 * @returns {Array} Array of similar documents
 */
async function search(query, topK = 3) {
  try {
    if (!db) {
      console.warn('Vector store not initialized');
      return [];
    }

    const queryEmbedding = createEmbedding(query);
    
    // Use MongoDB Atlas Vector Search aggregation
    const results = await db.collection('vector_store').aggregate([
      {
        $vectorSearch: {
          index: 'vector_index', // Vector search index name
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: topK * 10,
          limit: topK,
        },
      },
      {
        $project: {
          content: 1,
          metadata: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ]).toArray();

    return results.map(result => ({
      pageContent: result.content,
      metadata: result.metadata,
      score: result.score,
    }));
  } catch (error) {
    console.error('Error searching vector store:', error);
    // Fallback: return empty array if vector search not available
    return [];
  }
}

/**
 * Bulk add documents to vector store
 * @param {Array} documents - Array of {id, content, metadata}
 */
async function bulkAddDocuments(documents) {
  try {
    if (!db) {
      console.warn('Vector store not initialized');
      return false;
    }

    const docs = documents.map(doc => ({
      _id: doc.id,
      content: doc.content,
      embedding: createEmbedding(doc.content),
      metadata: doc.metadata || {},
      createdAt: new Date(),
    }));

    await db.collection('vector_store').insertMany(docs, { ordered: false });
    return true;
  } catch (error) {
    console.error('Error bulk adding documents:', error);
    return false;
  }
}

/**
 * Delete document from vector store
 * @param {string} id - Document ID
 */
async function deleteDocument(id) {
  try {
    if (!db) {
      console.warn('Vector store not initialized');
      return false;
    }

    await db.collection('vector_store').deleteOne({ _id: id });
    return true;
  } catch (error) {
    console.error('Error deleting document:', error);
    return false;
  }
}

/**
 * Clear all documents from vector store
 */
async function clearAll() {
  try {
    if (!db) {
      console.warn('Vector store not initialized');
      return false;
    }

    await db.collection('vector_store').deleteMany({});
    return true;
  } catch (error) {
    console.error('Error clearing vector store:', error);
    return false;
  }
}

/**
 * Get vector store statistics
 */
async function getStats() {
  try {
    if (!db) {
      return { total: 0 };
    }

    const count = await db.collection('vector_store').countDocuments();
    return { total: count };
  } catch (error) {
    console.error('Error getting stats:', error);
    return { total: 0 };
  }
}

/**
 * Create vector search index (run once during setup)
 * This creates the index needed for vector search
 */
async function createVectorIndex() {
  try {
    if (!db) {
      console.warn('Vector store not initialized');
      return false;
    }

    await db.collection('vector_store').createIndex(
      { embedding: 'vector' },
      {
        name: 'vector_index',
        dimensions: 384, // Match embedding dimension
        metric: 'cosine', // Similarity metric
      }
    );

    console.log('✅ Vector search index created');
    return true;
  } catch (error) {
    console.error('Error creating vector index:', error);
    return false;
  }
}

// Export vector store instance
const vectorStore = {
  init: initVectorStore,
  addDocument,
  bulkAddDocuments,
  search,
  deleteDocument,
  clearAll,
  getStats,
  createVectorIndex,
};

module.exports = {
  initVectorStore,
  addDocument,
  bulkAddDocuments,
  search,
  deleteDocument,
  clearAll,
  getStats,
  createVectorIndex,
  vectorStore,
};

module.exports = vectorStore;
