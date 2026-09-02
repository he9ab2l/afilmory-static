import { useTranslation } from "react-i18next";

import type { MapDisplayMode } from "~/types/map";

interface AMapLegendProps {
  displayMode: MapDisplayMode;
}

/**
 * 地图图例：说明照片点 / 区域点 / 聚合圈 / 边界填充 的视觉含义。
 * 放在地图左下角，与缩放控件错开。
 */
export const AMapLegend = ({ displayMode }: AMapLegendProps) => {
  const { t } = useTranslation();
  const items = [
    {
      label:
        displayMode === "regions"
          ? t("explore.legend.regionPoint")
          : t("explore.legend.photoPoint"),
      style: {
        background: "#ffffff",
        border: "2px solid #ffffff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
      },
      icon:
        displayMode === "regions"
          ? "i-mingcute-map-pin-fill"
          : "i-mingcute-camera-line",
    },
    {
      label: t("explore.legend.cluster"),
      style: {
        background: "rgba(107,114,128,0.92)",
        border: "2px solid rgba(107,114,128,0.5)",
      },
      icon: "",
    },
    {
      label: t("explore.legend.district"),
      style: {
        background: "rgba(107,114,128,0.18)",
        border: "1.5px dashed rgba(107,114,128,0.6)",
      },
      icon: "",
    },
  ];

  return (
    <div className="bg-material-thick border-fill-tertiary pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-[calc(env(safe-area-inset-left)+1rem)] z-40 max-w-[11rem] rounded-xl border px-3 py-2.5 shadow-xl backdrop-blur-2xl">
      <div className="text-text-secondary mb-2 text-[11px] font-semibold tracking-wide uppercase">
        {t("explore.legend.title")}
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <span
              className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full"
              style={item.style}
            >
              {item.icon && (
                <i
                  className={`${item.icon} text-[9px] text-gray-700`}
                  aria-hidden="true"
                />
              )}
            </span>
            <span className="text-text-secondary text-xs leading-tight">
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
