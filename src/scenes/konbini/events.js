// 場景事件：場景裡會「發生事情」的模組每格把事件放進這一份共用的清單，
// 少女每格讀一次、讀完就清空，當成場景資訊傳給少女行為
// 每一項是 { kind, x, y, z }：事件的種類與世界座標。沒有少女在讀的時候不記錄，清單不會一直長大，場景照常運作

const events = { listening: false, list: [] };

/** 場景裡發生了一件事；沒有人在聽就什麼都不做 */
export function happen(kind, x, y, z) {
  if (events.listening) events.list.push({ kind, x, y, z });
}

/** 開始或停止記錄事件（少女載入完成、或出錯被藏起來時） */
export function listen(on) {
  events.listening = on;
  events.list.length = 0;
}

/** 拿走到目前為止發生的事件 */
export const takeEvents = () => events.list.splice(0);
