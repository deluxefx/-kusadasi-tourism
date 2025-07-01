import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().split('T')[0];
    
    // Check what keys exist in cache
    const todayKey = `kusadasi-content-${today}`;
    const todayContent = await kv.get(todayKey);
    const yesterdayContent = await kv.get(`kusadasi-content-${yesterdayKey}`);
    
    // List recent keys (try common patterns)
    const testKeys = [];
    for (let i = 0; i < 7; i++) {
      const testDate = new Date();
      testDate.setDate(testDate.getDate() - i);
      const testKey = `kusadasi-content-${testDate.toISOString().split('T')[0]}`;
      const content = await kv.get(testKey);
      if (content) {
        testKeys.push({ key: testKey, hasContent: true, contentLength: (content as string).length });
      }
    }
    
    return NextResponse.json({
      currentDate: today,
      todayKey,
      yesterdayKey: `kusadasi-content-${yesterdayKey}`,
      todayContent: todayContent ? (todayContent as string).substring(0, 100) + '...' : null,
      yesterdayContent: yesterdayContent ? (yesterdayContent as string).substring(0, 100) + '...' : null,
      foundKeys: testKeys
    });
    
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) });
  }
}