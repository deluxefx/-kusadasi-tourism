import { Suspense } from 'react';
import { kv } from '@vercel/kv';
import ReactMarkdown from 'react-markdown';
import Navigation from '@/components/Navigation';

// Force dynamic rendering to always show latest content
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getDailyContent() {
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
    
    // Try a few different recent dates as fallback
    if (!content) {
      for (let i = 0; i < 7; i++) {
        const testDate = new Date();
        testDate.setDate(testDate.getDate() - i);
        const testKey = `kusadasi-content-${testDate.toISOString().split('T')[0]}`;
        content = await kv.get(testKey);
        if (content) {
          break;
        }
      }
    }
    
    return (content as string) || 'Welcome to Kusadasi! Your daily dose of tourism updates will appear here soon. Content refreshes daily at 6 AM Turkish Time.';
  } catch (error) {
    console.error('Error fetching daily content:', error);
    return 'Welcome to Kusadasi! Your daily dose of tourism updates will appear here soon.';
  }
}

function LoadingContent() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
    </div>
  );
}

async function DailyContent() {
  const content = await getDailyContent();
  
  return (
    <div className="prose prose-lg max-w-4xl mx-auto">
      <ReactMarkdown
        components={{
          h1: ({children}) => <h1 className="text-3xl font-bold text-blue-900 mb-4">{children}</h1>,
          h2: ({children}) => <h2 className="text-2xl font-semibold text-blue-800 mb-3 mt-6">{children}</h2>,
          h3: ({children}) => <h3 className="text-xl font-medium text-blue-700 mb-2 mt-4">{children}</h3>,
          p: ({children}) => <p className="text-gray-800 mb-4 leading-relaxed">{children}</p>,
          ul: ({children}) => <ul className="list-disc list-inside mb-4 text-gray-800">{children}</ul>,
          li: ({children}) => <li className="mb-2">{children}</li>,
          strong: ({children}) => <strong className="font-semibold text-blue-800">{children}</strong>,
          em: ({children}) => <em className="italic text-gray-700">{children}</em>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function Home() {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="min-h-screen bg-zinc-50">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl leading-tighter tracking-tighter mb-4 font-heading text-slate-600 ">
         Welcome to Kusadasi 
          </h1>
          <p className="text-slate-500 mb-2">
            Your Daily Gateway to Turkey&apos;s Aegean Paradise
          </p>
          <p className="text-lg text-gray-600">
            {currentDate}
          </p>
        </header>

        <main className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
            <h2 className="text-3xl font-semibold text-gray-800 mb-8 text-center">
              Today&apos;s Kusadasi Update
            </h2>
            
            <Suspense fallback={<LoadingContent />}>
              <DailyContent />
            </Suspense>
          </div>
        </main>

        <footer className="text-center mt-12 text-gray-600">
          <p className="text-sm">
           © 2025 - All Rights Reserved.


          </p>
          <p className="text-xs mt-2">
           Kusadasi.biz: Your Complete Guide to Kusadasi, Turkey
          </p>
            <p className="text-xs mt-2">
      
          </p>
        
        </footer>
      </div>
    </div>
  );
}
