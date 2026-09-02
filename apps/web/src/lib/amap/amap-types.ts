/**
 * AMap JS API v2.0 类型声明（仅覆盖本项目用到的 API 子集）。
 * 高德官方未提供完整 TS 类型，这里按需声明，避免 any 泛滥。
 */

export interface AMapLngLat {
  lng: number;
  lat: number;
  /** 返回经度 */
  getLng: () => number;
  /** 返回纬度 */
  getLat: () => number;
}

export interface AMapLngLatLike {
  lng: number;
  lat: number;
}

export interface AMapBounds {
  getSouthWest: () => AMapLngLat;
  getNorthEast: () => AMapLngLat;
}

export interface AMapMapInstance {
  /** 容器 DOM */
  getContainer: () => HTMLDivElement;
  getZoom: () => number;
  getCenter: () => AMapLngLat;
  getPitch: () => number;
  getRotation: () => number;
  setZoom: (zoom: number) => void;
  setCenter: (lngLat: AMapLngLatLike) => void;
  setPitch: (pitch: number) => void;
  setRotation: (rotation: number) => void;
  setMapStyle: (style: string) => void;
  setFitView: (
    overlays: Array<{
      getPosition?: () => AMapLngLatLike;
      getBounds?: () => AMapBounds;
    }>,
    immediately?: boolean,
    avoid?: number[],
    maxZoom?: number,
  ) => void;
  setBounds: (bounds: AMapBounds, immediately?: boolean) => void;
  setZoomAndCenter: (
    zoom: number,
    center?: AMapLngLatLike,
    immediately?: boolean,
  ) => void;
  addControl: (control: unknown) => void;
  removeControl: (control: unknown) => void;
  add: (overlay: unknown) => void;
  remove: (overlay: unknown) => void;
  on: (event: string, handler: (event?: AMapMapEvent) => void) => void;
  off: (event: string, handler: (event?: AMapMapEvent) => void) => void;
  destroy: () => void;
}

export interface AMapMapEvent {
  lnglat?: AMapLngLat;
  target?: unknown;
  type?: string;
}

export interface AMapMarkerInstance {
  setMap: (map: AMapMapInstance | null) => void;
  setContent: (content: string | HTMLElement) => void;
  setPosition: (lngLat: AMapLngLatLike) => void;
  getPosition: () => AMapLngLat;
  on: (event: string, handler: (event?: AMapMapEvent) => void) => void;
  off: (event: string, handler: (event?: AMapMapEvent) => void) => void;
  getOffset: () => AMapPixel;
  setLabel: (label?: { content?: string }) => void;
  remove: () => void;
  getExtData?: <T>() => T;
  setExtData?: <T>(data: T) => void;
}

export interface AMapPixel {
  x: number;
  y: number;
}

export interface AMapMarkerClusterInstance {
  setMap: (map: AMapMapInstance | null) => void;
  setMarkers: (markers: AMapMarkerInstance[]) => void;
  getMarkers: () => AMapMarkerInstance[];
  on: (event: string, handler: (event?: AMapMapEvent) => void) => void;
  off: (event: string, handler: (event?: AMapMapEvent) => void) => void;
}

export interface AMapInfoWindowInstance {
  open: (
    map: AMapMapInstance,
    position: AMapLngLatLike | [number, number],
  ) => void;
  close: () => void;
  setContent: (content: string | HTMLElement) => void;
  setPosition: (position: AMapLngLatLike | [number, number]) => void;
  on: (event: string, handler: (event?: AMapMapEvent) => void) => void;
}

export interface AMapMapOptions {
  viewMode?: "2D" | "3D";
  zoom?: number;
  center?: [number, number];
  pitch?: number;
  rotation?: number;
  mapStyle?: string;
  showLabel?: boolean;
  features?: ("bg" | "road" | "building" | "point")[];
  zooms?: [number, number];
}

export interface AMapMarkerOptions {
  position?: AMapLngLatLike | [number, number];
  content?: string | HTMLElement;
  anchor?: string;
  offset?: AMapPixel;
  map?: AMapMapInstance;
  extData?: unknown;
  zIndex?: number;
  cursor?: string;
}

export interface AMapMarkerClusterOptions {
  gridSize?: number;
  minClusterSize?: number;
  maxZoom?: number;
  zoomOnClick?: boolean;
  renderClusterMarker?: (context: {
    count: number;
    markers: AMapMarkerInstance[];
    marker: AMapMarkerInstance;
  }) => void | string | HTMLElement;
  renderMarker?: (context: {
    marker: AMapMarkerInstance;
    data: unknown;
  }) => void | string | HTMLElement;
}

export interface AMapInfoWindowOptions {
  isCustom?: boolean;
  content?: string | HTMLElement;
  offset?: AMapPixel;
  autoMove?: boolean;
  closeWhenClickMap?: boolean;
}

/** 高德 SDK 命名空间（loadAMap 的返回值）。 */
export interface AMapSDK {
  Map: new (
    container: string | HTMLElement,
    options?: AMapMapOptions,
  ) => AMapMapInstance;
  Marker: new (options?: AMapMarkerOptions) => AMapMarkerInstance;
  MarkerCluster: new (
    map: AMapMapInstance,
    points?: Array<{ lnglat: number[] } & Record<string, unknown>>,
    options?: AMapMarkerClusterOptions,
  ) => AMapMarkerClusterInstance;
  InfoWindow: new (options?: AMapInfoWindowOptions) => AMapInfoWindowInstance;
  LngLat: new (lng: number, lat: number) => AMapLngLat;
  Bounds: new (
    southWest: AMapLngLatLike,
    northEast: AMapLngLatLike,
  ) => AMapBounds;
  Pixel: new (x: number, y: number) => AMapPixel;
  Scale: new (options?: Record<string, unknown>) => unknown;
  ToolBar: new (options?: Record<string, unknown>) => unknown;
  Geolocation: new (options?: Record<string, unknown>) => unknown;
  PlaceSearch: new (
    options?: Record<string, unknown>,
  ) => AMapPlaceSearchInstance;
  Geocoder: new (options?: Record<string, unknown>) => unknown;
  DistrictSearch: new (
    options?: Record<string, unknown>,
  ) => AMapDistrictSearchInstance;
  Polygon: new (options?: AMapPolygonOptions) => AMapPolygonInstance;
  DistrictLayer: {
    Country: new (options?: Record<string, unknown>) => unknown;
    Province: new (options?: Record<string, unknown>) => unknown;
    City: new (options?: Record<string, unknown>) => unknown;
    District: new (options?: Record<string, unknown>) => unknown;
  };
}

export interface AMapPlaceSearchPoi {
  name: string;
  location: AMapLngLat;
  adname?: string;
  cityname?: string;
  address?: string;
}

export interface AMapPlaceSearchInstance {
  search: (
    keyword: string,
    callback: (
      status: string,
      result?: { poiList?: { pois?: AMapPlaceSearchPoi[] } },
    ) => void,
  ) => void;
}

export interface AMapPolygonOptions {
  path?: AMapLngLat[] | AMapLngLat[][];
  strokeColor?: string;
  strokeWeight?: number;
  strokeOpacity?: number;
  fillColor?: string;
  fillOpacity?: number;
  zIndex?: number;
}

export interface AMapPolygonInstance {
  setMap: (map: AMapMapInstance | null) => void;
}

export interface AMapDistrictSearchResult {
  districtList?: Array<{ boundaries?: AMapLngLat[][] }>;
}

export interface AMapDistrictSearchInstance {
  search: (
    name: string,
    callback: (status: string, result?: AMapDistrictSearchResult) => void,
  ) => void;
}
