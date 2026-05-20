# 网球比赛计分

单打 / 双打循环赛：录入球员、生成对阵、记录比分、自动排名。数据保存在浏览器本地（localStorage），支持安装为 PWA 应用。

## 功能

- 添加与管理球员
- 单打或双打模式（双打可手动或自动配对）
- 循环赛对阵表自动生成
- 比分录入与筛选（未赛 / 已赛）
- 排名：胜场 → 净胜局 → 总得分 → 相互战绩

## 开发

```bash
npm install
npm run dev
```

浏览器打开终端提示的地址（默认 http://localhost:5173）。

## 构建与安装

```bash
npm run build
npm run preview
```

### 安装到手机 / 桌面（PWA）

1. 执行 `npm run build` 后，用静态服务器托管 `dist` 目录（或部署到任意 HTTPS 站点）。
2. **Android Chrome**：打开站点 → 菜单 →「添加到主屏幕」。
3. **iOS Safari**：分享 →「添加到主屏幕」。
4. **Windows / macOS Chrome**：地址栏右侧「安装应用」。

> 本地开发时也可在 Chrome DevTools → Application → Manifest 中测试安装。

## 技术栈

- React 19 + TypeScript + Vite
- Zustand（持久化到 localStorage）
- vite-plugin-pwa
