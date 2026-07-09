// AI Configuration - Multiple provider support
// Uses DIRECT fetch() for maximum reliability (no SDK dependency issues)

const { ChatOllama } = require("@langchain/ollama");

// Check which AI provider to use
const AI_PROVIDER = process.env.AI_PROVIDER || 'ollama';

console.log(`🤖 AI: Using ${AI_PROVIDER} (${AI_PROVIDER === 'groq' ? 'FAST cloud API' : AI_PROVIDER === 'openai' ? 'PAID cloud API' : 'Local - slower'})`);
console.log(`[llmConfig] AI_PROVIDER env var: "${process.env.AI_PROVIDER}"`);
console.log(`[llmConfig] Final AI_PROVIDER value: "${AI_PROVIDER}"`);

/**
 * Call Groq API directly using fetch() - no SDK needed!
 */
async function callGroq(messages) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your-groq-api-key-here') {
    throw new Error('GROQ_API_KEY not configured in .env');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: messages,
        temperature: 0.7,
        max_tokens: 200,
      }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Call the AI LLM directly with messages
 */
async function callLLM(messages) {
  console.log(`[llmConfig] callLLM() called with AI_PROVIDER="${AI_PROVIDER}"`);
  switch (AI_PROVIDER) {
    case 'groq':
      return await callGroq(messages);
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || apiKey === 'your-openai-api-key-here') {
        throw new Error('OPENAI_API_KEY not configured in .env');
      }
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: messages,
          temperature: 0.7,
          max_tokens: 200,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
      }
      const data = await response.json();
      return data.choices[0].message.content;
    }
    case 'ollama':
    default: {
      const ollamaLLM = new ChatOllama({
        baseUrl: "http://localhost:11434",
        model: "llama3",
        temperature: 0.7,
        maxTokens: 200,
        timeout: 5000,
      });
      const response = await ollamaLLM.invoke(messages);
      return response.content;
    }
  }
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

// Legacy support for backward compatibility
const llm = {
  invoke: async (messages) => {
    console.log(`[llm] llm.invoke() called, AI_PROVIDER="${AI_PROVIDER}"`);
    console.log(`[LLM] Invoking ${AI_PROVIDER}...`);
    const content = await callLLM(messages);
    console.log(`[LLM] Response received (${content.length} chars)`);
    return { content };
  }
};

function getLLM(configType = "support") {
  return {
    invoke: async (messages) => {
      const content = await callLLM(messages);
      return { content };
    }
  };
}

module.exports = {
  llm,
  getLLM,
  llmConfigs,
  AI_PROVIDER,
  callLLM,
};