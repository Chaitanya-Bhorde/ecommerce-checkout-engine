// AI Configuration - Multiple provider support
// Supports: Ollama (local), Groq (cloud-fast), OpenAI (paid)

const { ChatOllama } = require("@langchain/ollama");
const { ChatOpenAI } = require("@langchain/openai");

// Check which AI provider to use
const AI_PROVIDER = process.env.AI_PROVIDER || 'ollama'; // 'ollama', 'groq', or 'openai'

// Option 1: Local Ollama (FREE but slower - 3-5 seconds)
const ollamaLLM = new ChatOllama({
  baseUrl: "http://localhost:11434",
  model: "llama3",
  temperature: 0.7,
  maxTokens: 200,
  timeout: 5000,
});

// Option 2: Groq API (FREE, ULTRA-FAST - 1-2 seconds)
// Get FREE API key from: https://console.groq.com/keys
const groqLLM = new ChatOpenAI({
  modelName: "llama3-8b-8192",
  temperature: 0.7,
  maxTokens: 200,
  timeout: 5000,
  apiKey: process.env.GROQ_API_KEY || "your-groq-api-key-here",
});

// Option 3: OpenAI (PAID but very fast)
const openaiLLM = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0.7,
  maxTokens: 200,
  timeout: 5000,
  apiKey: process.env.OPENAI_API_KEY || "your-openai-api-key-here",
});

// Select LLM based on configuration
let llm;
switch (AI_PROVIDER) {
  case 'groq':
    llm = groqLLM;
    console.log('🤖 AI: Using Groq (FAST cloud API)');
    break;
  case 'openai':
    llm = openaiLLM;
    console.log('🤖 AI: Using OpenAI (PAID cloud API)');
    break;
  case 'ollama':
  default:
    llm = ollamaLLM;
    console.log('🤖 AI: Using Ollama (Local - slower)');
    break;
}

// LLM Configuration for different use cases
const llmConfigs = {
  support: {
    temperature: 0.7,
    maxTokens: 150,
    systemPrompt: `You are a helpful customer support assistant. Be concise and fast. Answer in under 50 words.`,
  },
  recommendations: {
    temperature: 0.5,
    maxTokens: 200,
    systemPrompt: `You are a product recommendation expert. Be specific and brief.`,
  },
  orderAutomation: {
    temperature: 0.3,
    maxTokens: 150,
    systemPrompt: `You are an order management assistant. Be precise and action-oriented.`,
  },
};

// Function to get LLM with specific config
function getLLM(configType = "support") {
  const config = llmConfigs[configType] || llmConfigs.support;
  
  // Return configured LLM based on provider
  switch (AI_PROVIDER) {
    case 'groq':
      return new ChatOpenAI({
        modelName: "llama3-8b-8192",
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        timeout: 5000,
        apiKey: process.env.GROQ_API_KEY,
      });
    case 'openai':
      return new ChatOpenAI({
        modelName: "gpt-3.5-turbo",
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        timeout: 5000,
        apiKey: process.env.OPENAI_API_KEY,
      });
    default:
      return new ChatOllama({
        baseUrl: "http://localhost:11434",
        model: "llama3",
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        timeout: 5000,
      });
  }
}

module.exports = {
  llm,
  getLLM,
  llmConfigs,
  AI_PROVIDER,
};