import { artUrl, hasArt } from '../art/manifest';

/**
 * Raster UI kit (docs/art/SHEETS_UI.md). Each generated piece becomes a CSS variable
 * (--ui-panel, --ui-btn-gold, …) and a class on <html> (k-panel, k-btn-gold, …);
 * ui.css switches the element to the image only when its class is present,
 * so a missing piece keeps the CSS-drawn chrome.
 */
export const UI_KIT = [
  'ui_panel', 'ui_header', 'ui_close', 'ui_btn_gold', 'ui_btn_green', 'ui_btn_blue', 'ui_btn_red',
  'ui_ring', 'ui_ring_big', 'ui_frame_portrait', 'ui_badge_level', 'ui_bar_top', 'ui_bar_bottom',
  'ui_tab', 'ui_tab_on', 'ui_card', 'ui_bar_frame',
  'ui_slot_common', 'ui_slot_rare', 'ui_slot_epic', 'ui_slot_legendary', 'ui_plate_quest', 'ui_plate_name',
] as const;

export function applySkin(root: HTMLElement = document.documentElement): string[] {
  const on: string[] = [];
  for (const n of UI_KIT) {
    if (!hasArt(n)) continue;
    const css = n.replace(/_/g, '-');
    root.style.setProperty('--' + css, `url("${artUrl(n)}")`);
    root.classList.add('k-' + css.slice(3));
    on.push(n);
  }
  return on;
}
