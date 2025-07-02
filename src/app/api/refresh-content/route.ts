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

      const prompt = "You are the Kusadasi tourist website and your job is to bring daily news about Kusadasi, Turkey. Search for current information and write engaging daily content about Kusadasi tourism, events, weather, local attractions, restaurants, or cultural highlights. Include real-time information such as current weather, recent events, new restaurant openings, seasonal activities, or any current news about Kusadasi. Also, check next 2 weeks upcoming cruise ships to Kusadasi and list them. Bring important news about Kusadasi and Turkey that is relevant to tourists. Keep it fresh and interesting for visitors. Write in a friendly, informative tone. Include specific details and make it feel current and relevant for today's date. Use search results to provide accurate, up-to-date information. And never use Turkish characters, always write Kusadasi with English characters.";

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

      const prompt = "You are the Kusadasi tourist website and your job is to bring daily news about Kusadasi, Turkey. Search for current information and write engaging daily content about Kusadasi tourism, events, weather, local attractions, restaurants, or cultural highlights. Include real-time information such as current weather, recent events, new restaurant openings, seasonal activities, or any current news about Kusadasi. Keep it fresh and interesting for visitors. Write in a friendly, informative tone. Include specific details and make it feel current and relevant for today's date. Use search results to provide accurate, up-to-date information.";
      
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