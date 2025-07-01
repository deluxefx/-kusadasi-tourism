import { GoogleGenerativeAI, DynamicRetrievalMode } from '@google/generative-ai';
import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

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
    // Try with grounding search first
    let model, prompt, result;
    
    try {
      model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        tools: [{
          googleSearchRetrieval: {
            dynamicRetrievalConfig: {
              mode: DynamicRetrievalMode.MODE_DYNAMIC,
              dynamicThreshold: 0.7,
            },
          },
        }],
      });
      
      prompt = "You are the Kusadasi tourist website and your job is to bring daily news about Kusadasi, Turkey. check todays data and  write engaging daily content about Kusadasi tourism, events, weather, local attractions, restaurants, or cultural highlights. Include real-time information such as current weather, recent events, new restaurant openings, seasonal activities, or any current news about Kusadasi. Keep it fresh and interesting for visitors. Write in a friendly, informative tone. Include specific details and make it feel current and relevant for today's date. Use search results to provide accurate, up-to-date information.";
      
      result = await model.generateContent(prompt);
    } catch (groundingError) {
      console.log('Grounding search failed, falling back to standard model:', groundingError);
      
      // Fallback to standard model without grounding
      model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      prompt = "You are the Kusadasi tourist website and your job is to bring daily news about Kusadasi, Turkey. Write engaging daily content about Kusadasi tourism, events, weather, local attractions, restaurants, or cultural highlights. Keep it fresh and interesting for visitors. Write in a friendly, informative tone. Include specific details and make it feel current and relevant for today's date. At the end of the content, please put note: includes online content generation.";
      
      result = await model.generateContent(prompt);
    }
    const response = await result.response;
    const content = response.text();
    
    // Cache the content with today's date as key
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const cacheKey = `kusadasi-content-${today}`;
    
    await kv.set(cacheKey, content, { ex: 25 * 60 * 60 }); // 25 hours TTL
    
    // Clean up old content to prevent database bloat
    await cleanupOldContent();
    
    return NextResponse.json({ 
      success: true, 
      content,
      cached: true,
      date: today 
    });
    
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
    
    let content = await kv.get(cacheKey);
    
    // If no content for today, try yesterday as fallback
    if (!content) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = `kusadasi-content-${yesterday.toISOString().split('T')[0]}`;
      content = await kv.get(yesterdayKey);
    }
    
    // If still no content, generate fresh content
    if (!content) {
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        tools: [{
          googleSearchRetrieval: {
            dynamicRetrievalConfig: {
              mode: DynamicRetrievalMode.MODE_DYNAMIC,
              dynamicThreshold: 0.7,
            },
          },
        }],
      });
      const prompt = "You are the Kusadasi tourist website and your job is to bring daily news about Kusadasi, Turkey. Search for current information and write engaging daily content about Kusadasi tourism, events, weather, local attractions, restaurants, or cultural highlights. Include real-time information such as current weather, recent events, new restaurant openings, seasonal activities, or any current news about Kusadasi. Keep it fresh and interesting for visitors. Write in a friendly, informative tone. Include specific details and make it feel current and relevant for today's date. Use search results to provide accurate, up-to-date information.";
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      content = response.text();
      
      // Cache the fresh content
      await kv.set(cacheKey, content, { ex: 25 * 60 * 60 });
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