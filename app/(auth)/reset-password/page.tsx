'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, KeyRound, ArrowRight, Check, X, ArrowLeft } from 'lucide-react';
import { AuthCard } from '@/components/auth/AuthCard';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const emailParam = searchParams.get('email') || '';
  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Password criteria check
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^a-zA-Z0-9]/.test(newPassword);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (otp.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    if (!isPasswordValid) {
      setError('Please ensure your new password meets all security requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          otp,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to reset password. Please check your code and try again.');
        setIsLoading(false);
        return;
      }

      setSuccessMsg('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch {
      setError('A network error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <AuthCard
      title="Create new password"
      subtitle="Enter the code sent to your email and your new password"
      footer={
        <Link
          href="/login"
          className="font-semibold text-zinc-400 hover:text-white inline-flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
        {successMsg && <Alert type="success" message={successMsg} />}

        {!emailParam && (
          <Input
            label="Account Email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
            disabled={isLoading}
          />
        )}

        <Input
          label="6-Digit Reset Code"
          type="text"
          maxLength={6}
          placeholder="123456"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          leftIcon={<KeyRound className="w-4 h-4" />}
          required
          disabled={isLoading}
        />

        <Input
          label="New Password"
          type="password"
          placeholder="••••••••"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          leftIcon={<Lock className="w-4 h-4" />}
          isPassword
          autoComplete="new-password"
          required
          disabled={isLoading}
        />

        {newPassword.length > 0 && (
          <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl space-y-1 text-xs">
            <p className="font-medium text-zinc-300 mb-1.5">Password requirements:</p>
            <div className="grid grid-cols-2 gap-1 text-[11px]">
              <span className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {hasMinLength ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} 8+ chars
              </span>
              <span className={`flex items-center gap-1.5 ${hasUppercase ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {hasUppercase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Uppercase
              </span>
              <span className={`flex items-center gap-1.5 ${hasLowercase ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {hasLowercase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Lowercase
              </span>
              <span className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {hasNumber ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Number
              </span>
              <span className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {hasSpecial ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Special
              </span>
            </div>
          </div>
        )}

        <Input
          label="Confirm New Password"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          leftIcon={<Lock className="w-4 h-4" />}
          isPassword
          autoComplete="new-password"
          required
          disabled={isLoading}
        />

        <Button
          type="submit"
          variant="primary"
          size="md"
          className="w-full mt-2"
          isLoading={isLoading}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          Reset Password
        </Button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[#09090b]">
      <Suspense fallback={<div className="text-zinc-500 text-sm">Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}

