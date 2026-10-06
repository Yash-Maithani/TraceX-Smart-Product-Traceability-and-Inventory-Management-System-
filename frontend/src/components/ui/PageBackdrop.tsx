import { useState, type ReactNode } from 'react';
import styles from './ui.module.css';
import { BACKDROP_ASSETS } from '../../assets/backdrops';
import type { BackdropKey, BackdropVariant } from '../../routes/backdrops';
import { useTheme } from '../../hooks/useTheme';
import { isSaveDataActive } from '../../lib/prefs';

export interface PageBackdropProps {
  backdropKey: BackdropKey;
  variant?: BackdropVariant | undefined;
  priority?: boolean | undefined;
  children?: ReactNode;
  className?: string | undefined;
  testId?: string | undefined;
}

export function PageBackdrop({
  backdropKey,
  variant = 'banner',
  priority,
  children,
  className = '',
  testId
}: PageBackdropProps) {
  const { prefs } = useTheme();
  const [failedKey, setFailedKey] = useState<string | null>(null);

  const saveData = isSaveDataActive();
  const hasError = failedKey === backdropKey;
  const shouldRenderImage = prefs.showPageImages && !saveData && !hasError;

  const asset = BACKDROP_ASSETS[backdropKey] ?? BACKDROP_ASSETS.default;
  const isHighPriority = priority ?? (variant === 'banner' || variant === 'side');
  const sizes = variant === 'side' ? '(min-width: 1024px) 55vw, 100vw' : '100vw';

  const resolvedTestId = testId ?? `page-backdrop-${variant}-${backdropKey}`;

  const renderMedia = () => (
    <>
      {shouldRenderImage && asset ? (
        <picture
          className={styles.backdropPicture}
          {...({ 'aria-hidden': 'true' } as Record<string, string>)}
          data-testid={`backdrop-picture-${backdropKey}`}
        >
          <source
            type="image/avif"
            srcSet={`${asset.avif[640]} 640w, ${asset.avif[1280]} 1280w, ${asset.avif[1920]} 1920w`}
            sizes={sizes}
          />
          <source
            type="image/webp"
            srcSet={`${asset.webp[640]} 640w, ${asset.webp[1280]} 1280w, ${asset.webp[1920]} 1920w`}
            sizes={sizes}
          />
          <img
            className={styles.backdropImg}
            src={asset.jpg[1280]}
            srcSet={`${asset.jpg[640]} 640w, ${asset.jpg[1280]} 1280w, ${asset.jpg[1920]} 1920w`}
            sizes={sizes}
            alt=""
            aria-hidden="true"
            decoding="async"
            {...({ fetchpriority: isHighPriority ? 'high' : 'low' } as Record<string, string>)}
            width={1920}
            height={1080}
            data-object-position={asset.objectPosition}
            data-backdrop-key={backdropKey}
            onError={() => setFailedKey(backdropKey)}
          />
        </picture>
      ) : null}
      <div className={styles.backdropScrim} aria-hidden="true" />
    </>
  );

  if (variant === 'side') {
    return (
      <div
        className={`${styles.backdropSide} ${className}`.trim()}
        data-testid={resolvedTestId}
        data-backdrop-key={backdropKey}
        data-backdrop-variant="side"
        data-images-active={shouldRenderImage ? 'true' : 'false'}
      >
        <div
          className={styles.backdropSideMedia}
          aria-hidden="true"
          data-testid={`backdrop-side-media-${backdropKey}`}
        >
          {renderMedia()}
        </div>
        <div className={styles.backdropSidePanel}>{children}</div>
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div
        className={`${styles.backdropFull} ${className}`.trim()}
        data-testid={resolvedTestId}
        data-backdrop-key={backdropKey}
        data-backdrop-variant="full"
        data-images-active={shouldRenderImage ? 'true' : 'false'}
      >
        <div
          className={styles.backdropMediaLayer}
          aria-hidden="true"
          data-testid={`backdrop-full-media-${backdropKey}`}
        >
          {renderMedia()}
        </div>
        <div className={styles.backdropFullPanel}>{children}</div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.backdropBanner} ${className}`.trim()}
      data-testid={resolvedTestId}
      data-backdrop-key={backdropKey}
      data-backdrop-variant="banner"
      data-images-active={shouldRenderImage ? 'true' : 'false'}
    >
      <div
        className={styles.backdropMediaLayer}
        aria-hidden="true"
        data-testid={`backdrop-banner-media-${backdropKey}`}
      >
        {renderMedia()}
      </div>
      <div className={styles.backdropBannerInner}>{children}</div>
    </div>
  );
}
