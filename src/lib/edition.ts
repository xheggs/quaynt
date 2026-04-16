/**
 * Edition gate utility.
 *
 * Reads the Quaynt edition from the NEXT_PUBLIC_QUAYNT_EDITION environment
 * variable. Components use `isCommercial()` to conditionally render features
 * that require a paid edition.
 */

export type QuayntEdition = 'community' | 'team' | 'enterprise';

export function getEdition(): QuayntEdition {
  const raw = process.env.NEXT_PUBLIC_QUAYNT_EDITION;
  if (raw === 'team' || raw === 'enterprise') return raw;
  return 'community';
}

export function isCommercial(): boolean {
  return getEdition() !== 'community';
}
