'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Video as VideoIcon,
  Sparkles,
  ChevronLeft,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ReelData } from './ReelPlayer';

export interface CreateReelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReelCreated?: (reel: ReelData) => void;
}

export function CreateReelModal({
  isOpen,
  onClose,
  onReelCreated,
}: CreateReelModalProps) {
  const [step, setStep] = useState<'select' | 'preview' | 'caption'>('select');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    if (file.size > 50 * 1024 * 1024) {
      setError('Video file exceeds 50MB limit.');
      return;
    }

    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file (MP4, WebM, MOV).');
      return;
    }

    setError(null);
    setVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
    setStep('preview');
  };

  const handlePublish = async () => {
    if (!videoFile || isPublishing) return;
    setIsPublishing(true);
    setError(null);
    setUploadProgress(10);

    try {
      // 1. Check for signed direct Cloudinary upload
      const signRes = await fetch('/api/media/sign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: 'lioransocial/reels' }),
      });

      const signData = await signRes.json();
      let videoMetadata: {
        url: string;
        secureUrl: string;
        publicId: string;
        width?: number;
        height?: number;
        duration?: number;
        thumbnail?: string;
      };

      if (signRes.ok && signData.configured) {
        // Direct Cloudinary upload
        const formData = new FormData();
        formData.append('file', videoFile);
        formData.append('api_key', signData.apiKey);
        formData.append('timestamp', String(signData.timestamp));
        formData.append('signature', signData.signature);
        formData.append('folder', signData.folder);

        setUploadProgress(40);

        const uploadUrl = `https://api.cloudinary.com/v1_1/${signData.cloudName}/video/upload`;
        const directRes = await fetch(uploadUrl, {
          method: 'POST',
          body: formData,
        });

        const directData = await directRes.json();
        if (!directRes.ok) {
          throw new Error(directData.error?.message || 'Direct video upload failed');
        }

        setUploadProgress(80);

        // Generate thumbnail URL by transforming .mp4 to .jpg
        const thumbnail = directData.secure_url
          ? directData.secure_url.replace(/\.[^/.]+$/, '.jpg')
          : undefined;

        videoMetadata = {
          url: directData.url || directData.secure_url,
          secureUrl: directData.secure_url,
          publicId: directData.public_id,
          width: directData.width,
          height: directData.height,
          duration: directData.duration,
          thumbnail,
        };
      } else {
        // Server upload stream fallback
        const formData = new FormData();
        formData.append('file', videoFile);
        formData.append('folder', 'lioransocial/reels');

        setUploadProgress(50);

        const uploadRes = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || 'Video upload failed');
        }

        setUploadProgress(80);

        const thumbnail = uploadData.media.secureUrl
          ? uploadData.media.secureUrl.replace(/\.[^/.]+$/, '.jpg')
          : undefined;

        videoMetadata = {
          url: uploadData.media.url,
          secureUrl: uploadData.media.secureUrl,
          publicId: uploadData.media.publicId,
          width: uploadData.media.width,
          height: uploadData.media.height,
          thumbnail,
        };
      }

      // 2. Create Reel record
      setUploadProgress(90);
      const reelRes = await fetch('/api/reels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video: videoMetadata,
          caption: caption.trim(),
        }),
      });

      const reelData = await reelRes.json();
      if (!reelRes.ok) {
        throw new Error(reelData.error || 'Failed to publish reel');
      }

      setUploadProgress(100);

      if (onReelCreated) {
        onReelCreated(reelData.reel);
      }

      handleReset();
      onClose();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'An error occurred while uploading reel.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleReset = () => {
    setStep('select');
    setVideoFile(null);
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl(null);
    }
    setCaption('');
    setError(null);
    setIsPublishing(false);
    setUploadProgress(0);
  };

  const handleModalClose = () => {
    if (isPublishing) return;
    handleReset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121215] border border-[#27272a] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#27272a]">
          <div className="flex items-center gap-2">
            {step === 'preview' && (
              <button
                onClick={() => setStep('select')}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step === 'caption' && (
              <button
                onClick={() => setStep('preview')}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Preview
              </button>
            )}
            <h3 className="text-sm font-semibold text-white ml-1">
              {step === 'select' && 'Create new Reel'}
              {step === 'preview' && 'Video Preview'}
              {step === 'caption' && 'Add Reel Caption'}
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {step === 'preview' && (
              <Button size="sm" variant="primary" onClick={() => setStep('caption')} rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                Next
              </Button>
            )}
            {step === 'caption' && (
              <Button
                size="sm"
                variant="primary"
                onClick={handlePublish}
                isLoading={isPublishing}
                leftIcon={!isPublishing && <Sparkles className="w-3.5 h-3.5 text-zinc-950" />}
              >
                Publish
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

          {/* STEP 1: Select Video */}
          {step === 'select' && (
            <div className="border-2 border-dashed border-[#27272a] hover:border-zinc-500 rounded-2xl p-12 text-center transition-colors">
              <input
                type="file"
                id="reel-file-input"
                accept="video/mp4, video/webm, video/quicktime"
                className="hidden"
                onChange={handleFileChange}
              />
              <label htmlFor="reel-file-input" className="cursor-pointer flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-300 shadow-lg">
                  <VideoIcon className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">Select vertical video from device</p>
                  <p className="text-xs text-zinc-400 mt-1">MP4, WebM, or MOV up to 50MB (9:16 aspect ratio recommended)</p>
                </div>
              </label>
            </div>
          )}

          {/* STEP 2: Preview Video */}
          {step === 'preview' && videoPreviewUrl && (
            <div className="space-y-4">
              <div className="relative w-full max-w-xs mx-auto aspect-[9/16] bg-black rounded-xl overflow-hidden border border-[#27272a] shadow-lg">
                <video
                  ref={videoRef}
                  src={videoPreviewUrl}
                  controls
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-center text-xs text-zinc-400">
                Original video audio will be preserved. Tap play to test audio & timing.
              </p>
            </div>
          )}

          {/* STEP 3: Write Caption */}
          {step === 'caption' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <label htmlFor="reel-caption-textarea">Write a caption for your Reel</label>
                  <span className={caption.length > 450 ? 'text-amber-400' : 'text-zinc-500'}>
                    {caption.length} / 500
                  </span>
                </div>
                <textarea
                  id="reel-caption-textarea"
                  rows={4}
                  maxLength={500}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Describe your Reel, tag friends with @username, or add hashtags..."
                  disabled={isPublishing}
                  className="w-full rounded-xl bg-[#18181b] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 border border-[#27272a] focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 resize-none"
                />
              </div>

              {isPublishing && (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs text-zinc-400 font-medium">
                    <span>Uploading Reel...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
