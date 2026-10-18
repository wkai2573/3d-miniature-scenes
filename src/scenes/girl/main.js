// 雨夜のことりマート・傘の少女：同一條街景，由共用的便利商店建立流程搭建
import { buildKonbiniScene } from '../konbini/scene.js';

// 夜晚的店內燈光壓到兩成：少女進店時才不會被泛光暈開
await buildKonbiniScene({ nightInterior: 0.2 });
