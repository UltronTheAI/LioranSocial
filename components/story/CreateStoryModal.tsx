'use client';

import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Upload,
  Sparkles,
  Plus,
  Trash2,
  Clapperboard,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoryCreated?: () => void;
}

interface StoryDraftItem {
  id: string;
  file: File;
  previewUrl: string;
  mediaType: 'image' | 'video';
}

export function CreateStoryModal({
  isOpen,
  onClose,
  onStoryCreated,
}: CreateStoryModalProps) {
  const [items, setItems] = useState<StoryDraftItem[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilesAdded = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const filesArray = Array.from(e.target.files);
    const availableSlots = 10 - items.length;

    if (availableSlots <= 0) {
      setError('You can select a maximum of 10 stories at once.');
      return;
    }

    const filesToAdd = filesArray.slice(0, availableSlots);
    const newDraftItems: StoryDraftItem[] = [];

    for (const f of filesToAdd) {
      if (f.size > 50 * 1024 * 1024) {
        setError(`File "${f.name}" exceeds 50MB limit.`);
        continue;
      }

      const isVideo = f.type.startsWith('video/');
      newDraftItems.push({
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        file: f,
        previewUrl: URL.createObjectURL(f),
        mediaType: isVideo ? 'video' : 'image',
      });
    }

    if (newDraftItems.length > 0) {
      setItems((prev) => [...prev, ...newDraftItems]);
      setError(null);
    }

    if (e.target) {
      e.target.value = '';
    }
  };

  const handleRemoveItem = (indexToRemove: number) => {
    setItems((prev) => {
      const itemToRemove = prev[indexToRemove];
      if (itemToRemove?.previewUrl) {
        URL.revokeObjectURL(itemToRemove.previewUrl);
      }
      const updated = prev.filter((_, idx) => idx !== indexToRemove);
      if (activeIndex >= updated.length) {
        setActiveIndex(Math.max(0, updated.length - 1));
      }
      return updated;
    });
  };

  const handlePublishAll = async () => {
    if (items.length === 0 || isPublishing) return;
    setIsPublishing(true);
    setError(null);
    setPublishProgress({ current: 0, total: items.length });

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        setPublishProgress({ current: i + 1, total: items.length });

        // 1. Upload media to Cloudinary
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('folder', 'lioransocial/stories');

        const uploadRes = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || `Upload failed for story ${i + 1}`);
        }

        // 2. Create Story in DB
        const storyRes = await fetch('/api/stories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            media: {
              url: uploadData.media.url,
              secureUrl: uploadData.media.secureUrl,
              publicId: uploadData.media.publicId,
              width: uploadData.media.width,
              height: uploadData.media.height,
            },
            mediaType: item.mediaType,
          }),
        });

        const storyData = await storyRes.json();
        if (!storyRes.ok) {
          throw new Error(storyData.error || `Publish failed for story ${i + 1}`);
        }
      }

      if (onStoryCreated) {
        onStoryCreated();
      }

      handleReset();
      onClose();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'An error occurred while publishing stories.');
    } finally {
      setIsPublishing(false);
      setPublishProgress(null);
    }
  };

  const handleReset = () => {
    items.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setItems([]);
    setActiveIndex(0);
    setError(null);
    setIsPublishing(false);
    setPublishProgress(null);
  };

  const handleModalClose = () => {
    if (isPublishing) return;
    handleReset();
    onClose();
  };

  if (!isOpen || typeof document === 'undefined') return null;

  const currentItem = items[activeIndex];

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121215] border border-[#27272a] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#27272a]">
          <div>
            <h3 className="text-sm font-semibold text-white">
              {items.length > 0 ? `Story (${items.length}/10)` : 'Add to Your Story'}
            </h3>
            <p className="text-[11px] text-zinc-400">Photos & vertical videos • 24 hours</p>
          </div>

          <div className="flex items-center gap-3">
            {items.length > 0 && (
              <Button
                size="sm"
                variant="primary"
                onClick={handlePublishAll}
                isLoading={isPublishing}
                leftIcon={!isPublishing && <Sparkles className="w-3.5 h-3.5 text-zinc-950" />}
              >
                {publishProgress
                  ? `Posting ${publishProgress.current}/${publishProgress.total}`
                  : items.length > 1
                  ? `Share ${items.length} Stories`
                  : 'Share Story'}
              </Button>
            )}
            <button
              onClick={handleModalClose}
              disabled={isPublishing}
              className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Hidden Multi File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/webp, video/mp4, video/webm, video/quicktime"
          multiple
          className="hidden"
          onChange={handleFilesAdded}
        />

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

          {items.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#27272a] hover:border-zinc-500 rounded-2xl p-10 sm:p-12 text-center transition-colors cursor-pointer"
            >
              <div className="cursor-pointer flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-300 shadow-lg">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">Select photos or videos</p>
                  <p className="text-xs text-zinc-400 mt-1">Upload up to 10 items at once (disappears in 24h)</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-400 bg-[#18181b] px-3.5 py-1.5 rounded-xl border border-[#27272a]">
                  <span className="flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5 text-emerald-400" /> JPG, PNG, WebP</span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5"><Clapperboard className="w-3.5 h-3.5 text-rose-400" /> MP4, WebM</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Story Preview Card */}
              {currentItem && (
                <div className="relative w-full max-w-xs mx-auto aspect-[9/16] bg-black rounded-2xl overflow-hidden border border-[#27272a] shadow-xl">
                  {currentItem.mediaType === 'video' ? (
                    <video
                      key={currentItem.previewUrl}
                      src={currentItem.previewUrl}
                      controls
                      autoPlay
                      loop
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentItem.previewUrl}
                      alt="Story preview"
                      className="w-full h-full object-cover"
                    />
                  )}

                  {/* Badge */}
                  <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-semibold text-white border border-white/10 flex items-center gap-1.5">
                    {currentItem.mediaType === 'video' ? (
                      <Clapperboard className="w-3 h-3 text-rose-400" />
                    ) : (
                      <ImageIcon className="w-3 h-3 text-emerald-400" />
                    )}
                    <span>
                      {activeIndex + 1} of {items.length}
                    </span>
                  </div>

                  {/* Delete active item button */}
                  <button
                    onClick={() => handleRemoveItem(activeIndex)}
                    disabled={isPublishing}
                    className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 backdrop-blur-md text-rose-400 hover:text-white hover:bg-rose-600 transition-colors border border-white/10"
                    title="Remove this story"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Horizontal Multi-Story Thumbnail Strip */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                  <span>Selected Stories ({items.length}/10)</span>
                  {items.length < 10 && !isPublishing && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1 text-zinc-300 hover:text-white font-medium cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add more</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
                  {items.map((item, idx) => (
                    <div
                      key={item.id}
                      onClick={() => setActiveIndex(idx)}
                      className={`relative shrink-0 w-14 h-20 rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                        activeIndex === idx
                          ? 'border-white ring-2 ring-white/20 scale-105'
                          : 'border-[#27272a] opacity-60 hover:opacity-100'
                      }`}
                    >
                      {item.mediaType === 'video' ? (
                        <div className="w-full h-full bg-zinc-900 flex items-center justify-center relative">
                          <Clapperboard className="w-5 h-5 text-rose-400" />
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.previewUrl}
                          alt={`Thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute bottom-1 right-1 text-[9px] font-bold bg-black/70 px-1 rounded text-white">
                        {idx + 1}
                      </div>
                    </div>
                  ))}

                  {items.length < 10 && !isPublishing && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="shrink-0 w-14 h-20 rounded-xl border-2 border-dashed border-[#27272a] hover:border-zinc-400 flex flex-col items-center justify-center gap-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      title="Add more photos/videos"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="text-[9px] font-semibold">Add</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
