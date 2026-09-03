import { GlassButton } from "@afilmory/ui";
import { startTransition } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

export const MapBackButton = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const handleBack = () => {
    startTransition(() => {
      const fallbackSearchParams = new URLSearchParams(location.search);
      fallbackSearchParams.delete("photoId");
      fallbackSearchParams.delete("returnTo");

      navigate(
        {
          pathname: "/",
          search: fallbackSearchParams.toString()
            ? `?${fallbackSearchParams.toString()}`
            : "",
        },
        { replace: true },
      );
    });
    // 无障碍：图库列表（(main) 布局的 main#main-content，常驻挂载）在地图下方，
    // 返回后把焦点显式送回列表，读屏/键盘用户不必从头 Tab 定位。
    // preventScroll：列表滚动位置本就保留，聚焦不能把它拽回顶部。
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>("#main-content")
        ?.focus({ preventScroll: true });
    });
  };

  return (
    <GlassButton
      className="absolute top-[calc(env(safe-area-inset-top)+1rem)] left-[calc(env(safe-area-inset-left)+1rem)] z-50 size-12"
      onClick={handleBack}
      aria-label={t("explore.back.to.gallery")}
      title={t("explore.back.to.gallery")}
    >
      <i
        className="i-mingcute-arrow-left-line text-base text-white"
        aria-hidden="true"
      />
    </GlassButton>
  );
};
