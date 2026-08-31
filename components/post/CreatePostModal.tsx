'use client';

import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import {
  X,
  Upload,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Sparkles,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { getCroppedImgBlob, Area } from '@/lib/crop-image';
import { useAuth } from '@/context/AuthContext';
import { PostCardData } from './PostCard';

export interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: (post: PostCardData) => void;
}

interface ImageItem {
  id: string;
  src: string;
  crop: { x: number; y: number };
  zoom: number;
  croppedAreaPixels: Area | null;
}

export function CreatePostModal({
  isOpen,
  onClose,
  onPostCreated,
}: CreatePostModalProps) {
  const { user: currentUser } = useAuth();

  const [step, setStep] = useState<'select' | 'crop' | 'caption'>('select');
  const [images, setImages] = useState<ImageItem[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [caption, setCaption] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeImage = images[activeImageIndex];

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);
    if (files.length > 10) {
      setError('You can select a maximum of 10 photos per post.');
      return;
    }

    setError(null);
    const newItems: ImageItem[] = [];
    let loadedCount = 0;

    files.forEach((file, idx) => {
      if (file.size > 10 * 1024 * 1024) {
        setError('One or more files exceed the 10MB limit.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        newItems.push({
          id: `${Date.now()}_${idx}`,
          src: reader.result as string,
          crop: { x: 0, y: 0 },
          zoom: 1,
          croppedAreaPixels: null,
        });

        loadedCount++;
        if (loadedCount === files.length) {
          setImages(newItems);
          setActiveImageIndex(0);
          setStep('crop');
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const onCropComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setImages((prev) =>
        prev.map((item, idx) =>
          idx === activeImageIndex ? { ...item, croppedAreaPixels } : item
        )
      );
    },
    [activeImageIndex]
  );

  const updateActiveCrop = (crop: { x: number; y: number }) => {
    setImages((prev) =>
      prev.map((item, idx) => (idx === activeImageIndex ? { ...item, crop } : item))
    );
  };

  const updateActiveZoom = (zoom: number) => {
    setImages((prev) =>
      prev.map((item, idx) => (idx === activeImageIndex ? { ...item, zoom } : item))
    );
  };

  const removeImage = (indexToRemove: number) => {
    const updated = images.filter((_, idx) => idx !== indexToRemove);
    if (updated.length === 0) {
      setImages([]);
      setStep('select');
    } else {
      setImages(updated);
      setActiveImageIndex(Math.min(activeImageIndex, updated.length - 1));
    }
  };

  const handlePublish = async () => {
    if (images.length === 0 || isPublishing) return;
    setIsPublishing(true);
    setError(null);

    try {
      // 1. Crop and Upload all images to Cloudinary concurrently
      const uploadedImages = await Promise.all(
        images.map(async (img, idx) => {
          const areaPixels =
            img.croppedAreaPixels || {
              x: 0,
              y: 0,
              width: 800,
              height: 800,
            };

          const croppedBlob = await getCroppedImgBlob(img.src, areaPixels, 800);
          const formData = new FormData();
          formData.append('file', croppedBlob, `post_${Date.now()}_${idx}.jpg`);
          formData.append('folder', 'lioransocial/posts');

          const uploadRes = await fetch('/api/media/upload', {
            method: 'POST',
            body: formData,
          });

          const uploadData = await uploadRes.json();
          if (!uploadRes.ok) {
            throw new Error(uploadData.error || 'Failed to upload photo');
          }

          return {
            url: uploadData.media.url,
            secureUrl: uploadData.media.secureUrl,
            publicId: uploadData.media.publicId,
            width: uploadData.media.width,
            height: uploadData.media.height,
          };
        })
      );

      // 2. Create Post record
      const postRes = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: uploadedImages,
          caption: caption.trim(),
        }),
      });

      const postData = await postRes.json();
      if (!postRes.ok) {
        throw new Error(postData.error || 'Failed to create post');
      }

      if (onPostCreated) {
        onPostCreated(postData.post);
      }

      handleReset();
      onClose();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'An error occurred during upload.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleReset = () => {
    setStep('select');
    setImages([]);
    setActiveImageIndex(0);
    setCaption('');
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
      <div className="bg-[#121215] border border-[#27272a] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* ================================================================= */}
        {/* Header */}
        {/* ================================================================= */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#27272a]">
          <div className="flex items-center gap-2">
            {step === 'crop' && (
              <button
                onClick={() => setStep('select')}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step === 'caption' && (
              <button
                onClick={() => setStep('crop')}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Crop
              </button>
            )}
            <h3 className="text-sm font-semibold text-white ml-1">
              {step === 'select' && 'Create new post'}
              {step === 'crop' && 'Crop & Adjust'}
              {step === 'caption' && 'Write Caption'}
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {step === 'crop' && (
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

        {/* ================================================================= */}
        {/* Body Content */}
        {/* ================================================================= */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

          {/* STEP 1: Select Photos */}
          {step === 'select' && (
            <div className="border-2 border-dashed border-[#27272a] hover:border-zinc-500 rounded-2xl p-12 text-center transition-colors">
              <input
                type="file"
                id="post-file-input"
                accept="image/png, image/jpeg, image/webp"
                multiple
                className="hidden"
                onChange={handleFilesSelected}
              />
              <label htmlFor="post-file-input" className="cursor-pointer flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-300 shadow-lg">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">Select photos from computer</p>
                  <p className="text-xs text-zinc-400 mt-1">Upload 1 to 10 images (PNG, JPG, WEBP up to 10MB each)</p>
                </div>
              </label>
            </div>
          )}

          {/* STEP 2: Crop & Adjust */}
          {step === 'crop' && activeImage && (
            <div className="space-y-4">
              {/* Cropper Container */}
              <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden border border-[#27272a]">
                <Cropper
                  image={activeImage.src}
                  crop={activeImage.crop}
                  zoom={activeImage.zoom}
                  aspect={1}
                  showGrid={false}
                  onCropChange={updateActiveCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={updateActiveZoom}
                />

                {/* Multiple Images Switcher */}
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveImageIndex((prev) =>
                          prev > 0 ? prev - 1 : images.length - 1
                        )
                      }
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveImageIndex((prev) =>
                          prev < images.length - 1 ? prev + 1 : 0
                        )
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <div className="absolute top-2 right-2 bg-black/60 px-2 py-0.5 rounded-full text-xs text-white">
                      {activeImageIndex + 1}/{images.length}
                    </div>
                  </>
                )}
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-3 px-2">
                <ZoomOut className="w-4 h-4 text-zinc-400" />
                <input
                  type="range"
                  value={activeImage.zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  onChange={(e) => updateActiveZoom(Number(e.target.value))}
                  className="w-full accent-white h-1 bg-zinc-700 rounded-lg cursor-pointer"
                />
                <ZoomIn className="w-4 h-4 text-zinc-400" />
              </div>

              {/* Thumbnail Strip for Multi-Images */}
              {images.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {images.map((img, idx) => (
                    <div
                      key={img.id}
                      className={`relative w-14 h-14 rounded-lg overflow-hidden shrink-0 cursor-pointer border-2 transition-all ${
                        idx === activeImageIndex ? 'border-white' : 'border-[#27272a] opacity-60'
                      }`}
                      onClick={() => setActiveImageIndex(idx)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.src} alt={`Thumbnail ${idx}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(idx);
                        }}
                        className="absolute top-0.5 right-0.5 p-0.5 bg-black/80 rounded text-rose-400 hover:text-rose-300"
                        title="Remove photo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Write Caption */}
          {step === 'caption' && (
            <div className="space-y-4">
              {/* Author Row */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-xs text-white">
                  {currentUser?.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    currentUser?.displayName?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <p className="text-xs font-semibold text-white">{currentUser?.displayName}</p>
              </div>

              {/* Caption Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <label htmlFor="post-caption-textarea">Write a caption</label>
                  <span className={caption.length > 450 ? 'text-amber-400' : 'text-zinc-500'}>
                    {caption.length} / 500
                  </span>
                </div>
                <textarea
                  id="post-caption-textarea"
                  rows={4}
                  maxLength={500}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Share your thoughts, stories, or tag friends with @username..."
                  disabled={isPublishing}
                  className="w-full rounded-xl bg-[#18181b] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 border border-[#27272a] focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 resize-none"
                />
              </div>

              {/* Photos Overview */}
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                {images.map((img, idx) => (
                  <div key={img.id} className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-[#27272a]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.src} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
