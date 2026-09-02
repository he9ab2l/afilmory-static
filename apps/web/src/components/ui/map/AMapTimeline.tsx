import { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface AMapTimelineProps {
  /** 数据最早时间戳（ms） */
  min: number;
  /** 数据最晚时间戳（ms） */
  max: number;
  /** 当前范围 [start, end]（ms） */
  value: [number, number];
  onChange: (range: [number, number]) => void;
}

const fmt = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * 时间轴：双滑块选择照片拍摄时间范围。
 * 放在地图底部居中，仅照片模式显示。
 */
export const AMapTimeline = ({
  min,
  max,
  value,
  onChange,
}: AMapTimelineProps) => {
  const { t } = useTranslation();
  const [start, end] = value;

  const styles = useMemo(() => {
    const range = Math.max(1, max - min);
    const left = ((start - min) / range) * 100;
    const right = 100 - ((end - min) / range) * 100;
    return { left: `${left}%`, right: `${right}%` };
  }, [min, max, start, end]);

  return (
    <div className="bg-material-thick border-fill-tertiary absolute bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 z-40 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border px-5 pt-3 pb-2 shadow-xl backdrop-blur-2xl">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-text-secondary text-[11px] font-semibold tracking-wide uppercase">
          {t("explore.timeline.title")}
        </span>
        <span className="text-text-tertiary font-mono text-[11px]">
          {fmt(start)} — {fmt(end)}
        </span>
      </div>

      <div className="relative h-6">
        {/* 轨道 */}
        <div className="bg-fill-secondary absolute top-1/2 right-0 left-0 h-1 -translate-y-1/2 rounded-full" />
        {/* 选中区间 */}
        <div
          className="bg-accent/70 absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
          style={{ left: styles.left, right: styles.right }}
        />

        {/* 起始滑块 */}
        <input
          type="range"
          min={min}
          max={max}
          step={86400000}
          value={start}
          onChange={(e) =>
            onChange([Math.min(Number(e.target.value), end - 86400000), end])
          }
          className="timeline-range pointer-events-none absolute inset-0 m-0 h-full w-full appearance-none bg-transparent"
          aria-label={t("explore.timeline.start")}
        />
        {/* 结束滑块 */}
        <input
          type="range"
          min={min}
          max={max}
          step={86400000}
          value={end}
          onChange={(e) =>
            onChange([
              start,
              Math.max(Number(e.target.value), start + 86400000),
            ])
          }
          className="timeline-range pointer-events-none absolute inset-0 m-0 h-full w-full appearance-none bg-transparent"
          aria-label={t("explore.timeline.end")}
        />
      </div>
    </div>
  );
};
