'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoryCreated?: () => void;
}

export function CreateStoryModal({
  isOpen,
  onClose,
  onStoryCreated,
}: CreateStoryModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const selectedFile = e.target.files[0];
    if (selectedFile.size > 30 * 1024 * 1024) {
      setError('File size exceeds 30MB limit.');
      return;
    }

    const isVideo = selectedFile.type.startsWith('video/');
    setMediaType(isVideo ? 'video' : 'image');
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setError(null);
  };

  const handlePublish = async () => {
    if (!file || isPublishing) return;
    setIsPublishing(true);
    setError(null);

    try {
      // 1. Upload to Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'lioransocial/stories');

      const uploadRes = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || 'Media upload failed');
      }

      // 2. Publish Story
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
          mediaType,
        }),
      });

      const storyData = await storyRes.json();
      if (!storyRes.ok) {
        throw new Error(storyData.error || 'Failed to publish story');
      }

      if (onStoryCreated) {
        onStoryCreated();
      }

      handleReset();
      onClose();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'An error occurred while publishing story.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setError(null);
    setIsPublishing(false);
  };

  const handleModalClose = () => {
    if (isPublishing) return;
    handleReset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121215] border border-[#27272a] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#27272a]">
          <h3 className="text-sm font-semibold text-white">
            {previewUrl ? 'Preview Story (24h)' : 'Add to Your Story'}
          </h3>

          <div className="flex items-center gap-3">
            {previewUrl && (
              <Button
                size="sm"
                variant="primary"
                onClick={handlePublish}
                isLoading={isPublishing}
                leftIcon={!isPublishing && <Sparkles className="w-3.5 h-3.5 text-zinc-950" />}
              >
                Share
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

          {!previewUrl ? (
            <div className="border-2 border-dashed border-[#27272a] hover:border-zinc-500 rounded-2xl p-10 text-center transition-colors">
              <input
                type="file"
                id="story-file-input"
                accept="image/png, image/jpeg, image/webp, video/mp4, video/webm, video/quicktime"
                className="hidden"
                onChange={handleFileChange}
              />
              <label htmlFor="story-file-input" className="cursor-pointer flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-300 shadow-lg">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">Select photo or video</p>
                  <p className="text-xs text-zinc-400 mt-1">Disappears automatically after 24 hours</p>
                </div>
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative w-full max-w-xs mx-auto aspect-[9/16] bg-black rounded-xl overflow-hidden border border-[#27272a] shadow-lg">
                {mediaType === 'video' ? (
                  <video
                    ref={videoRef}
                    src={previewUrl}
                    controls
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Story preview" className="w-full h-full object-cover" />
                )}
              </div>
              <p className="text-center text-xs text-zinc-500">
                Your story will be visible to your followers for 24 hours.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
