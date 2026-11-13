// Google Maps links for addresses — built with Google's official "Maps URLs"
// format (https://developers.google.com/maps/documentation/urls), which needs
// no API key and opens the Maps app on phones.

const MAPS_SEARCH = 'https://www.google.com/maps/search/?api=1&query=';

/** A Google Maps link that searches for the address, or '' for a blank address. */
export function mapsLinkFor(address: string): string {
  const clean = address.trim().replace(/\s+/g, ' ');
  return clean ? `${MAPS_SEARCH}${encodeURIComponent(clean)}` : '';
}

/** The item with a Maps link made from its address (always rebuilt, so it follows address edits). */
export function withMapsLink<T extends { address: string }>(item: T): T & { mapsUrl: string } {
  return { ...item, mapsUrl: mapsLinkFor(item.address) };
}
