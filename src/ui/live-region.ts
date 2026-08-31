/**
 * Announcements for assistive technology. Gameplay happens on a canvas, which exposes
 * nothing to a screen reader, so anything the game says in a toast is mirrored here.
 */
export function announce(message: string): void {
  const region = document.getElementById('a11y-live');
  if (region == null) return;
  // Re-setting identical text does not re-announce; clear first.
  region.textContent = '';
  region.textContent = message;
}
