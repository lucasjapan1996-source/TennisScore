/** 德约科维奇滑步反手经典动作（用户提供的照片） */
export function AppLogo({ size = 30 }: { size?: number }) {
  return (
    <img
      className="app-logo-img"
      src="/djokovic-logo.png"
      width={size}
      height={size}
      alt=""
      aria-hidden
      decoding="async"
    />
  );
}
