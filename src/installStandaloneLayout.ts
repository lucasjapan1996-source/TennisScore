/** 是否以桌面/主屏幕 PWA 方式运行（非浏览器标签页） */
export function isPwaStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS 旧版「添加到主屏幕」可能仍为 browser，但 navigator.standalone 为 true
  return (
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** 用实测底栏高度更新滚动区底部留白，避免内容被 Tab 挡住 */
export function syncBottomChromeHeight(): void {
  const chrome = document.querySelector('.app-bottom-chrome');
  if (!(chrome instanceof HTMLElement)) return;
  const height = Math.ceil(chrome.getBoundingClientRect().height);
  if (height <= 0) return;

  const isPwa = isPwaStandalone();
  // PWA：底栏已贴边，仅留极小滚动缓冲；浏览器：略多留白
  const scrollBufferPx = isPwa ? 4 : 10;
  document.documentElement.style.setProperty(
    '--bottom-chrome-h',
    `${height + scrollBufferPx}px`,
  );
}

let bottomChromeObserver: ResizeObserver | null = null;

function attachBottomChromeMeasure(): void {
  const chrome = document.querySelector('.app-bottom-chrome');
  if (!(chrome instanceof HTMLElement)) {
    requestAnimationFrame(attachBottomChromeMeasure);
    return;
  }

  syncBottomChromeHeight();

  if (bottomChromeObserver) return;
  if (typeof ResizeObserver === 'undefined') return;

  bottomChromeObserver = new ResizeObserver(() => syncBottomChromeHeight());
  bottomChromeObserver.observe(chrome);
}

function applyLayoutMode(): void {
  const isPwa = isPwaStandalone();
  const root = document.documentElement;

  root.classList.toggle('is-pwa', isPwa);
  root.classList.toggle('is-browser', !isPwa);
  root.classList.toggle('is-standalone', isPwa);

  const style = root.style;
  style.setProperty('--safe-top-inset', 'env(safe-area-inset-top, 0px)');
  style.setProperty('--safe-bottom-inset', 'env(safe-area-inset-bottom, 0px)');

  if (isPwa) {
    style.setProperty('--footer-h', '0');
    style.setProperty('--scroll-bottom-gap', '0.25rem');
    style.setProperty('--main-bottom-pad', '0.2rem');
  } else {
    style.setProperty('--footer-h', '0.7rem');
    style.setProperty('--scroll-bottom-gap', '0.75rem');
    style.setProperty('--main-bottom-pad', '0.35rem');
  }

  requestAnimationFrame(syncBottomChromeHeight);
}

/** 检测 PWA / 浏览器模式并同步底栏高度 */
export function installStandaloneLayoutClass(): void {
  applyLayoutMode();
  attachBottomChromeMeasure();

  window.addEventListener('pageshow', applyLayoutMode);
  window.addEventListener('resize', syncBottomChromeHeight);
  window.addEventListener('orientationchange', () => {
    requestAnimationFrame(syncBottomChromeHeight);
  });
  window.visualViewport?.addEventListener('resize', syncBottomChromeHeight);
  window
    .matchMedia('(display-mode: standalone)')
    .addEventListener('change', applyLayoutMode);

  if (document.fonts?.ready) {
    document.fonts.ready.then(syncBottomChromeHeight);
  }
}
