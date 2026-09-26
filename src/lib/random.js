// 固定種子的亂數，讓每次打開的場景都一樣
export const rng = (() => {
  let a = 20260927;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
})();
export const rand = (a, b) => a + (b - a) * rng();
export const pick = arr => arr[Math.floor(rng() * arr.length)];
