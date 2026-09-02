import { useEffect, useRef } from "react";

import type {
  AMapDistrictSearchInstance,
  AMapMapInstance,
  AMapPolygonInstance,
  AMapSDK,
} from "~/lib/amap/amap-types";
import type { GeographicRegion } from "~/types/map";

/**
 * 中国省级行政区英文名（Mapbox/Nominatim 反查产物）→ 高德中文名。
 * 高德 DistrictSearch 按中文名/adcode 检索行政区边界。
 */
const CN_PROVINCE_NAMES: Record<string, string> = {
  beijing: "北京市",
  shanghai: "上海市",
  tianjin: "天津市",
  chongqing: "重庆市",
  guangdong: "广东省",
  zhejiang: "浙江省",
  sichuan: "四川省",
  shaanxi: "陕西省",
  yunnan: "云南省",
  tibet: "西藏自治区",
  "tibet autonomous region": "西藏自治区",
  xinjiang: "新疆维吾尔自治区",
  "xinjiang uygur": "新疆维吾尔自治区",
  hainan: "海南省",
  fujian: "福建省",
  jiangsu: "江苏省",
  jiangxi: "江西省",
  anhui: "安徽省",
  hunan: "湖南省",
  hubei: "湖北省",
  henan: "河南省",
  hebei: "河北省",
  shandong: "山东省",
  shanxi: "山西省",
  liaoning: "辽宁省",
  jilin: "吉林省",
  heilongjiang: "黑龙江省",
  guizhou: "贵州省",
  guangxi: "广西壮族自治区",
  "guangxi zhuang": "广西壮族自治区",
  gansu: "甘肃省",
  qinghai: "青海省",
  ningxia: "宁夏回族自治区",
  "inner mongolia": "内蒙古自治区",
  "hong kong": "香港特别行政区",
  macau: "澳门特别行政区",
  macao: "澳门特别行政区",
  taiwan: "台湾省",
};

const isChinaRegion = (region: GeographicRegion): boolean => {
  const code = region.adminPath.countryCode?.toUpperCase();
  const country = region.adminPath.country ?? "";
  return code === "CN" || /中国|China|Chinese/i.test(country);
};

/** 解析区域的中文行政区名（用于 DistrictSearch） */
const resolveDistrictName = (region: GeographicRegion): string | null => {
  if (region.level === "country") return null; // 国家级不填充（数据量大）
  const raw = region.label?.trim().toLowerCase();
  if (!raw) return null;
  if (/[\u4e00-\u9fff]/.test(raw)) return region.label; // 已是中文
  return CN_PROVINCE_NAMES[raw] ?? null;
};

interface AMapDistrictBoundaryProps {
  amap: AMapSDK;
  map: AMapMapInstance;
  /** 当前 regionLevel 的区域集合 */
  regions: GeographicRegion[];
}

/**
 * 行政边界填充：对"有照片"的中国省份/直辖市，用高德 DistrictSearch 取边界
 * 并以 Polygon 半透明填充，形成区域轮廓。国外国家边界由高德底图自带。
 */
export const AMapDistrictBoundary = ({
  amap,
  map,
  regions,
}: AMapDistrictBoundaryProps) => {
  const polygonRef = useRef<AMapPolygonInstance[]>([]);

  useEffect(() => {
    if (!amap || !map) return;
    let cancelled = false;

    // 清空上一轮 polygon
    polygonRef.current.forEach((polygon) => polygon.setMap(null));
    polygonRef.current = [];

    const cnRegions = regions.filter(isChinaRegion);
    cnRegions.forEach((region) => {
      const name = resolveDistrictName(region);
      if (!name) return;

      const districtSearch = new amap.DistrictSearch({
        subdistrict: 0,
        extensions: "all",
      }) as AMapDistrictSearchInstance;

      districtSearch.search(name, (status, result) => {
        if (cancelled) return;
        if (status === "complete" && result?.districtList?.length) {
          const { boundaries } = result.districtList[0];
          boundaries?.forEach((path) => {
            if (!path || path.length === 0) return;
            const polygon = new amap.Polygon({
              path,
              strokeColor: "#6b7280",
              strokeWeight: 2,
              strokeOpacity: 0.7,
              fillColor: "#6b7280",
              fillOpacity: 0.12,
              zIndex: 50,
            });
            polygon.setMap(map);
            polygonRef.current.push(polygon);
          });
        }
      });
    });

    return () => {
      cancelled = true;
      polygonRef.current.forEach((polygon) => polygon.setMap(null));
      polygonRef.current = [];
    };
  }, [amap, map, regions]);

  return null;
};
