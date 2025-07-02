import { GoogleGenAI } from '@google/genai';
import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_AI_API_KEY!
});

async function cleanupOldContent() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Delete content older than 7 days
    const keysToDelete = [];
    for (let i = 8; i <= 30; i++) { // Check up to 30 days back
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - i);
      const oldKey = `kusadasi-content-${oldDate.toISOString().split('T')[0]}`;
      keysToDelete.push(oldKey);
    }
    
    // Delete old keys in batch
    for (const key of keysToDelete) {
      await kv.del(key);
    }
    
    console.log(`Cleaned up ${keysToDelete.length} old content keys`);
  } catch (error) {
    console.error('Error cleaning up old content:', error);
  }
}

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const cacheKey = `kusadasi-content-${today}`;
    const generatedFlagKey = `kusadasi-generated-${today}`;
    
    // COST PROTECTION: Check if content was already generated today
    const existingContent = await kv.get(cacheKey);
    const generatedToday = await kv.get(generatedFlagKey);
    
    if (existingContent && generatedToday) {
      return NextResponse.json({ 
        success: true, 
        content: existingContent,
        cached: true,
        message: "Content already generated today - cost protection active",
        date: today 
      });
    }
    
    // Only generate new content if not already done today
    if (!generatedToday) {
      // Define the grounding tool
      const groundingTool = {
        googleSearch: {},
      };

      // Configure generation settings
      const config = {
        tools: [groundingTool],
      };

      const prompt = `
Act as the official Kusadasi tourist website. Provide a cheerful, informative, and real-time daily bulletin for visitors.

Crucially, all factual information, including brand names (restaurants, hotels, attractions, cruise lines, specific events), must be verified through search results. If a specific, verifiable brand name or piece of real-time information (e.g., a new restaurant opening today/this week, a specific cruise ship arrival for an exact date in the next two weeks) cannot be found reliably through search, state that information is not currently available or provide general categories instead of fabricating names or details. Do not invent names or specific details that are not confirmed by search.

Include:

Current weather for Kusadasi.

Recent, verifiable events in Kusadasi.

Actual, currently open, and well-known restaurant recommendations in Kusadasi. If a truly 'new' opening (within the last few days/week) with a confirmed name isn't found, recommend existing, popular establishments.

Seasonal activities relevant to Kusadasi.

Local news from Kusadasi.

Relevant news from wider Turkey that impacts tourism or general awareness in Kusadasi.

Specific details and daily itinerary suggestions for visitors.

A list of upcoming cruise ships expected to arrive in Kusadasi for the next two weeks. If this exact, forward-looking schedule is not publicly available or consistently updated online, state this clearly instead of listing generic or unverified ships.

Formatting and Tone:

Maintain a friendly, cheerful, and informative tone.

Ensure content feels current and relevant for today's date.

Do not use Turkish characters for 'Kusadasi'.

Announce the current Kusadasi time by stating: 'When I am writing this bulletin, the current time in Kusadasi is [HH:MM AM/PM, GMT+3].
`;

      // Make the request with grounding (EXPENSIVE - only once per day)
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config,
      });

      const content = response.text;
      
      // Cache the content and set the generated flag
      await kv.set(cacheKey, content, { ex: 25 * 60 * 60 }); // 25 hours TTL
      await kv.set(generatedFlagKey, true, { ex: 23 * 60 * 60 }); // 23 hours TTL
      
      // Clean up old content to prevent database bloat
      await cleanupOldContent();
      
      return NextResponse.json({ 
        success: true, 
        content,
        cached: true,
        message: "New content generated with Google AI",
        date: today 
      });
    } else {
      // Return existing content without generating new
      const content = existingContent || "Content generation limit reached for today. Please try again tomorrow.";
      return NextResponse.json({ 
        success: true, 
        content,
        cached: true,
        message: "Daily generation limit reached - returning cached content",
        date: today 
      });
    }
    
  } catch (error) {
    console.error('Error refreshing content:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to refresh content', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Also create a function to get cached content
export async function POST() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `kusadasi-content-${today}`;
    const generatedFlagKey = `kusadasi-generated-${today}`;
    
    let content = await kv.get(cacheKey);
    
    // If no content for today, try yesterday as fallback
    if (!content) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = `kusadasi-content-${yesterday.toISOString().split('T')[0]}`;
      content = await kv.get(yesterdayKey);
    }
    
    // COST PROTECTION: Only generate if not already done today
    const generatedToday = await kv.get(generatedFlagKey);
    
    if (!content && !generatedToday) {
      // Define the grounding tool
      const groundingTool = {
        googleSearch: {},
      };

      // Configure generation settings
      const config = {
        tools: [groundingTool],
      };

      const prompt = "Act as the official Kusadasi tourist website. Provide a cheerful, informative, and real-time daily bulletin for visitors. Include current weather, recent events, new restaurant openings, seasonal activities, and local news from Kusadasi and wider Turkey. Highlight specific details and create daily itineraries. Crucially, list upcoming cruise ships for the next two weeks. Do not use Turkish characters for 'Kusadasi'. Announce the current Kusadasi time by stating: 'When I am writing this bulletin, the current time in Kusadasi is [HH:MM AM/PM, GMT+3].";

      // Make the request with grounding (EXPENSIVE - only once per day)
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config,
      });

      content = response.text;
      
      // Cache the fresh content and set generation flag
      await kv.set(cacheKey, content, { ex: 25 * 60 * 60 });
      await kv.set(generatedFlagKey, true, { ex: 23 * 60 * 60 });
    } else if (!content && generatedToday) {
      // Return fallback message if daily limit reached
      content = "Daily content generation limit reached for cost protection. Please check back tomorrow for fresh content.";
    }
    
    return NextResponse.json({ 
      success: true, 
      content,
      date: today 
    });
    
  } catch (error) {
    console.error('Error getting content:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get content' },
      { status: 500 }
    );
  }
}