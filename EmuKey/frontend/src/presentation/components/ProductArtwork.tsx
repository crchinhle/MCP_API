import type { ProductTone } from '../../domain/product';
import cloudStudioArtworkUrl from '../../assets/figma/cloudstudio-artwork.svg';
import dataGuardArtworkUrl from '../../assets/figma/dataguard-artwork.svg';
import secureDeskArtworkUrl from '../../assets/figma/securedesk-artwork.svg';

interface ProductArtworkProps {
  readonly imageUrl?: string | null;
  readonly tone: ProductTone;
  readonly productName: string;
  readonly large?: boolean;
}

export function ProductArtwork({
  imageUrl,
  tone,
  productName,
  large = false,
}: ProductArtworkProps) {
  const figmaArtworkByTone = {
    brand: secureDeskArtworkUrl,
    module: cloudStudioArtworkUrl,
    neutral: dataGuardArtworkUrl,
  } as const;
  const className = [
    'product-artwork',
    'product-artwork--' + tone,
    large ? 'product-artwork--large' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (imageUrl) {
    return (
      <img
        alt={'Minh họa ' + productName}
        className={className}
        loading="lazy"
        src={imageUrl}
      />
    );
  }

  return (
    <div aria-label={'Minh họa ' + productName} className={className} role="img">
      <img alt="" className="product-artwork-image" src={figmaArtworkByTone[tone]} />
    </div>
  );

}
