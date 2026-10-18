// 傘的遮擋：少女撐開的傘擋住的雨絲與雪花不畫
// 天氣（weather.js）建立雨雪時接上它，少女（girl/girl.js）每格告訴它傘現在的位置；少女還沒載入或載入失敗時它沒有遮擋
import { createShelter } from '../../engine/precip.js';

export const shelter = createShelter();
