import { useState } from "react";
import { useTranslation } from "react-i18next";

import type {
  AMapMapInstance,
  AMapPlaceSearchInstance,
  AMapPlaceSearchPoi,
  AMapSDK,
} from "~/lib/amap/amap-types";

interface AMapSearchBoxProps {
  amap: AMapSDK;
  map: AMapMapInstance;
}

/**
 * 地名搜索定位（高德 PlaceSearch）。
 * 输入地名 → 下拉结果 → 选择后飞行定位。
 */
export const AMapSearchBox = ({ amap, map }: AMapSearchBoxProps) => {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [pois, setPois] = useState<AMapPlaceSearchPoi[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  const handleSearch = (value: string) => {
    setKeyword(value);
    if (!value.trim()) {
      setPois([]);
      setOpen(false);
      return;
    }
    setSearching(true);
    const placeSearch = new amap.PlaceSearch({
      pageSize: 6,
      pageIndex: 1,
      extensions: "all",
    }) as AMapPlaceSearchInstance;
    placeSearch.search(value, (status, result) => {
      setSearching(false);
      if (status === "complete" && result?.poiList?.pois) {
        setPois(result.poiList.pois);
        setOpen(true);
      } else {
        setPois([]);
        setOpen(false);
      }
    });
  };

  const handleSelect = (poi: AMapPlaceSearchPoi) => {
    setOpen(false);
    setKeyword(poi.name);
    const lnglat = poi.location;
    if (lnglat) {
      map.setZoomAndCenter(13, { lng: lnglat.lng, lat: lnglat.lat }, false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleSearch(keyword);
    }
    if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="absolute top-[calc(env(safe-area-inset-top)+1rem)] left-1/2 z-50 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2">
      <div className="bg-material-thick border-fill-tertiary flex items-center gap-2 rounded-xl border px-3 shadow-xl backdrop-blur-2xl">
        <i
          className="i-mingcute-search-line text-text-secondary flex-shrink-0"
          aria-hidden="true"
        />
        <input
          type="text"
          value={keyword}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("explore.search.placeholder")}
          aria-label={t("explore.search.placeholder")}
          className="text-text placeholder:text-text-tertiary h-11 w-full bg-transparent text-sm outline-none"
        />
        {searching && (
          <span className="text-text-tertiary flex-shrink-0 text-xs">
            {t("explore.search.searching")}
          </span>
        )}
      </div>

      {open && pois.length > 0 && (
        <ul className="bg-material-thick border-fill-tertiary mt-1.5 overflow-hidden rounded-xl border shadow-xl backdrop-blur-2xl">
          {pois.map((poi, index) => {
            const key = `${poi.name}-${poi.location?.lng ?? index}-${poi.location?.lat ?? index}`;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => handleSelect(poi)}
                  className="text-text-secondary hover:bg-fill-secondary flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs transition-colors"
                >
                  <i
                    className="i-mingcute-location-line flex-shrink-0"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="text-text block truncate text-sm font-medium">
                      {poi.name}
                    </span>
                    {poi.adname && (
                      <span className="text-text-tertiary block truncate">
                        {[poi.cityname, poi.adname].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
