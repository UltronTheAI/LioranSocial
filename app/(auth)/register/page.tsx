'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Mail, Lock, UserCheck, ArrowRight, Check, X } from 'lucide-react';
import { AuthCard } from '@/components/auth/AuthCard';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    email: '',
    password: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Password requirement checks
  const hasMinLength = formData.password.length >= 8;
  const hasUppercase = /[A-Z]/.test(formData.password);
  const hasLowercase = /[a-z]/.test(formData.password);
  const hasNumber = /[0-9]/.test(formData.password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(formData.password);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPasswordValid) {
      setError('Please ensure your password meets all the listed requirements.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create account. Please check your details.');
        setIsLoading(false);
        return;
      }

      // Redirect to verification screen with email pre-filled
      router.push(`/verify?email=${encodeURIComponent(formData.email)}`);
    } catch {
      setError('A network error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[#09090b]">
      <AuthCard
        title="Create an account"
        subtitle="Join LioranSocial and connect with your world"
        footer={
          <p>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-white hover:underline">
              Log in
            </Link>
          </p>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

          <Input
            label="Username"
            placeholder="johndoe"
            value={formData.username}
            onChange={(e) => handleChange('username', e.target.value.toLowerCase().replace(/\s+/g, ''))}
            leftIcon={<User className="w-4 h-4" />}
            autoComplete="username"
            required
            disabled={isLoading}
          />

          <Input
            label="Display Name"
            placeholder="John Doe"
            value={formData.displayName}
            onChange={(e) => handleChange('displayName', e.target.value)}
            leftIcon={<UserCheck className="w-4 h-4" />}
            required
            disabled={isLoading}
          />

          <Input
            label="Email"
            type="email"
            placeholder="john@example.com"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            autoComplete="email"
            required
            disabled={isLoading}
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            isPassword
            autoComplete="new-password"
            required
            disabled={isLoading}
          />

          {/* Password Requirements Checklist */}
          {formData.password.length > 0 && (
            <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl space-y-1 text-xs">
              <p className="font-medium text-zinc-300 mb-1.5">Password requirements:</p>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                <span className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {hasMinLength ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} 8+ characters
                </span>
                <span className={`flex items-center gap-1.5 ${hasUppercase ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {hasUppercase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} 1 uppercase
                </span>
                <span className={`flex items-center gap-1.5 ${hasLowercase ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {hasLowercase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} 1 lowercase
                </span>
                <span className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {hasNumber ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} 1 number
                </span>
                <span className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {hasSpecial ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} 1 special char
                </span>
              </div>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full mt-3"
            isLoading={isLoading}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Create Account
          </Button>
        </form>
      </AuthCard>
    </main>
  );
}

