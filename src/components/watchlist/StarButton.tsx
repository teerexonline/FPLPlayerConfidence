'use client';

import type { JSX } from 'react';
import { Star } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/AuthContext';
import { useWatchlist } from './WatchlistContext';

export interface StarButtonProps {
  readonly playerId: number;
  readonly playerName: string;
  /** 'sm' — 14px, for list rows. 'lg' — 20px, for player detail hero. */
  readonly size?: 'sm' | 'lg';
  readonly className?: string;
}

/**
 * Watchlist toggle button. Reads and writes via WatchlistContext.
 *
 * Anonymous users: clicking opens the auth panel instead of toggling.
 * Authenticated users: toggles the watchlist and springs the icon.
 *
 * Must be inside WatchlistProvider and AuthProvider.
 */
export function StarButton({
  playerId,
  playerName,
  size = 'sm',
  className,
}: StarButtonProps): JSX.Element {
  const { ids, toggle } = useWatchlist();
  const { isAuthenticated, openPanel } = useAuth();
  const isWatchlisted = ids.has(playerId);

  const iconSize = size === 'lg' ? 20 : 14;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isAuthenticated) {
      openPanel();
    } else {
      toggle(playerId);
    }
  };

  return (
    <motion.button
      type="button"
      aria-label={
        !isAuthenticated
          ? 'Sign in to add to watchlist'
          : isWatchlisted
            ? `Remove ${playerName} from watchlist`
            : `Add ${playerName} to watchlist`
      }
      aria-pressed={isAuthenticated ? isWatchlisted : undefined}
      whileTap={{ scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 500, damping: 20, mass: 0.6 }}
      onClick={handleClick}
      className={cn(
        'focus-visible:ring-accent/60 shrink-0 cursor-pointer rounded-sm focus-visible:ring-2 focus-visible:outline-none',
        size === 'lg' ? 'p-1' : 'p-0.5',
        className,
      )}
    >
      {/* Key-driven spring: each state change mounts a fresh motion.span that
          springs from a compressed scale, giving a crisp "snap" without a
          separate keyframe animation. */}
      <motion.span
        key={isWatchlisted ? 'filled' : 'empty'}
        initial={{ scale: isWatchlisted ? 0.6 : 1 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 600, damping: 18, mass: 0.5 }}
        className="inline-flex"
      >
        <Star
          aria-hidden="true"
          width={iconSize}
          height={iconSize}
          className={cn(
            'transition-colors duration-150',
            isWatchlisted
              ? 'fill-accent text-accent'
              : size === 'lg'
                ? 'text-muted/60 hover:text-accent/70 fill-none'
                : 'text-muted/40 hover:text-accent/60 fill-none',
          )}
        />
      </motion.span>
    </motion.button>
  );
}
