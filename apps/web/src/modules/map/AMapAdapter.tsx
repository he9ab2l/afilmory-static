/* eslint-disable react-refresh/only-export-components */

import { lazy } from "react";

import type { BaseMapProps } from "~/types/map";

import type { MapAdapter } from "./map-context";

const AMapMapLazy = lazy(() =>
  import("~/components/ui/map/AMapMap").then((m) => ({
    default: m.AMapMap,
  })),
);

/**
 * 高德地图（AMap JS API v2.0）适配器。
 * 通过 provider 抽象层接入 GenericMap，替换原 MapLibre 实现。
 */
export class AMapMapAdapter implements MapAdapter {
  name = "amap";

  readonly isAvailable: boolean = true;

  MapComponent = AMapMapComponent;

  async initialize(): Promise<void> {
    // AMap 通过 amap-loader 按需加载，无需额外初始化。
  }

  cleanup(): void {
    // AMapMap 组件卸载时自行销毁地图实例。
  }
}

export const AMapMapComponent: React.FC<BaseMapProps> = (props) => (
  <AMapMapLazy {...props} />
);

export const createAMapAdapter = (): MapAdapter => {
  return new AMapMapAdapter();
};
