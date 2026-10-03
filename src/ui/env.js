// 畫面下方的時間與天氣面板：三個天氣按鈕（晴、雨、雪）與時間滑桿，拖動時畫面立刻跟著變，太陽、月亮也沿著天空移動。
// 狀態在 src/engine/env.js，兩邊用事件溝通；場景沒有使用時間與天氣時面板不會出現。
// 鍵盤：W 切換天氣、← → 每次調一小時（焦點在滑桿上時改由滑桿處理，每次 5 分鐘）。

const svg = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICON = {
  clear: svg('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.55 1.55M17.15 17.15l1.55 1.55M5.3 18.7l1.55-1.55M17.15 6.85l1.55-1.55"/>'),
  rain: svg('<path d="M7.2 15.2a4 4 0 0 1 .3-8 5.6 5.6 0 0 1 10.6 1.7 3.2 3.2 0 0 1-.6 6.3Z"/><path d="M8.6 18.2l-.9 2.3M12.6 18.2l-.9 2.3M16.6 18.2l-.9 2.3"/>'),
  snow: svg('<path d="M12 2.8v18.4M4 7.4l16 9.2M4 16.6l16-9.2M9.6 4.2 12 6.2l2.4-2M9.6 19.8l2.4-2 2.4 2M3.9 10.4l3 .9-.8 3M20.1 13.6l-3-.9.8-3M6.1 9.7l.8 3-3 .9M17.9 14.3l-.8-3 3-.9"/>'),
  moon: svg('<path d="M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.2 6.2 0 0 0 10.1 10.1Z"/>'),
};
const WEATHER = [['clear', '晴'], ['rain', '雨'], ['snow', '雪']];
const STEP = 5;   // 滑桿每格 5 分鐘

const pad = n => String(n).padStart(2, '0');
const hm = min => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
function period(h) {
  if (h < 5) return '深夜';
  if (h < 7) return '清晨';
  if (h < 11) return '上午';
  if (h < 13) return '中午';
  if (h < 17) return '下午';
  if (h < 19) return '傍晚';
  return '夜晚';
}

export function initEnv(current) {
  const el = document.createElement('div');
  el.className = 'env';
  el.hidden = true;
  el.style.setProperty('--accent', current.accent);
  el.innerHTML = /* html */`
    <div class="env-weather" role="group" aria-label="天氣">${WEATHER.map(([id, name]) => /* html */`
      <button class="env-w" type="button" data-w="${id}" aria-pressed="false" title="${name}（W 切換天氣）">${ICON[id]}<span>${name}</span></button>`).join('')}
    </div>
    <div class="env-time">
      <span class="env-icon" aria-hidden="true"><span class="env-sun">${ICON.clear}</span><span class="env-moon">${ICON.moon}</span></span>
      <input class="env-range" type="range" min="0" max="${24 * 60 - STEP}" step="${STEP}" value="0" aria-label="時間" title="時間（← → 每次一小時）">
      <output class="env-clock" aria-hidden="true"><span class="env-hm">00:00</span><span class="env-period">深夜</span></output>
    </div>`;
  document.body.appendChild(el);

  const btns = [...el.querySelectorAll('.env-w')];
  const range = el.querySelector('.env-range');
  const clock = el.querySelector('.env-hm');
  const per = el.querySelector('.env-period');
  let minutes = 0, weather = 'clear', dragging = false;

  const paint = min => {
    const h = min / 60;
    clock.textContent = hm(min);
    per.textContent = period(h);
    el.classList.toggle('is-night', h < 6 || h >= 18);
    range.setAttribute('aria-valuetext', `${period(h)} ${hm(min)}`);
  };

  addEventListener('env:state', e => {
    const d = e.detail;
    el.hidden = false;
    weather = d.weather;
    minutes = Math.round(d.hour * 60) % (24 * 60);
    for (const b of btns) b.setAttribute('aria-pressed', String(b.dataset.w === weather));
    if (!dragging) range.value = Math.round(minutes / STEP) * STEP;
    paint(minutes);
  });

  const setHour = min => dispatchEvent(new CustomEvent('env:set', { detail: { hour: min / 60 } }));
  const setWeather = w => dispatchEvent(new CustomEvent('env:set', { detail: { weather: w } }));

  for (const b of btns) b.addEventListener('click', () => setWeather(b.dataset.w));
  range.addEventListener('input', () => { dragging = true; setHour(+range.value); });
  range.addEventListener('change', () => { dragging = false; });

  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || el.hidden) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
    const k = e.key;
    if ((k === 'w' || k === 'W') && !e.repeat) {
      e.preventDefault();
      setWeather(WEATHER[(WEATHER.findIndex(([id]) => id === weather) + 1) % WEATHER.length][0]);
    } else if (k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault();
      setHour((minutes + (k === 'ArrowLeft' ? -60 : 60) + 24 * 60) % (24 * 60));
    }
  });

  dispatchEvent(new Event('env:query'));   // 場景比面板先準備好時，請它再回報一次

  return {
    show(instant) {
      el.classList.toggle('is-instant', instant);
      el.classList.add('is-ready');
    },
  };
}
