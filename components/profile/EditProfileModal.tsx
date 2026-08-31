'use client';

import React, { useState } from 'react';
import { X, Camera, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { AvatarCropperModal } from './AvatarCropperModal';
import { useAuth } from '@/context/AuthContext';
import { SafeUser } from '@/types/user';

export interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (user: SafeUser) => void;
}

export function EditProfileModal({ isOpen, onClose, onProfileUpdated }: EditProfileModalProps) {
  const { user, refreshUser } = useAuth();

  const [formData, setFormData] = useState({
    displayName: user?.displayName || '',
    username: user?.username || '',
    bio: user?.bio || '',
    avatar: user?.avatar || '',
  });

  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const handleAvatarUploaded = (newAvatarUrl: string) => {
    setFormData((prev) => ({ ...prev, avatar: newAvatarUrl }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update profile.');
        setIsSubmitting(false);
        return;
      }

      await refreshUser();
      if (onProfileUpdated) {
        onProfileUpdated(data.user);
      }
      onClose();
    } catch {
      setError('A network error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-[#121215] border border-[#27272a] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#27272a]">
            <h3 className="text-base font-semibold text-white">Edit Profile</h3>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="text-zinc-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

            {/* Avatar Section */}
            <div className="flex items-center gap-5 p-4 bg-[#18181b] border border-[#27272a] rounded-xl">
              <div className="relative group">
                <div className="w-16 h-16 rounded-full bg-zinc-800 border-2 border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-white text-xl">
                  {formData.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={formData.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    formData.displayName?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsCropperOpen(true)}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 rounded-full flex items-center justify-center text-white transition-opacity"
                  title="Change avatar"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>

              <div>
                <p className="text-sm font-semibold text-white">{formData.displayName || user.displayName}</p>
                <button
                  type="button"
                  onClick={() => setIsCropperOpen(true)}
                  className="text-xs text-sky-400 hover:text-sky-300 font-medium mt-0.5 inline-block"
                >
                  Change profile photo
                </button>
              </div>
            </div>

            {/* Display Name */}
            <Input
              label="Display Name"
              value={formData.displayName}
              onChange={(e) => setFormData((prev) => ({ ...prev, displayName: e.target.value }))}
              placeholder="Your name"
              required
              disabled={isSubmitting}
            />

            {/* Username */}
            <Input
              label="Username"
              value={formData.username}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  username: e.target.value.toLowerCase().replace(/\s+/g, ''),
                }))
              }
              placeholder="username"
              required
              disabled={isSubmitting}
            />

            {/* Bio */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-300">
                <label htmlFor="bio-textarea">Bio</label>
                <span className={`text-[11px] ${formData.bio.length > 140 ? 'text-amber-400' : 'text-zinc-500'}`}>
                  {formData.bio.length} / 150
                </span>
              </div>
              <textarea
                id="bio-textarea"
                rows={3}
                maxLength={150}
                value={formData.bio}
                onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
                placeholder="Write a brief bio about yourself..."
                disabled={isSubmitting}
                className="w-full rounded-xl bg-[#121215] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 border border-[#27272a] focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 resize-none transition-all"
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                rightIcon={<Check className="w-4 h-4" />}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Embedded Avatar Cropper Modal */}
      <AvatarCropperModal
        isOpen={isCropperOpen}
        onClose={() => setIsCropperOpen(false)}
        onAvatarUploaded={handleAvatarUploaded}
      />
    </>
  );
}

