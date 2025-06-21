import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET(request: NextRequest) {
  try {
    // Parse the length query parameter, default to 5 if missing
    const { searchParams } = new URL(request.url);
    const lengthParam = searchParams.get('length');
    const length = lengthParam ? parseInt(lengthParam, 10) : 5;

    // Validate length parameter
    if (isNaN(length) || length < 2 || length > 20) {
      return NextResponse.json(
        { error: 'Length must be a number between 2 and 20' },
        { status: 400 }
      );
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Generate word chain using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a word-chain generator. Return a JSON array of ${length} words where each adjacent pair is a valid phrase. For example, if length=3, you might return ["good", "time", "out"] because "good time" and "time out" are common phrases. Return ONLY the JSON array, no additional text.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    // Extract the response content
    const responseContent = completion.choices[0]?.message?.content;
    
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    let words: string[];
    try {
      // Clean the response to extract just the JSON array
      const jsonMatch = responseContent.match(/\[.*\]/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON format in response');
      }
      
      words = JSON.parse(jsonMatch[0]);
      
      // Validate that we got the expected number of words
      if (!Array.isArray(words) || words.length !== length) {
        throw new Error(`Expected ${length} words, got ${words.length}`);
      }
      
      // Validate that all items are strings
      if (!words.every(word => typeof word === 'string' && word.trim().length > 0)) {
        throw new Error('All words must be non-empty strings');
      }
      
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', responseContent);
      throw new Error('Failed to parse word chain response');
    }

    // Return the word chain
    return NextResponse.json({ words });

  } catch (error) {
    console.error('Word chain generation failed:', error);
    return NextResponse.json(
      { error: 'Word chain generation failed' },
      { status: 500 }
    );
  }
} 