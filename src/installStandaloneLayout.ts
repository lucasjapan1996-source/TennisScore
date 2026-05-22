/** 检测 iOS / PWA 主屏幕模式，供布局使用（比仅靠 display-mode 媒体查询更可靠） */
export function installStandaloneLayoutClass(): void {
  const apply = () => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    document.documentElement.classList.toggle('is-standalone', standalone);
  };

  apply();
  window.matchMedia('(display-mode: standalone)').addEventListener('change', apply);
  window.matchMedia('(display-mode: fullscreen)').addEventListener('change', apply);
}
