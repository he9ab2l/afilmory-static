/**
 * ⚠️ CLIENT-SIDE CONFIGURATION - READ CAREFULLY ⚠️
 *
 * This file is imported by the client-side code (browser).
 * It MUST NOT import 'env.ts' or use 'process.env' directly.
 *
 * - This file defines the static default configuration.
 * - Environment variable overrides are handled in 'site.config.build.ts'.
 * - Client-side code accesses the final config via 'window.__AFILMORY__.config'.
 */

export interface SiteConfig {
  name: string;
  title: string;
  description: string;
  url: string;
  accentColor: string;
  language?: string;
  author: Author;
  social?: Social;
  feed?: Feed;
  map?: MapConfig;
  mapStyle?: string;
  mapProjection?: "globe" | "mercator";
  /** 高德地图 JS API key（构建期从 env 注入） */
  amapKey?: string;
  /** 高德地图安全密钥 securityJsCode（2021-12 后必配） */
  amapSecurityCode?: string;
}

/**
 * Map configuration: `map: ["maplibre"]` enables the map; omitting `map` (or
 * an empty array) disables it. The array form is reserved for future providers.
 */
type MapConfig = ("maplibre" | "amap")[];

interface Feed {
  folo?: {
    challenge?: {
      feedId: string;
      userId: string;
    };
  };
}
interface Author {
  name: string;
  url: string;
  avatar?: string;
}
interface Social {
  twitter?: string;
  github?: string;
  rss?: boolean;
}

export const siteConfig: SiteConfig = {
  name: "heabl photo",
  title: "heabl photo",
  description: "A personal photography website",
  url: "https://afilmory.your.domain/",
  accentColor: "#6b7280",
  language: "en",
  author: {
    name: "Author",
    url: "https://your.domain",
    avatar: "/avatar.webp",
  },
  social: {
    github: "",
    twitter: "",
    rss: false,
  },
  feed: {
    folo: {
      challenge: {
        feedId: "",
        userId: "",
      },
    },
  },
  map: ["amap"],
  mapStyle: "builtin",
  mapProjection: "mercator",
  amapKey: "",
  amapSecurityCode: "",
};

export default siteConfig;
