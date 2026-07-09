// Standalone test script to verify Groq API is working
// Run: node src/services/ai/testGroq.js

require('dotenv').config();

async function testGroq() {
  console.log('🧪 Testing Groq API directly...');
  console.log('API Key:', process.env.GROQ_API_KEY ? '✅ Found (' + process.env.GROQ_API_KEY.substring(0, 10) + '...)' : '❌ Missing');
  
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'say hello in 5 words' }],
        temperature: 0.7,
        max_tokens: 50,
      }),
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const error = await response.text();
      console.log('❌ Error:', error);
      return;
    }
    
    const data = await response.json();
    console.log('✅ Success! Response:', data.choices[0].message.content);
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

testGroq();