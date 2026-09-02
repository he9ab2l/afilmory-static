import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MiniMap } from "../MiniMap";

vi.mock("react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockDestroy = vi.fn();
const mockLoadAMap = vi.fn();

vi.mock("~/lib/amap/amap-loader", () => ({
  loadAMap: () => mockLoadAMap(),
}));

const createMockAMap = () => ({
  Map: class {
    constructor() {
      // 容器已挂载
    }
    destroy() {
      mockDestroy();
    }
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadAMap.mockResolvedValue(createMockAMap());
});

afterEach(() => {
  cleanup();
});

describe("MiniMap", () => {
  it("renders when one coordinate is zero but the GPS pair is still valid", async () => {
    render(<MiniMap latitude={0} longitude={120.5} photoId="photo-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("minimap-container")).not.toBeNull();
    });
    expect(mockLoadAMap).toHaveBeenCalled();
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "/explore?photoId=photo-1",
    );
  });

  it("encodes photo ids before placing them in the explore query string", async () => {
    render(<MiniMap latitude={30} longitude={120.5} photoId="a&b#c" />);

    await waitFor(() => {
      expect(screen.getByTestId("minimap-container")).not.toBeNull();
    });

    const href = screen.getByRole("link").getAttribute("href");
    expect(href).toBe("/explore?photoId=a%26b%23c");
    expect(
      new URL(href!, "https://example.test").searchParams.get("photoId"),
    ).toBe("a&b#c");
  });
});
