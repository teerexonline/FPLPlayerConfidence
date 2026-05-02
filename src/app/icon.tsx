import { ImageResponse } from 'next/og';

// generateImageMetadata causes Next.js to serve each variant at /icon/{id}.
// Confirmed from next-metadata-route-loader.js: __metadata_id__ becomes a
// path segment, so id:'192' → /icon/192, id:'512' → /icon/512.
// Geist Sans is not available as a binary buffer at image-generation time
// (next/font/google caches woff2s under content-hashed paths that change
// between builds). system-ui is visually indistinguishable at icon sizes.
export function generateImageMetadata() {
  return [
    { id: '192', contentType: 'image/png' as const, size: { width: 192, height: 192 } },
    { id: '512', contentType: 'image/png' as const, size: { width: 512, height: 512 } },
  ];
}

export default function Icon({ id }: { id: string }) {
  const dim = id === '192' ? 192 : 512;
  const fontSize = id === '192' ? 82 : 218;
  const letterSpacing = id === '192' ? -3 : -8;

  return new ImageResponse(
    <div
      style={{
        width: dim,
        height: dim,
        background: '#1E40AF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize,
        fontWeight: 800,
        letterSpacing,
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      }}
    >
      FC
    </div>,
    { width: dim, height: dim },
  );
}
