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
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format.
    const cacheKey = `kusadasi-content-${today}`;
    const generatedFlagKey = `kusadasi-generated-${today}`;
    
    // MONDAY CHECK: Only allow API calls to Google AI on Mondays
    const isMonday = true; // Temporarily allow generation any day
    
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
    
    // Only generate new content if not already done today AND it's Monday
    if (!generatedToday && isMonday) {
      // Define the grounding tool
      const groundingTool = {
        googleSearch: {},
      };

      // Configure generation settings
      const config = {
        tools: [groundingTool],
      };

      const prompt = `
Act as the official Kusadasi tourist website. Today is Monday and we are preparing a brand-new bulletin to welcome visitors for the entire week ahead. This bulletin should reflect real-time, current information and offer updated suggestions for the week starting today.

All factual information, especially weather, restaurants, hotels, events, cruise ship schedules, and local news—must be verified through search results. Do not invent brand names, places, or event details if they cannot be confirmed online. If something (like an opening date or cruise arrival) is not verifiable, say so explicitly.

Include the following in the bulletin:

1. Current weather for Kusadasi, and a brief outlook for the week (Monday to Sunday).
2. Recent events in Kusadasi that actually happened within the past 7 days.
3. Restaurant recommendations: Highlight 2 or 3 currently open, well-known spots. If no new restaurants have verifiably opened in the last few days, stick with popular, confirmed options.
4. Seasonal activities happening this week—beach activities, nature trips, cultural shows, etc.
5. Local news from Kusadasi and important national news from Turkey that may affect tourists.
6. Daily itinerary suggestions: Offer a friendly, useful plan for what to do each day (Monday to Sunday).
7. Cruise ship arrivals for the next two weeks. Use official port or cruise websites to verify. If no schedule is available, say clearly: Cruise arrival schedule for the next two weeks is currently unavailable.

Formatting and Tone:
- Tone: Cheerful, helpful, and informative—like a warm local friend helping tourists.
- Include this exact line:  
“When I am writing this bulletin, the current time in Kusadasi is [HH:MM AM/PM, GMT+3].”
- Replace [HH:MM AM/PM] with the actual current time in Kusadasi.
- Make sure the bulletin feels fresh and updated for this specific Monday and the week it begins.
- Do not use Turkish characters for the word "Kusadasi" (no ş, ı, etc.).

Today is [Insert today’s date: e.g. Monday, July 8, 2025]. Generate the bulletin as if it is being published this morning, for tourists arriving this week.
`;

      // Make the request with grounding (EXPENSIVE - only once per day)
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config,
      });

      const content = response.text;
      const generatedAt = new Date().toISOString();
      
      // Store content with timestamp
      const contentWithMeta = {
        content,
        generatedAt,
        date: today
      };
      
      // Cache the content and set the generated flag
      await kv.set(cacheKey, contentWithMeta, { ex: 30 * 24 * 60 * 60 }); // 30 days TTL
      await kv.set(generatedFlagKey, true, { ex: 23 * 60 * 60 }); // 23 hours TTL
      
      // Clean up old content to prevent database bloat
      await cleanupOldContent();
      
      return NextResponse.json({ 
        success: true, 
        content,
        cached: true,
        message: "New content generated with Google AI",
        date: today,
        generatedAt
      });
    } else {
      // Return existing content without generating new
      let content = existingContent || "Content generation limit reached for today. Please try again tomorrow.";
      let message = "Daily generation limit reached - returning cached content";
      
      // If it's not Monday, provide a different message
      if (!isMonday) {
        message = "New content is only generated on Mondays - returning cached content";
        if (!existingContent) {
          content = "New content is only generated on Mondays. Please check back on Monday for fresh content.";
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        content,
        cached: true,
        message,
        date: today,
        isMonday
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
    
    // MONDAY CHECK: Only allow API calls to Google AI on Mondays
    const isMonday = true; // Temporarily allow generation any day
    
    let content = await kv.get(cacheKey);
    
    // If no content for today, try yesterday as fallback
    if (!content) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = `kusadasi-content-${yesterday.toISOString().split('T')[0]}`;
      content = await kv.get(yesterdayKey);
    }
    
    // COST PROTECTION: Only generate if not already done today AND it's Monday
    const generatedToday = await kv.get(generatedFlagKey);
    
    if (!content && !generatedToday && isMonday) {
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
      const generatedAt = new Date().toISOString();
      
      // Store content with timestamp
      const contentWithMeta = {
        content,
        generatedAt,
        date: today
      };
      
      // Cache the fresh content and set generation flag
      await kv.set(cacheKey, contentWithMeta, { ex: 30 * 24 * 60 * 60 });
      await kv.set(generatedFlagKey, true, { ex: 23 * 60 * 60 });
    } else if (!content && generatedToday) {
      // Return fallback message if daily limit reached
      content = "Daily content generation limit reached for cost protection. Please check back tomorrow for fresh content.";
    } else if (!content && !isMonday) {
      // Return fallback message if it's not Monday
      content = "New content is only generated on Mondays. Please check back on Monday for fresh content.";
    }
    
    return NextResponse.json({ 
      success: true, 
      content,
      date: today,
      isMonday
    });
    
  } catch (error) {
    console.error('Error getting content:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get content' },
      { status: 500 }
    );
  }
}