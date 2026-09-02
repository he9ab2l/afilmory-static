/**
 * 高德地图 JS API v2.0 加载与配置。
 * - 通过官方 @amap/amap-jsapi-loader 按需加载，保证与 Vite 打包兼容。
 * - key / 安全密钥来自 siteConfig（构建期由 site.config.build.ts 从 env 注入）。
 * - 高德要求 2021-12-02 后申请的 key 必须配合 securityJsCode 使用。
 */
import AMapLoader from "@amap/amap-jsapi-loader";

import { siteConfig } from "~/config";

import type { AMapSDK } from "./amap-types";

export interface AMapConfig {
  key: string;
  securityJsCode?: string;
  version?: string;
}

/** 高德要求的安全密钥全局配置（window 上的 typed seam）。 */
interface AMapGlobal {
  _AMapSecurityConfig?: {
    securityJsCode?: string;
  };
}
let cachedConfig: AMapConfig | null = null;

/** 获取高德配置；key 缺失时返回 null（地图禁用）。 */
export const getAMapConfig = (): AMapConfig | null => {
  if (cachedConfig) return cachedConfig;
  const key = siteConfig.amapKey?.trim();
  if (!key) return null;
  cachedConfig = {
    key,
    securityJsCode: siteConfig.amapSecurityCode?.trim(),
    version: "2.0",
  };
  return cachedConfig;
};

let loadPromise: Promise<AMapSDK> | null = null;
/**
 * 加载高德 AMap 命名空间（singleton）。
 * 在调用 AMapLoader.load 之前必须设置安全密钥 window._AMapSecurityConfig。
 */
export const loadAMap = (): Promise<AMapSDK> => {
  if (loadPromise) return loadPromise;

  const config = getAMapConfig();
  if (!config) {
    loadPromise = Promise.reject(
      new Error("[amap] AMAP_JS_KEY 未配置，地图不可用"),
    );
    return loadPromise;
  }

  // 安全密钥：高德要求在任何 AMap API 调用前设置。
  if (config.securityJsCode) {
    const amapGlobal = window as AMapGlobal;
    amapGlobal._AMapSecurityConfig = {
      securityJsCode: config.securityJsCode,
    };
  }

  loadPromise = AMapLoader.load({
    key: config.key,
    version: config.version ?? "2.0",
    plugins: [
      "AMap.Scale",
      "AMap.ToolBar",
      "AMap.PlaceSearch",
      "AMap.Geocoder",
      "AMap.DistrictSearch",
      "AMap.Geolocation",
      "AMap.MarkerCluster",
    ],
  }).catch((error: unknown) => {
    // 失败后允许重试
    loadPromise = null;
    throw error;
  });

  return loadPromise;
};

/** 重置加载单例（测试用）。 */
export const resetAMapLoader = (): void => {
  loadPromise = null;
  cachedConfig = null;
};
