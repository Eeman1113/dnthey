import { asset } from '@/ui/basePath';

/**
 * A picture element with an AVIF source and a WebP fallback.
 *
 * Static export means no image optimizer, so the format negotiation Next
 * normally does at request time is done here instead, against files generated
 * by scripts/make-avif.py. Width and height are always set so the layout does
 * not shift while the image loads.
 */
export function Art({
  src, alt, width, height, className, sizes, priority = false, fetchPriority,
}: {
  /** Path under /public WITHOUT the extension, e.g. "/assets/classart/rogue" */
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
  fetchPriority?: 'high' | 'low' | 'auto';
}) {
  return (
    <picture>
      <source srcSet={asset(`${src}.avif`)} type="image/avif" sizes={sizes} />
      <img
        src={asset(`${src}.webp`)}
        alt={alt}
        width={width}
        height={height}
        className={className}
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={fetchPriority ?? (priority ? 'high' : 'auto')}
      />
    </picture>
  );
}
