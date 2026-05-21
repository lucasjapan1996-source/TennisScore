import { useEffect } from 'react';

/** 修复移动端键盘弹出时的横向滑动与滚动错位 */
export function useMobileScrollFix() {
  useEffect(() => {
    const main = document.querySelector('.app-main');
    const resetHorizontal = () => {
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
      if (main instanceof HTMLElement) {
        main.scrollLeft = 0;
      }
    };

    const onViewportChange = () => {
      resetHorizontal();
    };

    const onFocusIn = (e: FocusEvent) => {
      const el = e.target;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement
      ) {
        resetHorizontal();
        requestAnimationFrame(() => {
          el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        });
      }
    };

    const vv = window.visualViewport;
    vv?.addEventListener('resize', onViewportChange);
    vv?.addEventListener('scroll', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);
    document.addEventListener('focusin', onFocusIn);

    return () => {
      vv?.removeEventListener('resize', onViewportChange);
      vv?.removeEventListener('scroll', onViewportChange);
      window.removeEventListener('orientationchange', onViewportChange);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, []);
}
