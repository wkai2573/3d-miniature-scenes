// 全場景共用的執行環境：場景物件、時間、每格更新的登錄表
// 天空與霧由各場景自己設定
import * as THREE from 'three';

export const PI = Math.PI;
export const DPR = Math.min(window.devicePixelRatio || 1, 2);
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const scene = new THREE.Scene();

// 所有 shader 共用同一個 time uniform
export const U = { time: { value: 0 } };

// 每格呼叫一次：f(秒數, 與上一格的間隔)
export const ticks = [];
export const onTick = f => ticks.push(f);
