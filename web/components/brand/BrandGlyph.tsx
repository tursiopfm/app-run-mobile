// web/components/brand/BrandGlyph.tsx
// Aperçu du glyphe de marque rendu via le MÊME builder que les PNG exportés.
// (Le LogoMark live, LogoTrailCockpit.tsx, reste inchangé.)
import { renderLogoMarkSvg, type RenderOpts } from '@/lib/brand/logo-svg'

export function BrandGlyph({ className, ...opts }: RenderOpts & { className?: string }) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: renderLogoMarkSvg(opts) }}
    />
  )
}
