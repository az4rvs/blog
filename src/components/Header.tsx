'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FaGithub } from 'react-icons/fa';

export default function Header() {
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > lastScrollY && window.scrollY > 80) {
        setVisible(false);
      } else {
        setVisible(true);
      }
      setLastScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-transform duration-500 ease-in-out ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="flex justify-between items-center max-w-2xl mx-auto px-6 py-6">
        <Link
          href="/"
          className="text-xl font-semibold text-gray-200 tracking-tight hover:text-purple-400 transition-colors"
        >
          José Melgarejo
        </Link>

        <nav className="flex items-center gap-6 text-gray-300">
          <Link href="/about" className="hover:text-purple-400 transition-colors">
            About
          </Link>
          <a
            href="https://github.com/az4rvs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:text-purple-400 transition-colors"
          >
            <FaGithub className="w-4 h-4" />
            Follow Me
          </a>
        </nav>
      </div>
    </header>
  );
}
