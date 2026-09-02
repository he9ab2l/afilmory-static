import { buildGeoRegionId } from "@afilmory/schema/geo";
import { GlassButton } from "@afilmory/ui";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { gallerySettingAtom } from "~/atoms/app";
import { buildGalleryFilterSearch } from "~/lib/gallery-filter-url";
import { getRegionDisplayName } from "~/lib/geo-regions";
import type { GeographicRegion } from "~/types/map";

import { ClusterPhotoGrid } from "./ClusterPhotoGrid";

interface AMapRegionInfoWindowContentProps {
  region: GeographicRegion;
  onClose?: () => void;
}

const getGalleryFilterTarget = (region: GeographicRegion) => {
  if (region.level === "country") {
    return {
      key: "selectedGeoCountries",
      id: region.id,
    } as const;
  }
  if (region.level === "city") {
    return {
      key: "selectedGeoCities",
      id: region.id,
    } as const;
  }
  if (region.level === "district") {
    const cityId = buildGeoRegionId(region.adminPath, "city");
    if (cityId) {
      return {
        key: "selectedGeoCities",
        id: cityId,
      } as const;
    }
  }
  return null;
};

export const AMapRegionInfoWindowContent = ({
  region,
  onClose,
}: AMapRegionInfoWindowContentProps) => {
  const { t, i18n } = useTranslation();
  const gallerySetting = useAtomValue(gallerySettingAtom);
  const navigate = useNavigate();
  const displayName = getRegionDisplayName(region, i18n.language);
  const filterTarget = getGalleryFilterTarget(region);

  const handleFilterRegion = () => {
    if (!filterTarget) return;
    const nextGallerySetting = {
      ...gallerySetting,
      [filterTarget.key]: Array.from(
        new Set([...gallerySetting[filterTarget.key], filterTarget.id]),
      ),
    };
    navigate({
      pathname: "/",
      search: buildGalleryFilterSearch("", nextGallerySetting),
    });
  };

  return (
    <div className="amap-info-window w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-black/10 bg-white/95 p-0 shadow-xl backdrop-blur-2xl">
      <div className="relative space-y-3 p-4">
        {onClose && (
          <GlassButton
            className="absolute top-3 right-3 z-10 size-9"
            onClick={onClose}
            aria-label={t("common.close")}
            title={t("common.close")}
          >
            <i className="i-mingcute-close-line text-lg" aria-hidden="true" />
          </GlassButton>
        )}
        <div className="pr-14">
          <div className="text-text text-sm font-semibold">{displayName}</div>
          <div className="text-text-secondary mt-1 text-xs">
            {t("explore.region.summary", { count: region.photoCount })}
          </div>
        </div>
        <ClusterPhotoGrid photos={region.markers} />
        {filterTarget && (
          <button
            type="button"
            onClick={handleFilterRegion}
            className="focus-visible:ring-accent/45 bg-accent focus-visible:ring-offset-background h-11 w-full rounded-lg px-3 text-xs font-semibold text-[var(--color-accent-content)] transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            {t("explore.region.filter")}
          </button>
        )}
      </div>
    </div>
  );
};
