/** 应用 Logo（Tennis Score） */
export function AppLogo({ size = 30 }: { size?: number }) {
  return (
    <img
      className="app-logo-img"
      src="/logo.png"
      width={size}
      height={size}
      alt=""
      aria-hidden
      decoding="async"
    />
  );
}
