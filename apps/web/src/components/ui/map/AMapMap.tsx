import { m } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";

import { loadAMap } from "~/lib/amap/amap-loader";
import type {
  AMapInfoWindowInstance,
  AMapMapInstance,
  AMapMarkerClusterInstance,
  AMapMarkerInstance,
  AMapSDK,
} from "~/lib/amap/amap-types";
import type { GpsLike } from "~/lib/amap/coord";
import { toGcj02Points, wgs84ToGcj02 } from "~/lib/amap/coord";
import { calculateMapBounds } from "~/lib/map-utils";
import type { BaseMapProps, GeographicRegion, PhotoMarker } from "~/types/map";

import { AMapDistrictBoundary } from "./AMapDistrictBoundary";
import { AMapInfoWindowContent } from "./AMapInfoWindowContent";
import { AMapLegend } from "./AMapLegend";
import { AMapRegionInfoWindowContent } from "./AMapRegionInfoWindowContent";
import { AMapSearchBox } from "./AMapSearchBox";
import { AMapTimeline } from "./AMapTimeline";

/** 高德亮色底图（与站点黑白灰主题协调，中文标注默认开启） */
const AMAP_STYLE = "amap://styles/whitesmoke";

interface MarkerRecord {
  marker: AMapMarkerInstance;
  kind: "photo" | "region";
  data: PhotoMarker | GeographicRegion;
}

// ---------- content builders（内联样式，不依赖编译类） ----------

const PIN_STYLE = {
  wrapper:
    "position:relative;display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:9999px;border:2px solid #ffffff;box-shadow:0 4px 14px rgba(0,0,0,0.28);overflow:hidden;background:#ffffff;transition:transform 150ms;cursor:pointer;",
  selected:
    "box-shadow:0 0 0 3px rgba(107,114,128,0.45),0 6px 18px rgba(0,0,0,0.3);",
  img: "width:100%;height:100%;object-fit:cover;opacity:0.85;display:block;",
  icon: "position:absolute;color:#ffffff;font-size:16px;text-shadow:0 1px 3px rgba(0,0,0,0.5);",
  badge:
    "position:absolute;right:-4px;bottom:-4px;min-width:18px;height:18px;padding:0 4px;border-radius:9999px;background:rgba(0,0,0,0.78);color:#fff;font-size:10px;font-weight:700;line-height:18px;text-align:center;border:1px solid rgba(255,255,255,0.5);",
};

const buildPhotoPinContent = (
  marker: PhotoMarker,
  isSelected: boolean,
): string => {
  const src = marker.photo.thumbnailUrl || marker.photo.originalUrl || "";
  // 地图图钉最多同时存在上百个，视口外的图钉图一律懒加载/异步解码，避免与页面首屏抢带宽。
  const img = src
    ? `<img src="${src}" alt="" loading="lazy" decoding="async" style="${PIN_STYLE.img}"/>`
    : "";
  const selectedStyle = isSelected ? PIN_STYLE.selected : "";
  return (
    `<div style="${PIN_STYLE.wrapper}${selectedStyle}" role="button" tabindex="0">${
      img
    }<i class="i-mingcute-camera-line" style="${PIN_STYLE.icon}"></i>` +
    `</div>`
  );
};

const buildRegionPinContent = (
  region: GeographicRegion,
  isSelected: boolean,
): string => {
  const selectedStyle = isSelected ? PIN_STYLE.selected : "";
  return (
    `<div style="${PIN_STYLE.wrapper}${selectedStyle}" role="button" tabindex="0">` +
    `<i class="i-mingcute-map-pin-fill" style="${PIN_STYLE.icon}"></i>` +
    `<span style="${PIN_STYLE.badge}">${region.photoCount}</span>` +
    `</div>`
  );
};

const buildClusterContent = (count: number): string => {
  const size = Math.min(64, Math.max(44, 32 + Math.log(count) * 8));
  return (
    `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;border:2px solid rgba(107,114,128,0.5);background:rgba(107,114,128,0.92);box-shadow:0 6px 18px rgba(0,0,0,0.3);cursor:pointer;">` +
    `<span style="color:#fff;font-size:${size >= 56 ? 15 : 13}px;font-weight:700;">${count}</span>` +
    `</div>`
  );
};

// 稳定的空数组常量，避免默认 prop 每次渲染新建引用
const NO_MARKERS: PhotoMarker[] = [];
const NO_REGIONS: GeographicRegion[] = [];

// ---------- 组件 ----------

