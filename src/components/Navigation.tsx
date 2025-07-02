'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuItems = [
    { name: 'Home', href: '/', current: true },
    { name: 'Kusadasi', href: 'https://www.kusadasi.biz/info/', current: false },
    { name: 'Ephesus', href: 'https://www.kusadasi.biz/ephesus/', current: false },
    { name: 'Around', href: 'https://www.kusadasi.biz/misc/', current: false },
    { name: 'Contact', href: 'https://www.kusadasi.biz/misc/contact/', current: false }
  ];

  return (
    <nav className="bg-zinc-50 pt-2">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="flex items-center">
              <Image
                src="https://www.kusadasi.biz/logoLight.png"
                alt="Kusadasi Logo"
                width={240}
                height={80}
                className="h-20 w-auto"
                priority
              />
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {menuItems.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className={`text-md block rounded-lg px-2 py-2 text-cyan-700 transition-all hover:text-cyan-500  ${
                    item.current
                      ? 'bg-zinc-100 text-blue-700'
                      : 'text-cyan-700 transition-all hover:text-cyan-500'
                  }`}
                >
                  {item.name}
                </a>
              ))}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-md text-cyan-600 hover:bg-gray-100 transition-colors duration-200"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t border-gray-200">
              {menuItems.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 ${
                    item.current
                      ? 'bg-zinc-100 text-cyan-700'
                      : 'text-cyan-700 hover:bg-gray-100 hover:text-cyan-500'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}