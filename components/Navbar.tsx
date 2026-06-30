'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { calculateLevel, getLevelColor } from '@/lib/supabase';
import {
  Brain, Home, Upload, User, Trophy, Moon, Sun,
  LogOut, Settings, ChevronDown, Zap, Menu, X
} from 'lucide-react';
import Image from 'next/image';

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const level = profile ? calculateLevel(profile.total_xp) : 1;
  const levelColor = getLevelColor(level);

  const navLinks = [
    { href: '/dashboard', label: 'Home', icon: Home },
    { href: '/upload', label: 'Upload', icon: Upload },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 dark:bg-[#0a0a0f]/80 bg-white/80 backdrop-blur-xl dark:border-white/5 border-gray-200 border-b safe-top">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-base dark:text-white text-gray-900 hidden sm:block">
            Quiz<span className="text-violet-400">Master</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map(link => {
            const Icon = link.icon;
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'dark:bg-violet-500/15 bg-violet-100 text-violet-400'
                    : 'dark:text-gray-400 text-gray-500 dark:hover:text-white hover:text-gray-900 dark:hover:bg-white/5 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* XP chip */}
          {profile && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full dark:bg-violet-500/10 bg-violet-100 dark:border-violet-500/20 border-violet-200 border">
              <Zap className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-violet-400 text-xs font-bold">{profile.total_xp.toLocaleString()} XP</span>
            </div>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center dark:text-gray-400 text-gray-500 dark:hover:text-white hover:text-gray-900 dark:hover:bg-white/5 hover:bg-gray-100 transition-all"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User menu */}
          {user && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl dark:hover:bg-white/5 hover:bg-gray-100 transition-all"
              >
                <div className="relative w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center shrink-0">
                  {profile?.avatar_url ? (
                    <Image src={profile.avatar_url} alt="Avatar" fill className="object-cover" />
                  ) : (
                    <span className="text-white text-xs font-bold">
                      {(profile?.username || profile?.full_name || user.email || 'U')[0].toUpperCase()}
                    </span>
                  )}
                  {/* Level badge */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full dark:bg-[#0a0a0f] bg-white flex items-center justify-center">
                    <span className={`text-[8px] font-bold ${levelColor}`}>{level}</span>
                  </div>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 dark:text-gray-400 text-gray-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-2xl dark:bg-[#1a1a26] bg-white dark:border-white/10 border-gray-200 border shadow-xl shadow-black/20 overflow-hidden dropdown-enter">
                  {/* User info */}
                  <div className="px-4 py-3 dark:border-white/5 border-gray-100 border-b">
                    <p className="font-medium text-sm dark:text-white text-gray-900 truncate">
                      {profile?.full_name || profile?.username || 'User'}
                    </p>
                    <p className="dark:text-gray-400 text-gray-500 text-xs truncate">{user.email}</p>
                    <div className={`text-xs font-medium mt-0.5 ${levelColor}`}>
                      Level {level}
                    </div>
                  </div>

                  <div className="p-1.5">
                    <Link
                      href="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl dark:text-gray-300 text-gray-600 dark:hover:bg-white/5 hover:bg-gray-100 text-sm transition-all"
                    >
                      <User className="w-4 h-4" />
                      My Profile
                    </Link>
                    <Link
                      href="/profile/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl dark:text-gray-300 text-gray-600 dark:hover:bg-white/5 hover:bg-gray-100 text-sm transition-all"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 text-sm transition-all"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center dark:text-gray-400 text-gray-500 dark:hover:bg-white/5 hover:bg-gray-100 transition-all"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden dark:bg-[#0a0a0f]/95 bg-white/95 backdrop-blur-xl dark:border-white/5 border-gray-200 border-t px-4 py-3 space-y-1">
          {navLinks.map(link => {
            const Icon = link.icon;
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'dark:bg-violet-500/15 bg-violet-100 text-violet-400'
                    : 'dark:text-gray-400 text-gray-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
