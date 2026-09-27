// 紅綠燈：路口的車用／行人號誌依 32 秒週期輪替，遠處一盞夜間閃黃燈
import * as THREE from 'three';
import { PI, onTick } from '../../engine/context.js';
import { canvasTex } from '../../engine/canvas.js';
import { toon } from '../../engine/materials.js';
import { G, box, cyl, plane, rod, grp } from '../../engine/geometry.js';

function sigMat(color, map = null) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), map });
  m.userData.base = new THREE.Color(color);
  return m;
}
function setLamp(m, on, k = 2.6) { m.color.copy(m.userData.base).multiplyScalar(on ? k : 0.07); }

// 日本的橫式號誌：左青、中黃、右紅；燈面朝本地 +z
function vehicleSignal(x, y, z, ry, visor) {
  const g0 = grp(x, y, z, ry);
  box(1.25, 0.42, 0.22, '#3b3f47', 0, -0.21, 0, { parent: g0, t: 0.015, cast: true });
  box(1.32, 0.48, 0.03, '#2a2d33', 0, -0.24, -0.12, { parent: g0, outline: false });
  const mats = ['#3fe0b0', '#ffc233', '#ff4a3a'].map(c => sigMat(c));
  [-0.4, 0, 0.4].forEach((lx, i) => {
    const lamp = new THREE.Mesh(G('siglamp', () => new THREE.CircleGeometry(0.15, 20)), mats[i]);
    lamp.position.set(lx, 0, 0.112); g0.add(lamp);
    const v = new THREE.Mesh(visor.geo, visor.mat);
    v.rotation.x = PI / 2; v.position.set(lx, 0, 0.21); g0.add(v);
  });
  return mats;
}

function figureTex(walking) {
  return canvasTex(96, 96, (g, w, h) => {
    g.fillStyle = '#101216'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff'; g.lineCap = 'round'; g.lineWidth = 9;
    g.beginPath(); g.arc(48, 18, 9, 0, PI * 2); g.fill();
    g.beginPath();
    if (walking) { g.moveTo(46, 32); g.lineTo(42, 58); g.moveTo(42, 58); g.lineTo(28, 84); g.moveTo(42, 58); g.lineTo(58, 84); g.moveTo(45, 36); g.lineTo(30, 52); g.moveTo(45, 36); g.lineTo(62, 50); }
    else { g.moveTo(48, 32); g.lineTo(48, 60); g.moveTo(42, 60); g.lineTo(42, 86); g.moveTo(54, 60); g.lineTo(54, 86); g.moveTo(40, 36); g.lineTo(36, 60); g.moveTo(56, 36); g.lineTo(60, 60); g.lineWidth = 12; }
    g.stroke();
  });
}

export function buildTraffic() {
  const visor = { geo: new THREE.CylinderGeometry(0.17, 0.17, 0.2, 16, 1, true, PI / 2, PI), mat: toon('#2a2d33', { side: THREE.DoubleSide }) };
  const figStop = figureTex(false), figWalk = figureTex(true);
  const pedSignal = (x, y, z, ry) => {
    const g0 = grp(x, y, z, ry);
    box(0.36, 0.74, 0.18, '#3b3f47', 0, -0.37, 0, { parent: g0, t: 0.012 });
    const red = sigMat('#ff4a3a', figStop), green = sigMat('#3fe0b0', figWalk);
    plane(0.27, 0.27, red, 0, 0.17, 0.092, { parent: g0 });
    plane(0.27, 0.27, green, 0, -0.17, 0.092, { parent: g0 });
    return { red, green };
  };

  // 側街對面的轉角：車用號誌 ×2、行人號誌
  cyl(0.1, 0.12, 5.4, '#b5b8bd', 13.1, 0, 6.95, { cast: true });
  rod([13.1, 5.05, 6.95], [13.1, 5.05, 8.4], 0.06, '#b5b8bd');
  rod([13.1, 5.05, 6.95], [12.3, 5.05, 6.95], 0.06, '#b5b8bd');
  const main = vehicleSignal(13.1, 4.8, 8.15, PI / 2, visor);
  const side = vehicleSignal(12.45, 4.8, 6.95, PI, visor);
  const walkSideA = pedSignal(12.97, 2.9, 6.95, -PI / 2);
  // 便利商店這側的轉角
  cyl(0.08, 0.1, 3.4, '#b5b8bd', 7.35, 0, 6.7, { cast: true });
  const walkSideB = pedSignal(7.47, 2.9, 6.7, PI / 2);
  const walkMainA = pedSignal(7.35, 2.9, 6.82, 0);
  // 大馬路對面
  cyl(0.08, 0.1, 3.6, '#b5b8bd', 6.6, 0, 13.62, { cast: true });
  const walkMainB = pedSignal(6.6, 2.9, 13.5, PI);
  // 側街深處的閃黃燈
  cyl(0.1, 0.12, 5.3, '#b5b8bd', 12.9, 0, -12.9, { cast: true });
  rod([12.9, 5.0, -12.9], [11.0, 5.0, -12.9], 0.06, '#b5b8bd');
  const flash = vehicleSignal(11.4, 4.75, -12.9, 0, visor);

  onTick(t => {
    const c = t % 32, blink = Math.floor(t * 2) % 2 === 0;
    setLamp(main[0], c < 14); setLamp(main[1], c >= 14 && c < 17); setLamp(main[2], c >= 17);
    const sideG = c >= 18 && c < 28, sideY = c >= 28 && c < 31;
    setLamp(side[0], sideG); setLamp(side[1], sideY); setLamp(side[2], !sideG && !sideY);
    const wsG = c < 11 || (c < 14 && blink);
    for (const s of [walkSideA, walkSideB]) { setLamp(s.green, wsG, 2.2); setLamp(s.red, c >= 14, 2.2); }
    const wmG = (c >= 18 && c < 25) || (c >= 25 && c < 28 && blink);
    for (const s of [walkMainA, walkMainB]) { setLamp(s.green, wmG, 2.2); setLamp(s.red, !(c >= 18 && c < 28), 2.2); }
    setLamp(flash[0], false); setLamp(flash[1], (t % 1.2) < 0.6, 2.0); setLamp(flash[2], false);
  });
}
