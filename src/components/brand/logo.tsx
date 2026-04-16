'use client';

import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';

type Props = {
  className?: string;
  width?: number;
  height?: number;
};

export function Logo({ className, width = 120, height = 32 }: Props) {
  const t = useTranslations('ui');
  const { resolvedTheme } = useTheme();
  const alt = t('brand.logoAlt');

  // Dark logo (dark text) for light backgrounds, light logo (light text) for dark backgrounds
  const src =
    resolvedTheme === 'dark' ? '/brand/quaynt-logo-light.png' : '/brand/quaynt-logo-dark.png';

  return <Image src={src} alt={alt} width={width} height={height} priority className={className} />;
}
