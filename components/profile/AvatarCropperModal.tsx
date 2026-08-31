'use client';

import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Upload, ZoomIn, ZoomOut, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { getCroppedImgBlob, Area } from '@/lib/crop-image';

export interface AvatarCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAvatarUploaded: (url: string) => void;
}

export function AvatarCropperModal({ isOpen, onClose, onAvatarUploaded }: AvatarCropperModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB.');
        return;
      }
      setError(null);
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result as string);
      });
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    try {
      setIsUploading(true);
      setError(null);

      // Crop image to Blob
      const croppedBlob = await getCroppedImgBlob(imageSrc, croppedAreaPixels, 400);

      // Prepare FormData
      const formData = new FormData();
      formData.append('file', croppedBlob, 'avatar.jpg');
      formData.append('folder', 'lioransocial/avatars');

      // Upload to server API
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to upload avatar.');
        setIsUploading(false);
        return;
      }

      onAvatarUploaded(data.media.url);
      handleClose();
    } catch {
      setError('An unexpected error occurred while processing your image.');
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setError(null);
    setIsUploading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121215] border border-[#27272a] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272a]">
          <h3 className="text-base font-semibold text-white">Update Profile Picture</h3>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="text-zinc-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

          {!imageSrc ? (
            <div className="border-2 border-dashed border-[#27272a] hover:border-zinc-500 rounded-xl p-8 text-center transition-colors">
              <input
                type="file"
                id="avatar-upload-input"
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <label
                htmlFor="avatar-upload-input"
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Click to select photo</p>
                  <p className="text-xs text-zinc-400 mt-1">PNG, JPG, or WEBP up to 5MB</p>
                </div>
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Cropper Container */}
              <div className="relative w-full h-64 bg-black rounded-xl overflow-hidden border border-[#27272a]">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-3 px-2">
                <ZoomOut className="w-4 h-4 text-zinc-400 shrink-0" />
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-white h-1 bg-zinc-700 rounded-lg cursor-pointer"
                />
                <ZoomIn className="w-4 h-4 text-zinc-400 shrink-0" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-[#27272a] bg-[#0d0d10]">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          {imageSrc && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleUpload}
              isLoading={isUploading}
              leftIcon={isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            >
              Apply Photo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

