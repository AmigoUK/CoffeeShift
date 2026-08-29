/** Shared pixel palette: char → hex. '.' and ' ' are transparent. */
export const PALETTE: Record<string, string> = {
  K: '#3b2417', // dark coffee / outline
  B: '#6f4e37', // coffee brown
  b: '#8b6a4f', // light brown
  M: '#a37a3f', // wood / counter
  Y: '#e8c07a', // biscuit / caramel
  C: '#fdf6ec', // cream
  W: '#f5f0e6', // milk white
  S: '#9aa3ab', // machine steel
  s: '#6d767e', // dark steel
  T: '#2f8f83', // accent teal
  t: '#c76e43', // terracotta
  R: '#c0392b', // error red
  G: '#3a7d44', // ok green
  P: '#e8b4b8', // skin
  H: '#4a3b32', // hair
  E: '#ffffff', // highlight white
  N: '#2b2b33', // night / clothes
  L: '#7a8ba3', // light blue cloth
};

export const TRANSPARENT_CHARS = new Set(['.', ' ']);
