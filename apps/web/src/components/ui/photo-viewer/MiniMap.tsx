import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { loadAMap } from "~/lib/amap/amap-loader";
import type { AMapMapInstance, AMapSDK } from "~/lib/amap/amap-types";
import { isValidGPSCoordinates } from "~/lib/map-utils";

interface MiniMapProps {
  latitude: number;
  longitude: number;
  photoId: string;
}

export const MiniMap = ({ latitude, longitude, photoId }: MiniMapProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<AMapMapInstance | null>(null);
  const amapRef = useRef<AMapSDK | null>(null);
  const { t } = useTranslation();
  const exploreHref = `/explore?${new URLSearchParams({ photoId }).toString()}`;

  const hasValidCoordinates = isValidGPSCoordinates({ latitude, longitude });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasValidCoordinates) return;

    let cancelled = false;
    loadAMap()
      .then((amap) => {
        if (cancelled) return;
        amapRef.current = amap;
        const map = new amap.Map(container, {
          zoom: 15,
          center: [longitude, latitude],
          pitch: 0,
          rotation: 0,
          mapStyle: "amap://styles/whitesmoke",
          showLabel: false,
          features: ["bg", "road", "point"],
          zooms: [3, 18],
        });
        mapRef.current = map;
        setIsLoaded(true);
      })
      .catch((error) => {
        console.error("[amap] MiniMap 加载失败:", error);
      });

    return () => {
      cancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
      amapRef.current = null;
      setIsLoaded(false);
    };
  }, [latitude, longitude, hasValidCoordinates]);

  const handleOpenExplore = useCallback(() => {
    // 交给遮罩 Link 处理
  }, []);

  if (!hasValidCoordinates) {
    return null;
  }

  return (
    <div className="relative h-40 w-full overflow-hidden rounded-lg border border-black/10">
      <div
        ref={containerRef}
        className="h-full w-full"
        data-testid="minimap-container"
      />

      {/* 中心标记 */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative">
          <div className="absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-blue-400 opacity-75" />
          <div className="relative h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white/80" />
        </div>
      </div>

      {/* 加载状态 */}
      {!isLoaded && (
        <div className="bg-material-ultra-thin absolute inset-0 flex items-center justify-center backdrop-blur-sm">
          <div className="text-xs text-black/60 dark:text-white/60">
            {t("minimap.loading")}
          </div>
        </div>
      )}

      {/* 点击跳转到 explore 页面的遮罩 */}
      <Link
        to={exploreHref}
        onClick={handleOpenExplore}
        className="absolute inset-0 cursor-pointer transition-opacity duration-200 hover:bg-black/10"
        aria-label={t("minimap.view.in.map")}
      />
    </div>
  );
};
