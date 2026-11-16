// The "Rising Steps" mark, drawn on a 32×32 grid: a staircase climbing to an arrow.
// Shared by the site header, the static preview and the browser-tab icons.
export const LOGO_STEPS = "M6.5 25h5.3v-5.3h5.3v-5.3h5.3V7.3";
export const LOGO_ARROW = "M18.6 10.9 22.4 7.1l3.8 3.8";
export const LOGO_STROKE = 3.2;

/** Standalone SVG file contents, for favicons and app icons. */
export function logoSvg(brand = "#f2a31b", ink = "#1d1a16"): string {
  const line = `fill="none" stroke="${ink}" stroke-width="${LOGO_STROKE}" stroke-linecap="round" stroke-linejoin="round"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="${brand}"/><path d="${LOGO_STEPS}" ${line}/><path d="${LOGO_ARROW}" ${line}/></svg>`;
}
