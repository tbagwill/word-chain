import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rate limiting storage (in production, use Redis or a database)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 10, // Allow 10 requests
  windowMs: 15 * 60 * 1000, // Per 15 minutes
  blockDurationMs: 5 * 60 * 1000, // Block for 5 minutes after limit exceeded
};

function getRateLimitKey(request: NextRequest): string {
  // Use IP address as the key (you could also use session ID or user ID later)
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 
             request.headers.get('x-real-ip') || 
             'unknown';
  return `wordchain:${ip}`;
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  // If no record exists or the window has expired, create a new one
  if (!record || now >= record.resetTime) {
    const newRecord = {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs
    };
    rateLimitStore.set(key, newRecord);
    
    return {
      allowed: true,
      remaining: RATE_LIMIT.maxRequests - 1,
      resetTime: newRecord.resetTime
    };
  }

  // Check if user has exceeded the limit
  if (record.count >= RATE_LIMIT.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime
    };
  }

  // Increment the count
  record.count++;
  rateLimitStore.set(key, record);

  return {
    allowed: true,
    remaining: RATE_LIMIT.maxRequests - record.count,
    resetTime: record.resetTime
  };
}

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now >= record.resetTime + RATE_LIMIT.blockDurationMs) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

export async function GET(request: NextRequest) {
  try {
    // Check rate limit
    const rateLimitKey = getRateLimitKey(request);
    const rateLimitResult = checkRateLimit(rateLimitKey);

    // Add rate limit headers to response
    const headers = {
      'X-RateLimit-Limit': RATE_LIMIT.maxRequests.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
    };

    if (!rateLimitResult.allowed) {
      const resetInMinutes = Math.ceil((rateLimitResult.resetTime - Date.now()) / 60000);
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded', 
          message: `Too many requests. Please try again in ${resetInMinutes} minutes.`,
          retryAfter: resetInMinutes
        },
        { 
          status: 429,
          headers
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const length = parseInt(searchParams.get('length') || '5');

    // Validate length parameter
    if (length < 3 || length > 8) {
      return NextResponse.json(
        { error: 'Invalid length. Must be between 3 and 8.' },
        { status: 400, headers }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a word chain puzzle generator. Create a chain of exactly ${length} words where each adjacent pair forms a common English phrase or compound word. For example: "good time out side walk" where "good time", "time out", "out side", "side walk" are all common phrases. Return only a JSON array of the words, nothing else.`
        },
        {
          role: "user",
          content: `Generate a word chain of exactly ${length} words where adjacent words form common phrases.`
        }
      ],
      temperature: 0.8,
      max_tokens: 100,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    let words: string[];
    try {
      words = JSON.parse(content);
    } catch {
      // If JSON parsing fails, try to extract words from the response
      const wordMatches = content.match(/\b[a-zA-Z]+\b/g);
      if (wordMatches && wordMatches.length >= length) {
        words = wordMatches.slice(0, length);
      } else {
        throw new Error('Failed to parse word chain from response');
      }
    }

    // Validate the response
    if (!Array.isArray(words) || words.length !== length) {
      throw new Error(`Expected ${length} words, got ${words?.length || 0}`);
    }

    // Ensure all words are strings and clean them up
    const cleanWords = words.map(word => 
      typeof word === 'string' ? word.trim().toUpperCase() : String(word).trim().toUpperCase()
    );

    return NextResponse.json({ words: cleanWords }, { headers });

  } catch (error) {
    console.error('Error generating word chain:', error);
    
    // Don't expose internal errors to prevent information leakage
    return NextResponse.json(
      { 
        error: 'Failed to generate word chain',
        message: 'Please try again in a moment.'
      },
      { status: 500 }
    );
  }
} 