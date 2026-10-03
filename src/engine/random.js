// 固定種子的亂數，讓每次打開的場景都一樣
// 引擎裡的星星、雨雪粒子用 seeded() 另開一條亂數，才不會改變場景物件的擺放
export function seeded(seed) {
  let a = seed;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export const rng = seeded(20260927);
export const rand = (a, b) => a + (b - a) * rng();
export const pick = arr => arr[Math.floor(rng() * arr.length)];
