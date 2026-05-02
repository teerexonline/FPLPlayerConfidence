import type { MetadataRoute } from 'next';

// Theme colors resolved from globals.css:
//   Topbar uses bg-bg class → --bg token
//   Light mode:  --bg: #fafaf9
//   Dark mode:   --bg: #0a0a0a
// Manifest supports a single theme_color (no media queries); use light-mode
// value. Dark-mode override is handled via metadata.themeColor in layout.tsx.

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FPL Confidence',
    short_name: 'FPL Conf',
    description: "Don't pick by points. Pick by confidence.",
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fafaf9',
    theme_color: '#fafaf9',
    categories: ['sports', 'utilities'],
    icons: [
      {
        src: '/icon/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
