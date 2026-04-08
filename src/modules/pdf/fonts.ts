import { Font } from '@react-pdf/renderer';
import { join } from 'node:path';

const FONTS_DIR = join(import.meta.dirname, 'fonts');

let registered = false;

/**
 * Register Noto Sans font family for PDF generation.
 * Covers Latin, Greek, and Cyrillic scripts (21 of 24 EU languages).
 * Safe to call multiple times — registers only once.
 */
export function registerFonts(): void {
  if (registered) return;

  Font.register({
    family: 'NotoSans',
    fonts: [
      { src: join(FONTS_DIR, 'NotoSans-Regular.ttf'), fontWeight: 400 },
      { src: join(FONTS_DIR, 'NotoSans-Bold.ttf'), fontWeight: 700 },
    ],
  });

  Font.register({
    family: 'NotoSerif',
    fonts: [
      { src: join(FONTS_DIR, 'NotoSerif-Regular.ttf'), fontWeight: 400 },
      { src: join(FONTS_DIR, 'NotoSerif-Bold.ttf'), fontWeight: 700 },
    ],
  });

  registered = true;
}
