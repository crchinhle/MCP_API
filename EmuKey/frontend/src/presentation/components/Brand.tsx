import { Link } from 'react-router-dom';

interface BrandProps {
  readonly inverted?: boolean;
}

/**
 * Brand logo. The logo is ONLY the word "EmuKey" rendered in the Great Vibes
 * script font — no icon, no colored box, no separate "E" monogram.
 * Clicking the whole wordmark navigates to the public home at "/".
 */
export function Brand({ inverted = false }: BrandProps) {
  return (
    <Link
      aria-label="Về trang chủ EmuKey"
      className={`brand-wordmark brand-wordmark--header${inverted ? ' brand-wordmark--inverted' : ''}`}
      to="/"
    >
      EmuKey
    </Link>
  );
}
