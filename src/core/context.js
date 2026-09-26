// 全場景共用的執行環境：場景物件、時間、每格更新的登錄表
import * as THREE from 'three';
import { canvasTex } from '../lib/canvas.js';

export const PI = Math.PI;
export const DPR = Math.min(window.devicePixelRatio || 1, 2);
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x131b31, 75, 170);
scene.background = canvasTex(4, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#070b17'); gr.addColorStop(0.6, '#10182f'); gr.addColorStop(1, '#1b2644');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

// 所有 shader 共用同一個 time uniform
export const U = { time: { value: 0 } };

// 每格呼叫一次：f(秒數, 與上一格的間隔)
export const ticks = [];
export const onTick = f => ticks.push(f);
