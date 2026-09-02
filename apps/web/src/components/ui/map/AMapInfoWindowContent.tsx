import { GlassButton } from "@afilmory/ui";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";

import { ThumbnailImage } from "~/components/ui/ThumbnailImage";
import { getPhotoAccessibleLabel } from "~/lib/photo-accessibility";
import { getPhotoDate } from "~/lib/photo-date";
import { buildPhotoDetailPathname } from "~/lib/photo-detail-route";
import { buildPhotoDetailSearch } from "~/lib/return-to";
import type { PhotoMarker } from "~/types/map";

interface AMapInfoWindowContentProps {
  marker: PhotoMarker;
  onClose?: () => void;
}

/**
 * 照片标记弹窗内容。挂载到 AMap.InfoWindow 的 content DOM 节点。
 */
export const AMapInfoWindowContent = ({
  marker,
  onClose,
}: AMapInfoWindowContentProps) => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;
  const photoLabel = getPhotoAccessibleLabel(marker.photo, t, i18n.language);
  const latitudeDirection =
    marker.latitudeRef === "S"
      ? t("explore.coordinates.south")
      : t("explore.coordinates.north");
  const longitudeDirection =
    marker.longitudeRef === "W"
      ? t("explore.coordinates.west")
      : t("explore.coordinates.east");

  return (
    <div className="amap-info-window w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-black/10 bg-white/95 shadow-xl backdrop-blur-2xl">
      <div className="relative">
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

        {/* Photo header */}
        <div className="relative h-32 overflow-hidden">
          <ThumbnailImage
            photoId={marker.photo.id}
            src={marker.photo.thumbnailUrl || marker.photo.originalUrl}
            alt=""
            width={marker.photo.width}
            height={marker.photo.height}
            thumbHash={marker.photo.thumbHash}
            containerClassName="h-full w-full"
            imageClassName="h-full w-full object-cover"
            loadPolicy="in-view"
            rootMargin="200px"
            threshold={0.1}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>

        {/* Content */}
        <div className="space-y-3 p-4">
          <Link
            to={{
              pathname: buildPhotoDetailPathname(marker.photo.id),
              search: buildPhotoDetailSearch(returnTo),
            }}
            className="group/link hover:text-blue flex items-center gap-2 transition-colors"
          >
            <h3
              className="text-text flex-1 truncate text-sm font-semibold"
              title={photoLabel}
            >
              {photoLabel}
            </h3>
            <i
              className="i-mingcute-arrow-right-line text-text-secondary transition-transform group-hover/link:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>

          <div className="space-y-2">
            {marker.photo.exif?.DateTimeOriginal && (
              <div className="text-text-secondary flex items-center gap-2 text-xs">
                <i
                  className="i-mingcute-calendar-line text-sm"
                  aria-hidden="true"
                />
                <span>
                  {getPhotoDate(marker.photo).toLocaleDateString(
                    i18n.language,
                    {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    },
                  )}
                </span>
              </div>
            )}

            {marker.photo.exif?.Make && marker.photo.exif?.Model && (
              <div className="text-text-secondary flex items-center gap-2 text-xs">
                <i
                  className="i-mingcute-camera-line text-sm"
                  aria-hidden="true"
                />
                <span className="truncate">
                  {marker.photo.exif.Make} {marker.photo.exif.Model}
                </span>
              </div>
            )}

            <div className="text-text-secondary space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <i
                  className="i-mingcute-location-line text-sm"
                  aria-hidden="true"
                />
                <span className="font-mono">
                  <span>
                    {Math.abs(marker.latitude).toFixed(4)}°{latitudeDirection}
                  </span>
                  <span>, </span>
                  <span>
                    {Math.abs(marker.longitude).toFixed(4)}°{longitudeDirection}
                  </span>
                </span>
              </div>
              {marker.altitude !== undefined && (
                <div className="flex items-center gap-2">
                  <i
                    className="i-mingcute-mountain-2-line text-sm"
                    aria-hidden="true"
                  />
                  <span className="font-mono">
                    <span>
                      {marker.altitudeRef === "Below Sea Level" ? "-" : ""}
                    </span>
                    <span>{Math.abs(marker.altitude).toFixed(1)}</span>
                    <span>m</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
