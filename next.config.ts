import type { NextConfig } from 'next';

// In development, '.dev.tsx' / '.dev.ts' are registered as valid page
// extensions. Files named page.dev.tsx are therefore picked up by the App
// Router and create routes as normal. In production the extension is not
// registered, so those files are invisible to the router — the /dev/* routes
// are completely absent from the production build manifest.
const isDevelopment = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  pageExtensions: [...(isDevelopment ? ['dev.tsx', 'dev.ts'] : []), 'tsx', 'ts', 'jsx', 'js'],
};

export default nextConfig;
