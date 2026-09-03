import { useEffect } from "react";

/**
 * 按 useTitle 的同一模式管理 <meta name="description">：挂载/参数变化时写入，
 * 卸载时恢复站点默认值。纯静态 SPA 无 SSR，Google 等渲染 JS 的爬虫依赖
 * 这条路径获得每张照片独立的摘要（robots.txt 允许抓取 /photos/*，需要它配套）。
 */
export const useMetaDescription = (description?: string | null) => {
  useEffect(() => {
    if (!description) return;

    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    if (!meta) return;

    const previousContent = meta.content;
    meta.content = description;

    return () => {
      meta.content = previousContent;
    };
  }, [description]);
};
