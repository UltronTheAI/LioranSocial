'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function AuthCard({ title, subtitle, children, footer, className }: AuthCardProps) {
  return (
    <div className="w-full max-w-[420px] mx-auto px-4 py-8 flex flex-col justify-center">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-zinc-800 to-zinc-900 border border-zinc-700/60 flex items-center justify-center mb-4 shadow-lg shadow-black/40">
          <span className="text-xl font-bold tracking-tight text-white font-mono">L</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="text-sm text-zinc-400 mt-1.5 max-w-sm">{subtitle}</p>}
      </div>

      {/* Main Card */}
      <div
        className={cn(
          'w-full bg-[#121215] border border-[#27272a] rounded-2xl p-6 md:p-8 shadow-xl shadow-black/60',
          className
        )}
      >
        {children}
      </div>

      {/* Footer / Links */}
      {footer && (
        <div className="mt-6 text-center text-xs text-zinc-400">
          {footer}
        </div>
      )}
    </div>
  );
}
