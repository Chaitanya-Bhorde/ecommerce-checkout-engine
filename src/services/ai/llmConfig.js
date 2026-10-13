// AI Configuration - Multiple provider support
// Uses DIRECT fetch() for maximum reliability (no SDK dependency issues)

const { ChatOllama } = require("@langchain/ollama");

// Check which AI provider to use
const AI_PROVIDER = process.env.AI_PROVIDER || 'ollama';
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '25000', 10);
const AI_MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS || '400', 10);

function debugLog(...args) {
  if (process.env.DEBUG_AI === 'true') console.log(...args);
}

async function fetchWithTimeout(url, options, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
async function callGroq(messages, maxTokens = AI_MAX_TOKENS, temperature = 0.7, timeout = AI_TIMEOUT_MS, stream = false, onToken = null) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your-groq-api-key-here') {
    throw new Error('GROQ_API_KEY not configured in .env');
  }
  const body = { model: GROQ_MODEL, messages, temperature, max_tokens: maxTokens };
  if (stream) body.stream = true;
  const response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, timeout);
  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(`Groq API error ${response.status}: ${errorText.slice(0, 300)}`);
    err.status = response.status;
    throw err;
  }
  if (stream && onToken) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    let buffer = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const payload = t.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            const token = json.choices?.[0]?.delta?.content;
            if (token) { full += token; onToken(token); }
          } catch (_) { /* partial */ }
        }
      }
    } finally { reader.releaseLock(); }
    return full;
  }
  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Call the AI LLM directly with messages
 * @param {Array} messages - Array of {role, content} message objects
 * @param {Object} options - Optional overrides (e.g. { maxTokens: 1000, temperature: 0.3 })
 */
async function callLLM(messages, options = {}) {
  const maxTokens = options.maxTokens || AI_MAX_TOKENS;
  const temperature = options.temperature ?? 0.7;
  const timeout = options.timeout || AI_TIMEOUT_MS;
  const stream = options.stream || false;
  const onToken = options.onToken || null;
  if (AI_PROVIDER === 'groq') {
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return await callGroq(messages, maxTokens, temperature, timeout, stream, onToken);
      } catch (err) {
        lastError = err;
        if (err.status === 401 || err.status === 403 || err.status === 400 || err.status === 404) break;
        if (attempt === 1) await new Promise((r) => setTimeout(r, 500));
      }
    }
    throw lastError;
  }
  if (AI_PROVIDER === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || apiKey === 'your-openai-api-key-here') {
        throw new Error('OPENAI_API_KEY not configured in .env');
      }
      const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
          messages: messages,
          temperature: temperature,
          max_tokens: maxTokens,
        }),
      }, timeout);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error ${response.status}: ${errorText.slice(0, 300)}`);
      }
      const data = await response.json();
      return data.choices[0].message.content;
  }
  const ollamaLLM = new ChatOllama({
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "llama3",
    temperature: temperature,
    maxTokens: maxTokens,
    timeout: timeout,
  });
  const invokePromise = ollamaLLM.invoke(messages);
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Ollama request timed out after ${timeout}ms.`)), timeout)
  );
  const response = await Promise.race([invokePromise, timeoutPromise]);
  return response.content;
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
  invoke: async (messages, options = {}) => {
    debugLog(`[LLM] Invoking ${AI_PROVIDER}...`);
    const content = await callLLM(messages, options);
    debugLog(`[LLM] Response received (${content.length} chars)`);
    return { content };
  }
};

function getLLM(configType = "support") {
  return {
    invoke: async (messages, options = {}) => {
      const content = await callLLM(messages, options);
      return { content };
    }
  };
}

module.exports = {
  llm,
  getLLM,
  llmConfigs,
  AI_PROVIDER,
  GROQ_MODEL,
  callLLM,
};