/**
 * Game-space layout constants for the play screen.
 *
 * The canvas is FIT-scaled into the viewport, so every dimension here is multiplied by
 * the same factor at runtime. The smallest supported phone (iPhone SE, 375x667) gives
 * 667/844 = 0.79, which makes 56 game units the smallest height that still clears the
 * 44 px CSS touch target required by WCAG 2.5.5 and Apple's HIG.
 *
 * Rows are derived upwards from the bottom bar so the gap left for the home indicator
 * cannot be squeezed out by a later edit, and so no two rows can silently overlap —
 * the bug that once made "Wand depth" taps land on "Bin & restart".
 */
export const GAME_WIDTH = 390;
export const GAME_HEIGHT = 844;

/** Clear of the iPhone home indicator, which the FIT-scaled canvas otherwise runs under. */
export const SAFE_BOTTOM = 28;

export const BTN = { h: 56, gap: 10, w: 120, wideW: 260, barH: 56 } as const;

/** Column centres for the three-across control rows. */
export const COL_X = [65, 195, 325] as const;

/** Persistent Undo / Bin / Serve bar. */
export const BAR_Y = GAME_HEIGHT - SAFE_BOTTOM - BTN.barH / 2;

/** Station control rows, top to bottom. */
export const ROW_Y = [
  BAR_Y - 3 * (BTN.h + BTN.gap),
  BAR_Y - 2 * (BTN.h + BTN.gap),
  BAR_Y - 1 * (BTN.h + BTN.gap),
] as const;

/** Panel behind the controls: starts one gap above the first row. */
export const CONTROLS_TOP = ROW_Y[0] - BTN.h / 2 - BTN.gap;

export const TOP_PANEL = { height: 280, ticketY: 205, patienceLabelY: 254, patienceBarY: 272 } as const;
/**
 * Station tabs are Text objects, so their height is font + 2 * padding. At 14 px the
 * glyph box measures 15, and 15 + 2 * 21 = 57 game units clears 44 px CSS at the 0.79
 * scale of an iPhone SE — 20 left it at 43.5 and just missed.
 */
export const TABS_Y = 310;
export const TAB_PADDING = { x: 14, y: 21 } as const;
export const STATION_STATUS_Y = 350;
export const GUIDED_Y = 512;
export const TOAST_Y = 496;

/** Feedback card: centre in game space, plus the offset of its dismiss button. */
export const FEEDBACK = { x: 195, y: 445, nextOffsetY: 195 } as const;

/** Smallest supported scale factor, used by the touch-target test. */
export const MIN_SCALE = 667 / GAME_HEIGHT;
