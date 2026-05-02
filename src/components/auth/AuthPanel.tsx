'use client';

import { useCallback, useEffect, useState } from 'react';
import type { JSX } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { createUserProfileAction } from '@/app/actions/createUserProfile';
import { useAuth } from './AuthContext';

type Tab = 'signin' | 'create';
type PanelState = 'form' | 'check_email';

function InputField({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  disabled,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  disabled?: boolean;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-muted font-sans text-[12px] font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        autoComplete={autoComplete}
        disabled={disabled}
        className="border-border bg-bg text-text placeholder:text-muted/50 focus:border-accent h-9 w-full rounded-[6px] border px-3 font-sans text-[13px] transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }): JSX.Element {
  return (
    <div className="border-border flex border-b">
      {(['signin', 'create'] as const).map((tab) => {
        const label = tab === 'signin' ? 'Sign in' : 'Create account';
        const isActive = active === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => {
              onChange(tab);
            }}
            className={[
              'relative px-4 pt-4 pb-3 font-sans text-[13px] font-medium transition-colors',
              isActive ? 'text-text' : 'text-muted hover:text-text',
            ].join(' ')}
          >
            {label}
            {isActive && (
              <motion.div
                layoutId="tab-indicator"
                className="bg-accent absolute right-0 bottom-0 left-0 h-[2px] rounded-full"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function CheckEmailState({ email, onBack }: { email: string; onBack: () => void }): JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="border-border bg-surface flex h-12 w-12 items-center justify-center rounded-full border text-2xl">
        ✉️
      </div>
      <div className="space-y-1">
        <p className="text-text font-sans text-[15px] font-semibold">Check your email</p>
        <p className="text-muted max-w-[260px] font-sans text-[13px] leading-relaxed">
          We sent a confirmation link to <span className="text-text font-medium">{email}</span>.
          Click it to activate your account.
        </p>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="text-muted hover:text-text font-sans text-[12px] transition-colors"
      >
        Use a different email
      </button>
    </div>
  );
}

export function AuthPanel(): JSX.Element {
  const { isPanelOpen, closePanel } = useAuth();
  const [tab, setTab] = useState<Tab>('signin');
  const [panelState, setPanelState] = useState<PanelState>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // handleClose resets form state before delegating to context.
  const handleClose = useCallback(() => {
    setTab('signin');
    setPanelState('form');
    setEmail('');
    setPassword('');
    setError(null);
    closePanel();
  }, [closePanel]);

  const handleTabChange = useCallback((t: Tab) => {
    setTab(t);
    setError(null);
  }, []);

  // Trap focus: close on Escape.
  useEffect(() => {
    if (!isPanelOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [isPanelOpen, handleClose]);

  const handleSubmit = useCallback(async () => {
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const supabase = getSupabaseBrowserClient();

    try {
      if (tab === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(signInError.message);
          return;
        }
        handleClose();
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        if (data.user) {
          // Create profile row via service-role server action. Fire-and-forget:
          // if this fails the user can still use the app; profile is lazy-created.
          void createUserProfileAction(data.user.id);
        }
        setPanelState('check_email');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, tab, handleClose]);

  const buttonLabel = isSubmitting
    ? tab === 'signin'
      ? 'Signing in…'
      : 'Creating account…'
    : tab === 'signin'
      ? 'Sign in'
      : 'Create account';

  return (
    <AnimatePresence>
      {isPanelOpen && (
        <>
          {/* Scrim */}
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/40"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.aside
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.8 }}
            className="border-border bg-surface fixed top-0 right-0 z-50 flex h-full w-full max-w-[380px] flex-col shadow-2xl"
            role="dialog"
            aria-label={tab === 'signin' ? 'Sign in' : 'Create account'}
            aria-modal="true"
          >
            {/* Header */}
            <div className="border-border flex items-center justify-between border-b px-5 py-4">
              <span className="font-display text-[15px] font-semibold text-[#1e40af] dark:text-[#60a5fa]">
                FPL Confidence
              </span>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="text-muted hover:text-text focus-visible:ring-accent rounded-[4px] p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <X width={16} height={16} aria-hidden="true" />
              </button>
            </div>

            {panelState === 'check_email' ? (
              <CheckEmailState
                email={email}
                onBack={() => {
                  setPanelState('form');
                  setEmail('');
                  setPassword('');
                }}
              />
            ) : (
              <>
                <TabBar active={tab} onChange={handleTabChange} />

                <form
                  className="flex flex-1 flex-col gap-5 px-5 pt-6 pb-8"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSubmit();
                  }}
                >
                  <InputField
                    id="auth-email"
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    autoComplete="email"
                    disabled={isSubmitting}
                  />
                  <InputField
                    id="auth-password"
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                    disabled={isSubmitting}
                  />

                  {/* Inline error */}
                  {error !== null && (
                    <p role="alert" className="text-negative font-sans text-[13px]">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-accent mt-auto h-9 w-full cursor-pointer rounded-[6px] font-sans text-[13px] font-medium text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {buttonLabel}
                  </button>
                </form>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
