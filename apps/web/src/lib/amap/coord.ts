/**
 * 高德 JS API 的底图/行政区数据是 GCJ-02 坐标系，而 manifest 里的 GPS 数据
 * （EXIF 原始值）是 WGS-84。所有进入高德 API 的坐标必须在此边界做一次
 * WGS-84 → GCJ-02 转换；反向读取（getCenter/getPosition 等）返回的已是
 * GCJ-02，严禁二次转换。境外坐标在中国界外偏移量为 0，直接透传。
 */

const GCJ_PI = Math.PI;
const GCJ_SEMI_AXIS_A = 6378245;
// 椭球偏心率平方（WGS-84 参考椭球，GCJ-02 偏移模型的权威常量）：
// 这是算法规定的字面量精度，ESLint 的 no-loss-of-precision 误报（JS 双精度
// 本来就只有 ~15 位有效数字，此处保留算法原文以保证与各实现逐位一致）。
// eslint-disable-next-line no-loss-of-precision
const GCJ_EE = 0.00669342162296594323;

/** 中国大致经纬范围（GCJ-02 偏移模型仅在此范围内定义） */
const isOutOfChina = (lng: number, lat: number): boolean =>
  lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;

const transformLatitude = (lng: number, lat: number): number => {
  let result =
    -100 +
    2 * lng +
    3 * lat +
    0.2 * lat * lat +
    0.1 * lng * lat +
    0.2 * Math.sqrt(Math.abs(lng));
  result +=
    ((20 * Math.sin(6 * lng * GCJ_PI) + 20 * Math.sin(2 * lng * GCJ_PI)) * 2) /
    3;
  result +=
    ((20 * Math.sin(lat * GCJ_PI) + 40 * Math.sin((lat / 3) * GCJ_PI)) * 2) / 3;
  result +=
    ((160 * Math.sin((lat / 12) * GCJ_PI) +
      320 * Math.sin((lat * GCJ_PI) / 30)) *
      2) /
    3;
  return result;
};

const transformLongitude = (lng: number, lat: number): number => {
  let result =
    300 +
    lng +
    2 * lat +
    0.1 * lng * lng +
    0.1 * lng * lat +
    0.1 * Math.sqrt(Math.abs(lng));
  result +=
    ((20 * Math.sin(6 * lng * GCJ_PI) + 20 * Math.sin(2 * lng * GCJ_PI)) * 2) /
    3;
  result +=
    ((20 * Math.sin(lng * GCJ_PI) + 40 * Math.sin((lng / 3) * GCJ_PI)) * 2) / 3;
  result +=
    ((150 * Math.sin((lng / 12) * GCJ_PI) +
      300 * Math.sin((lng / 30) * GCJ_PI)) *
      2) /
    3;
  return result;
};

/**
 * WGS-84 → GCJ-02。境外（含绝大多数海外照片）无偏移，原样返回；
 * 入参出参均为 [longitude, latitude]。
 */
export const wgs84ToGcj02 = (lng: number, lat: number): [number, number] => {
  if (isOutOfChina(lng, lat)) return [lng, lat];

  const dLat = transformLatitude(lng - 105, lat - 35);
  const dLng = transformLongitude(lng - 105, lat - 35);
  const radLat = (lat / 180) * GCJ_PI;
  let magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  const offsetLat =
    (dLat * 180) /
    (((GCJ_SEMI_AXIS_A * (1 - GCJ_EE)) / (magic * sqrtMagic)) * GCJ_PI);
  const offsetLng =
    (dLng * 180) / ((GCJ_SEMI_AXIS_A / sqrtMagic) * Math.cos(radLat) * GCJ_PI);
  return [lng + offsetLng, lat + offsetLat];
};

/** 经纬度载体：marker、区域中心、地图 center 等共用同一转换入口。 */
export interface GpsLike {
  longitude: number;
  latitude: number;
}

/** 把任意带经纬度的对象（PhotoMarker / GeographicRegion / 视图状态）转到 GCJ-02。 */
export const toGcj02Point = <T extends GpsLike>(point: T): T => {
  const [lng, lat] = wgs84ToGcj02(point.longitude, point.latitude);
  return { ...point, longitude: lng, latitude: lat };
};

/** 批量转换（marker / region 集合进入聚合层前统一走这里）。 */
export const toGcj02Points = <T extends GpsLike>(points: readonly T[]): T[] =>
  points.map(toGcj02Point);
