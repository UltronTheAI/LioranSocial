'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IPostImage } from '@/models/Post';

export interface ImageCarouselProps {
  images: IPostImage[];
  onDoubleTap?: () => void;
  className?: string;
}

export function ImageCarousel({ images, onDoubleTap, className = '' }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="w-full aspect-square bg-[#121215] flex items-center justify-center text-zinc-600 text-xs">
        No image available
      </div>
    );
  }

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  return (
    <div
      className={`relative w-full aspect-square bg-black overflow-hidden select-none group ${className}`}
      onDoubleClick={onDoubleTap}
    >
      {/* Active Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[currentIndex]?.secureUrl || images[currentIndex]?.url}
        alt={`Post photo ${currentIndex + 1}`}
        className="w-full h-full object-cover"
        draggable={false}
      />

      {/* Counter Badge (e.g. 1/3) */}
      {images.length > 1 && (
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-medium text-white/90 shadow-md">
          {currentIndex + 1}/{images.length}
        </div>
      )}

      {/* Prev Navigation Button */}
      {images.length > 1 && (
        <button
          type="button"
          onClick={handlePrev}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-md"
          aria-label="Previous photo"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {/* Next Navigation Button */}
      {images.length > 1 && (
        <button
          type="button"
          onClick={handleNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-md"
          aria-label="Next photo"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Bottom Dot Indicators */}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5 pointer-events-none">
          {images.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-200 shadow-sm ${
                idx === currentIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

