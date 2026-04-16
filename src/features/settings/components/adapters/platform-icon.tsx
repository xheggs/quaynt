import Image from 'next/image';

const ICONS: Record<string, string> = {
  chatgpt: '/brand/adapters/chatgpt.png',
  claude: '/brand/adapters/claude.png',
  deepseek: '/brand/adapters/deepseek.png',
  gemini: '/brand/adapters/gemini.png',
  grok: '/brand/adapters/grok.png',
  perplexity: '/brand/adapters/perplexity.png',
};

type Props = {
  platform: string;
  size?: number;
  className?: string;
};

export function PlatformIcon({ platform, size = 20, className }: Props) {
  const src = ICONS[platform.toLowerCase()];
  if (!src) return null;
  return (
    <Image
      src={src}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={`inline-block rounded-sm${className ? ` ${className}` : ''}`}
    />
  );
}
