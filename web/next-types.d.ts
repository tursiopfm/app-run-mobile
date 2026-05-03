// Workaround: Next.js 14.2.29 generates .next/types files that import from
// metadata-interface.js, but that file has no .d.ts companion. Declare it
// explicitly so the build type-check passes.
declare module 'next/dist/lib/metadata/types/metadata-interface.js' {
  export type {
    Metadata,
    ResolvedMetadata,
    ResolvingMetadata,
    Viewport,
    ResolvedViewport,
    ResolvingViewport,
  } from 'next/dist/lib/metadata/resolve-metadata'
}
