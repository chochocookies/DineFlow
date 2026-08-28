// source.unsplash.com (the obvious choice for "just grab a themed photo")
// was fully sunset in mid-2024 — hotlinking it now serves nothing but a
// broken-image icon. placehold.co is a purpose-built, stable placeholder
// service (no API key, no rate limit for this volume) so a menu item never
// renders broken, only "not photographed yet".
//
// Colors cycle through the same primary/secondary/success tint pairs
// already used for badges elsewhere (see app/globals.css), keyed by
// category so every item in, say, "Minuman" reads as one visual group at a
// glance — an incidental but nice side effect of a real photo still always
// winning once one is set.
const PALETTE = [
  { bg: "f6e3da", fg: "c8401e" }, // primary (sambal red)
  { bg: "f9ecd4", fg: "dfa23b" }, // secondary (turmeric gold)
  { bg: "e2f0e0", fg: "3d9142" }, // success (banana-leaf green)
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function menuImageUrl(menu: { name: string; category: string; image_url?: string }): string {
  if (menu.image_url) return menu.image_url;
  const { bg, fg } = PALETTE[hashString(menu.category) % PALETTE.length];
  return `https://placehold.co/300x300/${bg}/${fg}?font=poppins&text=${encodeURIComponent(menu.name)}`;
}
