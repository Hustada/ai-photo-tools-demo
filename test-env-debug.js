#!/usr/bin/env node
// Debug environment variable loading

import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

console.log('=== Environment Debug ===');
console.log('process.env.GEMINI_API_KEY:', process.env.GEMINI_API_KEY);
console.log('Type:', typeof process.env.GEMINI_API_KEY);
console.log('Length:', process.env.GEMINI_API_KEY?.length);
console.log('First 20 chars:', process.env.GEMINI_API_KEY?.substring(0, 20));
console.log('Last 10 chars:', process.env.GEMINI_API_KEY?.slice(-10));

// Check for any whitespace or hidden characters
if (process.env.GEMINI_API_KEY) {
  console.log('Trimmed equals original:', process.env.GEMINI_API_KEY === process.env.GEMINI_API_KEY.trim());
  console.log('Contains newline:', process.env.GEMINI_API_KEY.includes('\n'));
  console.log('Contains return:', process.env.GEMINI_API_KEY.includes('\r'));
  
  // Show character codes
  console.log('\nCharacter codes:');
  for (let i = 0; i < 5; i++) {
    console.log(`Char ${i}: "${process.env.GEMINI_API_KEY[i]}" = ${process.env.GEMINI_API_KEY.charCodeAt(i)}`);
  }
}

console.log('\n=== Testing API Key ===');
try {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
  
  const result = await model.generateContent("Say 'test successful' if you can read this.");
  const response = await result.response;
  console.log('✅ API Response:', response.text());
} catch (error) {
  console.error('❌ Error:', error.message);
}