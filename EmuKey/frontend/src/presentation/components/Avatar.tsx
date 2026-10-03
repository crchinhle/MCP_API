export function computeInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';

  const firstWord = words[0];
  if (words.length === 1) return firstWord ? firstWord[0]!.toUpperCase() : '?';

  const lastWord = words[words.length - 1];
  return `${firstWord?.[0] ?? ''}${lastWord?.[0] ?? ''}`.toUpperCase();
}

/**
 * User account avatar: dynamic initials rendered with the system sans-serif
 * font (IBM Plex Sans). Never uses script/calligraphy typography.
 */
export function UserAvatar({ name }: { readonly name: string }) {
  const initials = computeInitials(name);

  return (
    <span aria-label={name} className="user-avatar" role="img">
      <span className="sr-only">{name}</span>
      <span aria-hidden="true" className="user-avatar-initials">
        {initials}
      </span>
    </span>
  );
}