export const AMapMap = ({
  id,
  initialViewState,
  markers = NO_MARKERS,
  regions = NO_REGIONS,
  displayMode = "regions",
  selectedMarkerId,
  selectedRegionId,
  className = "w-full h-full",
  style,
  handlers,
  autoFitBounds = true,
  onZoomChange,
}: BaseMapProps) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const amapRef = useRef<AMapSDK | null>(null);
  const mapRef = useRef<AMapMapInstance | null>(null);
  const clusterRef = useRef<AMapMarkerClusterInstance | null>(null);
  const recordByIdRef = useRef<Map<string, MarkerRecord>>(new Map());
  const infoWindowRef = useRef<AMapInfoWindowInstance | null>(null);
  const rootRef = useRef<Root | null>(null);
  const fittedRef = useRef(false);
  const mapInitializedRef = useRef(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [timeRange, setTimeRange] = useState<[number, number] | null>(null);
  const [clusterVersion, setClusterVersion] = useState(0);

  // 时间轴：仅 photos 模式生效，提取拍摄日期范围
  const photoDates = useMemo(() => {
    const dates = markers
      .map((m) => m.photo.dateTaken ?? m.photo.exif?.DateTimeOriginal ?? null)
      .filter(Boolean)
      .map((d) => new Date(d).getTime())
      .filter((t) => Number.isFinite(t));
    if (dates.length === 0) return null;
    return { min: Math.min(...dates), max: Math.max(...dates) };
  }, [markers]);

  const filteredMarkers = useMemo(() => {
    if (!timeRange || displayMode !== "photos") return markers;
    return markers.filter((m) => {
      const t = new Date(
        m.photo.dateTaken ?? m.photo.exif?.DateTimeOriginal ?? "",
      ).getTime();
      return Number.isFinite(t) && t >= timeRange[0] && t <= timeRange[1];
    });
  }, [markers, timeRange, displayMode]);

  // 数据变化时初始化/重置时间范围
  useEffect(() => {
    if (photoDates) {
      setTimeRange((prev) =>
        prev && prev[0] >= photoDates.min && prev[1] <= photoDates.max
          ? prev
          : [photoDates.min, photoDates.max],
      );
    } else {
      setTimeRange(null);
    }
  }, [photoDates]);

  // 最新 props 快照，供回调闭包读取
  const propsRef = useRef({
    markers: filteredMarkers,
    regions,
    displayMode,
    autoFitBounds,
  });
  propsRef.current = {
    markers: filteredMarkers,
    regions,
    displayMode,
    autoFitBounds,
  };

  const fitToData = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const { markers: ms, regions: rs, displayMode: mode } = propsRef.current;
    // regions 模式直接用区域本身（自带 bounds 中心经纬度）；两种形态都带
    // longitude/latitude，无需再经 createRegionMarkers 转成 PhotoMarker——
    // 那会把 photoCount/markers/label 等区域字段全部丢掉。
    const points = mode === "regions" ? rs : ms;
    if (points.length === 0) {
      map.setZoom(2);
      return;
    }
    const bounds = calculateMapBounds(points);
    if (!bounds) return;
    try {
      map.setFitView(
        toGcj02Points<GpsLike>(points).map((p) => ({
          getPosition: () => ({ lng: p.longitude, lat: p.latitude }),
        })),
        false,
        [60, 60, 60, 60],
        15,
      );
    } catch {
      map.setZoom(2);
    }
  }, []);

  const closeInfoWindow = useCallback(() => {
    infoWindowRef.current?.close();
    rootRef.current?.unmount();
    rootRef.current = null;
  }, []);

  const openInfoWindow = useCallback(
    (record: MarkerRecord) => {
      const amap = amapRef.current;
      const map = mapRef.current;
      if (!amap || !map) return;
      if (!infoWindowRef.current) {
        infoWindowRef.current = new amap.InfoWindow({
          isCustom: true,
          autoMove: true,
          closeWhenClickMap: true,
        });
      }
      const host = document.createElement("div");
      rootRef.current?.unmount();
      const root = createRoot(host);
      rootRef.current = root;
      if (record.kind === "photo") {
        root.render(
          <AMapInfoWindowContent
            marker={record.data as PhotoMarker}
            onClose={closeInfoWindow}
          />,
        );
      } else {
        root.render(
          <AMapRegionInfoWindowContent
            region={record.data as GeographicRegion}
            onClose={closeInfoWindow}
          />,
        );
      }
      // record.data 是 manifest 数据（WGS-84）；InfoWindow 锚点进入高德前转 GCJ-02。
      const [infoLng, infoLat] = wgs84ToGcj02(
        record.data.longitude,
        record.data.latitude,
      );
      const position = { lng: infoLng, lat: infoLat };
      infoWindowRef.current.setContent(host);
      infoWindowRef.current.open(map, position);
    },
    [closeInfoWindow],
  );

  const handleItemClick = useCallback(
    (record: MarkerRecord) => {
      if (record.kind === "photo") {
        handlers?.onMarkerClick?.(record.data as PhotoMarker);
        openInfoWindow(record);
      } else {
        handlers?.onRegionClick?.(record.data as GeographicRegion);
        openInfoWindow(record);
      }
    },
    [handlers, openInfoWindow],
  );

  const rebuildCluster = useCallback(() => {
    const amap = amapRef.current;
    const map = mapRef.current;
    if (!amap || !map) return;

    // 销毁旧聚合层（其管理的 marker 一并清理）
    clusterRef.current?.setMap(null);
    recordByIdRef.current.clear();

    const { markers: ms, regions: rs, displayMode: mode } = propsRef.current;
    const isRegions = mode === "regions";
    // 修复：regions 模式保留原始 GeographicRegion 作为聚合层数据——此前经
    // createRegionMarkers 转成 PhotoMarker 后 photoCount/markers 等字段全部
    // 丢失，图钉徽章和区域弹窗都会渲染出 undefined。两种形态都自带
    // longitude/latitude（区域即 bounds 中心），lnglat 取值不变。
    const source: Array<PhotoMarker | GeographicRegion> = isRegions ? rs : ms;

    // 高德 v2.0 MarkerCluster 需要 { lnglat: [lng, lat] } 对象数组（非 Marker 实例）；
    // manifest 坐标为 WGS-84，进入高德前统一转 GCJ-02。
    const points = source.map((item) => {
      const [lng, lat] = wgs84ToGcj02(item.longitude, item.latitude);
      return { lnglat: [lng, lat] as [number, number], _data: item };
    });

    const bindOnce = (marker: AMapMarkerInstance, handler: () => void) => {
      if (marker.getExtData?.() === "__bound__") return;
      marker.setExtData?.("__bound__");
      marker.on("click", handler);
    };

    const cluster = new amap.MarkerCluster(map, points, {
      gridSize: 60,
      minClusterSize: 2,
      maxZoom: 16,
      renderClusterMarker: (context) => {
        const { marker } = context;
        marker.setContent(buildClusterContent(context.count));
        bindOnce(marker, () => {
          const pos = marker.getPosition();
          if (pos) {
            map.setZoomAndCenter(
              Math.min(map.getZoom() + 2, 20),
              { lng: pos.lng, lat: pos.lat },
              false,
            );
          }
        });
      },
      renderMarker: (context) => {
        const dataArr = context.data as Array<{ _data?: unknown }> | undefined;
        const item = Array.isArray(dataArr) ? dataArr[0]?._data : undefined;
        const { marker } = context;
        if (!item) return;
        const record: MarkerRecord = {
          marker,
          kind: isRegions ? "region" : "photo",
          data: item as PhotoMarker | GeographicRegion,
        };
        recordByIdRef.current.set(
          (item as PhotoMarker | GeographicRegion).id,
          record,
        );
        marker.setContent(
          isRegions
            ? buildRegionPinContent(item as GeographicRegion, false)
            : buildPhotoPinContent(item as PhotoMarker, false),
        );
        bindOnce(marker, () => handleItemClick(record));
      },
    });
    clusterRef.current = cluster;
    setClusterVersion((version) => version + 1);

    if (propsRef.current.autoFitBounds && !fittedRef.current) {
      fittedRef.current = true;
      fitToData();
    }
  }, [fitToData, handleItemClick]);

  // 初始化地图
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapInitializedRef.current) return;
    mapInitializedRef.current = true;

    let cancelled = false;
    loadAMap()
      .then((amap) => {
        if (cancelled) return;
        const initial = initialViewState;
        const [initLng, initLat] = wgs84ToGcj02(
          initial?.longitude ?? 0,
          initial?.latitude ?? 0,
        );
        const map = new amap.Map(container, {
          viewMode: "3D",
          zoom: initial?.zoom ?? 2,
          center: [initLng, initLat],
          pitch: 0,
          rotation: 0,
          mapStyle: AMAP_STYLE,
          showLabel: true,
          zooms: [2, 20],
        });
        amapRef.current = amap;
        mapRef.current = map;
        map.addControl(new amap.Scale());
        map.on("zoomchange", () => {
          onZoomChange?.(map.getZoom());
        });
        map.on("click", () => closeInfoWindow());
        setIsMapReady(true);
        rebuildCluster();
      })
      .catch((error) => {
        mapInitializedRef.current = false;
        console.error("[amap] 地图加载失败:", error);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 数据/模式变化 → 重建聚合层
  useEffect(() => {
    if (!isMapReady) return;
    rebuildCluster();
    closeInfoWindow();
  }, [
    rebuildCluster,
    closeInfoWindow,
    isMapReady,
    filteredMarkers,
    regions,
    displayMode,
  ]);

  // 选中态变化 → 更新高亮 + 弹窗
  useEffect(() => {
    if (!isMapReady) return;
    const selectedId =
      displayMode === "regions" ? selectedRegionId : selectedMarkerId;
    for (const [, record] of recordByIdRef.current) {
      const isSelected = record.data.id === selectedId;
      const content =
        record.kind === "photo"
          ? buildPhotoPinContent(record.data as PhotoMarker, isSelected)
          : buildRegionPinContent(record.data as GeographicRegion, isSelected);
      record.marker.setContent(content);
    }
    if (selectedId) {
      const record = recordByIdRef.current.get(selectedId);
      if (record) openInfoWindow(record);
    } else {
      closeInfoWindow();
    }
  }, [
    displayMode,
    selectedMarkerId,
    selectedRegionId,
    isMapReady,
    openInfoWindow,
    closeInfoWindow,
    clusterVersion,
  ]);

  // 卸载清理
  useEffect(() => {
    return () => {
      clusterRef.current?.setMap(null);
      rootRef.current?.unmount();
      mapRef.current?.destroy();
      mapRef.current = null;
      amapRef.current = null;
    };
  }, []);

  const handleToggle3D = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const is3D = map.getPitch() > 0;
    if (is3D) {
      map.setPitch(0);
      map.setRotation(0);
    } else {
      map.setPitch(60);
      map.setRotation(0);
    }
  }, []);

  const handleLocate = useCallback(() => {
    const map = mapRef.current;
    const amap = amapRef.current;
    if (!map || !amap) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        // 浏览器 Geolocation 返回 WGS-84，与高德底图（GCJ-02）对齐后再定位。
        const [lng, lat] = wgs84ToGcj02(longitude, latitude);
        map.setZoomAndCenter(14, { lng, lat }, false);
        handlers?.onGeolocate?.(longitude, latitude);
      },
      () => {
        // 忽略定位失败
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [handlers]);

  const memoZoomBtn = useMemo(
    () => (
      <m.div
        className="absolute right-[calc(env(safe-area-inset-right)+1rem)] bottom-[calc(env(safe-area-inset-bottom)+6rem)] z-40 flex flex-col gap-3"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <button
          type="button"
          onClick={handleToggle3D}
          className="bg-material-thick border-fill-tertiary hover:bg-fill-secondary flex h-12 w-12 items-center justify-center rounded-xl border shadow-xl backdrop-blur-2xl"
          aria-label="3D 视角"
          title="3D 视角"
        >
          <i
            className="i-mingcute-cube-3d-line text-text size-5"
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          onClick={handleLocate}
          className="bg-material-thick border-fill-tertiary hover:bg-fill-secondary flex h-12 w-12 items-center justify-center rounded-xl border shadow-xl backdrop-blur-2xl"
          aria-label={t("explore.controls.locate")}
          title={t("explore.controls.locate")}
        >
          <i
            className="i-mingcute-location-fill text-text size-5"
            aria-hidden="true"
          />
        </button>
      </m.div>
    ),
    [handleToggle3D, handleLocate, t],
  );

  return (
    <div className={`relative ${className}`} style={style}>
      <div
        ref={containerRef}
        id={id}
        className="h-full w-full"
        data-testid="amap-container"
      />
      {isMapReady && amapRef.current && mapRef.current && (
        <>
          <AMapSearchBox amap={amapRef.current} map={mapRef.current} />
          {displayMode === "regions" && (
            <AMapDistrictBoundary
              amap={amapRef.current}
              map={mapRef.current}
              regions={regions}
            />
          )}
          {memoZoomBtn}
          <AMapLegend displayMode={displayMode} />
          {displayMode === "photos" && photoDates && timeRange && (
            <AMapTimeline
              min={photoDates.min}
              max={photoDates.max}
              value={timeRange}
              onChange={setTimeRange}
            />
          )}
        </>
      )}
    </div>
  );
};
