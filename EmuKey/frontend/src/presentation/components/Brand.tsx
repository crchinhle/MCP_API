import { Link } from 'react-router-dom';

interface BrandProps {
  readonly inverted?: boolean;
}

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
