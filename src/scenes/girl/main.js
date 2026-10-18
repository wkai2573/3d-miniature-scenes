// 雨夜のことりマート・傘の少女：同一條街景，由共用的便利商店建立流程搭建，再加上由玩家操作的少女
import { buildKonbiniScene } from '../konbini/scene.js';
import { buildGirl } from './girl.js';

await buildKonbiniScene();
buildGirl();   // 非同步載入，不擋開場；載入失敗時只在主控台警告
