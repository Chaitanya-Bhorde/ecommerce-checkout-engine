// Sentiment Analysis Service
// Detects customer emotions: happy, neutral, angry, frustrated
// Adjusts AI responses based on sentiment

const { ChatOllama } = require('@langchain/ollama');

const llm = new ChatOllama({
  baseUrl: "http://localhost:11434",
  model: "llama3",
  temperature: 0.3,
  maxTokens: 50,
});

/**
 * Analyze sentiment of user message
 * @param {string} message - User's message
 * @returns {Promise<Object>} Sentiment analysis result
 */
async function analyzeSentiment(message) {
  try {
    const systemPrompt = `Analyze the sentiment of the following customer support message.
    
    Return ONLY one of these categories:
    - happy: Customer is happy, satisfied, or expressing gratitude
    - neutral: Normal inquiry, no strong emotion
    - angry: Customer is angry, frustrated, or upset
    - frustrated: Customer is confused or having trouble
    
    Message: "${message}"
    
    Respond with ONLY the category name (happy, neutral, angry, or frustrated).`;

    const response = await llm.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ]);

    const sentiment = response.content.toLowerCase().trim();
    
    // Validate sentiment
    const validSentiments = ['happy', 'neutral', 'angry', 'frustrated'];
    const detectedSentiment = validSentiments.includes(sentiment) ? sentiment : 'neutral';

    // Calculate sentiment score (-100 to 100)
    let score = 0;
    switch (detectedSentiment) {
      case 'happy':
        score = 80;
        break;
      case 'neutral':
        score = 0;
        break;
      case 'frustrated':
        score = -40;
        break;
      case 'angry':
        score = -80;
        break;
    }

    return {
      sentiment: detectedSentiment,
      score,
      confidence: 0.85, // Mock confidence score
    };
  } catch (error) {
    console.error('Sentiment analysis error:', error);
    return {
      sentiment: 'neutral',
      score: 0,
      confidence: 0,
    };
  }
}

/**
 * Get response strategy based on sentiment
 * @param {string} sentiment - Detected sentiment
 * @returns {Object} Response strategy
 */
function getResponseStrategy(sentiment) {
  switch (sentiment) {
    case 'happy':
      return {
        tone: 'friendly',
        priority: 'normal',
        emoji: true,
        suggestProducts: true,
        message: 'Customer is happy - maintain positive experience',
      };
    
    case 'angry':
      return {
        tone: 'empathetic',
        priority: 'high',
        emoji: false,
        suggestProducts: false,
        escalate: true,
        message: 'Customer is angry - prioritize resolution, offer human support',
      };
    
    case 'frustrated':
      return {
        tone: 'patient',
        priority: 'high',
        emoji: false,
        suggestProducts: false,
        message: 'Customer is frustrated - provide clear, step-by-step help',
      };
    
    default:
      return {
        tone: 'professional',
        priority: 'normal',
        emoji: true,
        suggestProducts: false,
        message: 'Normal inquiry - standard support',
      };
  }
}

/**
 * Analyze and get strategy
 * @param {string} message - User's message
 * @returns {Promise<Object>} Complete sentiment analysis with strategy
 */
async function analyzeAndGetStrategy(message) {
  const sentiment = await analyzeSentiment(message);
  const strategy = getResponseStrategy(sentiment.sentiment);
  
  return {
    ...sentiment,
    strategy,
  };
}

module.exports = {
  analyzeSentiment,
  getResponseStrategy,
  analyzeAndGetStrategy,
};