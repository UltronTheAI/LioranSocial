'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, RotateCw, Mail } from 'lucide-react';
import { AuthCard } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';

function VerifyForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshUser } = useAuth();

  const emailParam = searchParams.get('email') || '';
  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleOtpChange = (index: number, value: string) => {
    // Only accept numeric inputs
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];

    // Handle paste event of 6 digits
    if (value.length > 1) {
      const pastedDigits = value.replace(/\D/g, '').slice(0, 6).split('');
      pastedDigits.forEach((digit, idx) => {
        newOtp[idx] = digit;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(pastedDigits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const fullOtp = otp.join('');

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    if (fullOtp.length !== 6) {
      setError('Please enter all 6 digits of the verification code.');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          otp: fullOtp,
          type: 'EMAIL_VERIFICATION',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification failed. Please try again.');
        setIsLoading(false);
        return;
      }

      setSuccessMsg('Account verified successfully! Redirecting...');
      await refreshUser();
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch {
      setError('A network error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    if (!email) {
      setError('Please provide your email to resend the code.');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setIsResending(true);

    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          type: 'EMAIL_VERIFICATION',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to resend code.');
        setIsResending(false);
        return;
      }

      setSuccessMsg('A fresh verification code has been sent to your email.');
      setResendCooldown(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch {
      setError('Failed to request new code. Please check your connection.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthCard
      title="Verify your email"
      subtitle={`We sent a 6-digit code to ${email || 'your email address'}`}
      footer={
        <p>
          Back to{' '}
          <Link href="/login" className="font-semibold text-white hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleVerify} className="space-y-5">
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
        {successMsg && <Alert type="success" message={successMsg} />}

        {!emailParam && (
          <Input
            label="Email address"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
            disabled={isLoading}
          />
        )}

        {/* 6-Digit OTP inputs */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-zinc-300 text-center">
            Enter 6-digit verification code
          </label>
          <div className="flex justify-center gap-2 sm:gap-2.5">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={isLoading}
                className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-mono font-bold bg-[#18181b] border border-[#27272a] rounded-xl text-white focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all disabled:opacity-50"
              />
            ))}
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          className="w-full"
          isLoading={isLoading}
          disabled={fullOtp.length !== 6 || isLoading}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          Verify & Continue
        </Button>

        {/* Resend Code Section */}
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || isResending || isLoading}
            className="text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:hover:text-zinc-400 transition-colors inline-flex items-center gap-1.5"
          >
            <RotateCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
            {resendCooldown > 0
              ? `Resend code in ${resendCooldown}s`
              : 'Didn\'t receive a code? Resend'}
          </button>
        </div>
      </form>
    </AuthCard>
  );
}

export default function VerifyPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[#09090b]">
      <Suspense fallback={<div className="text-zinc-500 text-sm">Loading...</div>}>
        <VerifyForm />
      </Suspense>
    </main>
  );
}
