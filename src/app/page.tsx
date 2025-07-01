import { Suspense } from 'react';
import { kv } from '@vercel/kv';

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
      <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed">
        {content}
      </div>
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 dark:from-gray-900 dark:to-blue-900">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold text-blue-900 dark:text-blue-100 mb-4">
            Kuşadası Tourism
          </h1>
          <p className="text-xl text-blue-700 dark:text-blue-300 mb-2">
            Your Daily Gateway to Turkey&apos;s Aegean Paradise
          </p>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {currentDate}
          </p>
        </header>

        <main className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 md:p-12">
            <h2 className="text-3xl font-semibold text-gray-800 dark:text-gray-200 mb-8 text-center">
              Today&apos;s Kuşadası Update
            </h2>
            
            <Suspense fallback={<LoadingContent />}>
              <DailyContent />
            </Suspense>
          </div>
        </main>

        <footer className="text-center mt-12 text-gray-600 dark:text-gray-400">
          <p className="text-sm">
            Daily content refreshed at 6:00 AM Turkish Time
          </p>
          <p className="text-xs mt-2">
            Powered by AI • Fresh content every day
          </p>
        </footer>
      </div>
    </div>
  );
}
