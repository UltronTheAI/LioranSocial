import React from 'react';
import Link from 'next/link';
import { Compass, Home, Video } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6 bg-[#121215] border border-[#27272a] rounded-3xl p-8 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto text-zinc-400">
          <Compass className="w-8 h-8 text-rose-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white">Sorry, this page isn&apos;t available.</h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            The link you followed may be broken, or the post or reel may have been removed.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="primary" size="sm" className="w-full" leftIcon={<Home className="w-4 h-4" />}>
              Go to Home Feed
            </Button>
          </Link>
          <Link href="/reels" className="w-full sm:w-auto">
            <Button variant="secondary" size="sm" className="w-full" leftIcon={<Video className="w-4 h-4" />}>
              Watch Reels
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
