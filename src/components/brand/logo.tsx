'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';

type Props = {
  className?: string;
  width?: number;
  height?: number;
};

export function Logo({ className, width = 120, height = 32 }: Props) {
  const t = useTranslations('ui');
  const alt = t('brand.logoAlt');

  return (
    <>
      <Image
        src="/brand/quaynt-logo-dark.png"
        alt={alt}
        width={width}
        height={height}
        priority
        className={`${className ?? ''} dark:hidden`.trim()}
      />
      <Image
        src="/brand/quaynt-logo-light.png"
        alt=""
        aria-hidden="true"
        width={width}
        height={height}
        className={`${className ?? ''} hidden dark:block`.trim()}
      />
    </>
  );
}
