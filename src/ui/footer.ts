import { FOOTER_COPY } from './copy';

/** Credit footer for DOM menu-type screens only — never inside Phaser gameplay. */
export function renderFooter(): string {
  const c = FOOTER_COPY;
  return `
<footer class="app-footer">
  <a href="mailto:${c.email}">${c.email}</a>
  <span class="dot" aria-hidden="true">·</span>
  <span>${c.credit}</span>
  <span class="dot" aria-hidden="true">·</span>
  <a href="${c.siteUrl}" target="_blank" rel="noreferrer">${c.site}</a>
  <span class="dot" aria-hidden="true">·</span>
  <a href="${c.githubUrl}" target="_blank" rel="noreferrer">${c.github}</a>
  <span class="dot" aria-hidden="true">·</span>
  <span>v${__APP_VERSION__}</span>
</footer>`;
}
