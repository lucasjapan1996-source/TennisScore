/** 用实测底栏高度更新滚动区底部留白，避免内容被 Tab 挡住 */
export function syncBottomChromeHeight(): void {
  const chrome = document.querySelector('.app-bottom-chrome');
  if (!(chrome instanceof HTMLElement)) return;
  const height = Math.ceil(chrome.getBoundingClientRect().height);
  if (height > 0) {
    document.documentElement.style.setProperty('--bottom-chrome-h', `${height}px`);
  }
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

/** 检测 iOS / PWA 主屏幕模式，供布局使用（比仅靠 display-mode 媒体查询更可靠） */
export function installStandaloneLayoutClass(): void {
  const apply = () => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    document.documentElement.classList.toggle('is-standalone', standalone);
    const root = document.documentElement.style;
    root.setProperty('--safe-top-inset', 'env(safe-area-inset-top, 0px)');
    root.setProperty('--safe-bottom-inset', 'env(safe-area-inset-bottom, 0px)');
    requestAnimationFrame(syncBottomChromeHeight);
  };

  apply();
  attachBottomChromeMeasure();

  window.addEventListener('pageshow', apply);
  window.addEventListener('resize', syncBottomChromeHeight);
  window.addEventListener('orientationchange', () => {
    requestAnimationFrame(syncBottomChromeHeight);
  });
  window.visualViewport?.addEventListener('resize', syncBottomChromeHeight);
  window.matchMedia('(display-mode: standalone)').addEventListener('change', apply);
  window.matchMedia('(display-mode: fullscreen)').addEventListener('change', apply);

  if (document.fonts?.ready) {
    document.fonts.ready.then(syncBottomChromeHeight);
  }
}
