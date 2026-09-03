import { describe, expect, it } from "vitest";

import { toGcj02Point, wgs84ToGcj02 } from "../amap/coord";

describe("wgs84ToGcj02", () => {
  it("leaves coordinates outside China untouched", () => {
    // 拉斯维加斯以西太平洋点、南极、北美：境外偏移量为 0。
    expect(wgs84ToGcj02(-105.426, 31.192)).toEqual([-105.426, 31.192]);
    expect(wgs84ToGcj02(138.877, 35.419)).toEqual([138.877, 35.419]);
    expect(wgs84ToGcj02(-113.997, 46.878)).toEqual([-113.997, 46.878]);
  });

  it("shifts coordinates inside China by the known GCJ-02 offset", () => {
    // 拉萨（valley_005）29.926, 90.384：GCJ-02 偏移方向随区域变化，
    // 权威算法下为 +0.0017° 经度、−0.0027° 纬度（与 wandergis/coordtransform 一致）。
    const [lng, lat] = wgs84ToGcj02(90.384, 29.926);
    expect(lng).toBeGreaterThan(90.384);
    expect(lat).toBeLessThan(29.926);
    expect(lng - 90.384).toBeGreaterThan(0.001);
    expect(lng - 90.384).toBeLessThan(0.003);
    expect(29.926 - lat).toBeGreaterThan(0.001);
    expect(29.926 - lat).toBeLessThan(0.004);
  });

  it("is stable near the China bounding box edge (passthrough outside)", () => {
    // 日本东京在中国界外，直接透传；境内点（北京）必须有偏移。
    expect(wgs84ToGcj02(139.6917, 35.6895)).toEqual([139.6917, 35.6895]);
    const [lng, lat] = wgs84ToGcj02(116.404, 39.915);
    expect(lng).not.toBe(116.404);
    expect(lat).not.toBe(39.915);
  });
});

describe("toGcj02Point", () => {
  it("converts and preserves the remaining payload of the point", () => {
    const marker = {
      id: "valley_005",
      longitude: 90.384,
      latitude: 29.926,
      photo: { id: "valley_005" },
    };
    const converted = toGcj02Point(marker);
    expect(converted.longitude).not.toBe(marker.longitude);
    expect(converted.latitude).not.toBe(marker.latitude);
    expect(converted.id).toBe("valley_005");
    expect(converted.photo).toBe(marker.photo);
  });
});
