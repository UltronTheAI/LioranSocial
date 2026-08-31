'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AlertProps {
  type?: 'error' | 'success' | 'info' | 'warning';
  title?: string;
  message: string;
  onClose?: () => void;
  className?: string;
}

export function Alert({ type = 'error', title, message, onClose, className }: AlertProps) {
  const styles = {
    error: {
      container: 'bg-rose-950/40 border-rose-900/60 text-rose-200',
      icon: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />,
    },
    success: {
      container: 'bg-emerald-950/40 border-emerald-900/60 text-emerald-200',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
    },
    info: {
      container: 'bg-sky-950/40 border-sky-900/60 text-sky-200',
      icon: <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />,
    },
    warning: {
      container: 'bg-amber-950/40 border-amber-900/60 text-amber-200',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
    },
  };

  const current = styles[type];

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3.5 rounded-xl border text-xs leading-relaxed transition-all duration-200',
        current.container,
        className
      )}
    >
      {current.icon}
      <div className="flex-1 space-y-0.5">
        {title && <p className="font-semibold text-white">{title}</p>}
        <p className="text-inherit opacity-90">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          type="button"
          className="text-inherit opacity-60 hover:opacity-100 transition-opacity p-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

