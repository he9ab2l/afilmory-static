import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import type { ThumbnailResult } from "../photo/data-processors.js";
import { getPhotoExecutionContext } from "../photo/execution-context.js";
import { getPhotoProcessingLoggers } from "../photo/logger-adapter.js";
import { writeFileAtomic } from "../utils/atomic-write.js";
import {
  THUMBNAIL_ENCODING_SIGNATURE,
  THUMBNAIL_ENCODING_VERSION,
  THUMBNAIL_QUALITY,
  THUMBNAIL_WIDTH,
} from "./encoding-signature.js";
import { SOURCE_SHARP_OPTIONS } from "./sharp-options.js";
import { generateThumbHash } from "./thumbhash.js";

export {
  THUMBNAIL_ENCODING_SIGNATURE,
  THUMBNAIL_ENCODING_VERSION,
} from "./encoding-signature.js";

const ENCODING_MARKER_FILENAME = ".encoding";

export async function isThumbnailEncodingStale(
  thumbnailsDir: string,
): Promise<boolean> {
  try {
    const marker = await fs.readFile(
      path.join(thumbnailsDir, ENCODING_MARKER_FILENAME),
      "utf-8",
    );
    return marker.trim() !== THUMBNAIL_ENCODING_SIGNATURE;
  } catch (error) {
    // 无标记：目录里既有缩略图的生成参数未知（老缓存），视为过期。
    // 全新空目录也走这条——强制与否等价（每张都按缺失生成），无副作用。
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    // Permission/type/I/O failures are not evidence of a stale marker. Fail
    // before regenerating and committing a manifest that cannot be paired
    // with a valid marker.
    throw error;
  }
}

// 缩略图图像扩展全集：当前编码（.webp）+ 历史遗留编码（.jpg/.jpeg/.avif）。
// 清理路径（孤儿缩略图删除、编码切换清旧文件）要识别任意一代的缩略图文件；
// 复用路径则由 isThumbnailFileNameForPhoto（含编码版本校验）把关，这里不校验版本。
const THUMBNAIL_IMAGE_EXTENSIONS = "webp|jpe?g|avif";
const THUMBNAIL_IMAGE_FILE_PATTERN = new RegExp(
  `\\.(?:${THUMBNAIL_IMAGE_EXTENSIONS})$`,
  "i",
);
// 当前编码版本的缩略图文件名形态（<id>.<sha256>.<version>.webp）。
const CURRENT_ENCODING_THUMBNAIL_PATTERN = new RegExp(
  `^.*\\.[\\da-f]{64}\\.${THUMBNAIL_ENCODING_VERSION}\\.webp$`,
  "i",
);
/** 目录项是否为缩略图图像文件（任意一代编码），供清理路径过滤用。 */
export function isThumbnailImageFileName(fileName: string): boolean {
  return THUMBNAIL_IMAGE_FILE_PATTERN.test(fileName);
}
/**
 * 删除目录里非当前编码版本的缩略图（旧 jpg、旧签名 webp）。签名不一致触发
 * 全量重生成的构建成功收尾时调用——新产物已落盘、marker 已更新，此时删除
 * 旧文件才安全；中途失败不会走到这里，旧缓存原样保留。
 */
export async function pruneThumbnailsWithStaleEncoding(
  thumbnailsDir: string,
): Promise<number> {
  let entries;
  try {
    entries = await fs.readdir(thumbnailsDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }

  const staleNames = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => THUMBNAIL_IMAGE_FILE_PATTERN.test(name))
    .filter((name) => !CURRENT_ENCODING_THUMBNAIL_PATTERN.test(name));

  await Promise.all(
    staleNames.map((name) =>
      fs.rm(path.join(thumbnailsDir, name), { force: true }),
    ),
  );
  return staleNames.length;
}

/** 只写 marker，不做任何清理。独立测试 marker 语义时用。 */
export async function writeThumbnailEncodingMarker(
  thumbnailsDir: string,
): Promise<void> {
  await writeFileAtomic(
    path.join(thumbnailsDir, ENCODING_MARKER_FILENAME),
    `${THUMBNAIL_ENCODING_SIGNATURE}\n`,
  );
}

/**
 * 全量重生成成功后的编码收尾：先写 marker，再清理旧编码缩略图。
 * 顺序不能反——marker 落盘后这次构建才算「新编码成功」，此时删除旧文件
 * 才安全；写 marker 失败（或后续构建失败）旧缓存原样保留，下次构建继续全量重试。
 * 注意：清理必须绑定「重生成真的发生过」，所以入口只有 builder 的 force 收尾，
 * 不能挂到 writeThumbnailEncodingMarker（那里还有测试和增量路径调用，会误删
 * 尚未重生成的旧文件）。
 */
export async function commitThumbnailEncoding(
  thumbnailsDir: string,
): Promise<number> {
  await writeThumbnailEncodingMarker(thumbnailsDir);
  return pruneThumbnailsWithStaleEncoding(thumbnailsDir);
}

// 缩略图统一编码为 WebP（签名见 encoding-signature.ts）；文件名扩展是编码的
// 一部分，改编码必须同步改扩展，让 URL 随编码参数变化。
const THUMBNAIL_FILE_EXTENSION = ".webp";

export function createThumbnailFileName(
  photoId: string,
  thumbnailBuffer: Uint8Array,
): string {
  const contentHash = crypto
    .createHash("sha256")
    .update(thumbnailBuffer)
    .digest("hex");
  return `${photoId}.${contentHash}.${THUMBNAIL_ENCODING_VERSION}${THUMBNAIL_FILE_EXTENSION}`;
}

export function getThumbnailPublicUrl(
  photoId: string,
  thumbnailBuffer?: Uint8Array,
): string {
  const filename = thumbnailBuffer
    ? createThumbnailFileName(photoId, thumbnailBuffer)
    : `${photoId}${THUMBNAIL_FILE_EXTENSION}`;
  return getThumbnailPublicUrlForFileName(filename);
}

export function getThumbnailPublicUrlForFileName(fileName: string): string {
  return `/thumbnails/${encodeURIComponent(fileName)}`;
}

export function getThumbnailFileNameFromUrl(
  thumbnailUrl: string,
): string | null {
  try {
    const { pathname } = new URL(thumbnailUrl, "https://afilmory.invalid");
    const encodedName = pathname.slice(pathname.lastIndexOf("/") + 1);
    if (!encodedName) return null;
    const fileName = decodeURIComponent(encodedName);
    return fileName.includes("/") || fileName.includes("\\") ? null : fileName;
  } catch {
    return null;
  }
}

export function isThumbnailFileNameForPhoto(
  fileName: string,
  photoId: string,
): boolean {
  if (fileName === `${photoId}${THUMBNAIL_FILE_EXTENSION}`) return true;
  if (
    !fileName.startsWith(`${photoId}.`) ||
    !fileName.endsWith(THUMBNAIL_FILE_EXTENSION)
  ) {
    return false;
  }
  const suffix = fileName.slice(
    photoId.length + 1,
    -THUMBNAIL_FILE_EXTENSION.length,
  );
  const [contentHash, encodingVersion, ...extra] = suffix.split(".");
  return (
    extra.length === 0 &&
    /^[\da-f]{64}$/i.test(contentHash ?? "") &&
    /^[\da-f]{12}$/i.test(encodingVersion ?? "")
  );
}

/**
 * 从缩略图文件名提取 photoId，兼容任意一代编码：内容寻址名
 * `<id>.<sha256>.<version>.<ext>` 或 legacy bare 名 `<id>.<ext>`。
 * 不校验编码版本——版本校验由 isThumbnailFileNameForPhoto 负责。
 */
export function getThumbnailPhotoIdFromFileName(
  fileName: string,
): string | null {
  const addressed = new RegExp(
    `^(.*)\\.[\\da-f]{64}\\.[\\da-f]{12}\\.(?:${THUMBNAIL_IMAGE_EXTENSIONS})$`,
    "i",
  ).exec(fileName);
  if (addressed?.[1]) return addressed[1];
  const bare = new RegExp(
    `^(.*)\\.(?:${THUMBNAIL_IMAGE_EXTENSIONS})$`,
    "i",
  ).exec(fileName);
  return bare?.[1] ?? null;
}

export interface ExistingThumbnail {
  fileName: string;
  path: string;
  url: string;
}

export interface ThumbnailInventory {
  has: (photoId: string, preferredUrl?: string) => boolean;
}

/** Snapshot the thumbnail directory once for the planning phase. */
export async function createThumbnailInventory(
  thumbnailsDir: string,
): Promise<ThumbnailInventory> {
  const entries = await fs
    .readdir(thumbnailsDir, { withFileTypes: true })
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
  const safeFileNames = new Set(
    entries.filter((entry) => entry.isFile()).map((entry) => entry.name),
  );
  const countsByPhotoId = new Map<string, number>();
  for (const fileName of safeFileNames) {
    const photoId = getThumbnailPhotoIdFromFileName(fileName);
    if (!photoId) continue;
    countsByPhotoId.set(photoId, (countsByPhotoId.get(photoId) ?? 0) + 1);
  }

  return {
    has(photoId, preferredUrl) {
      const preferredName = preferredUrl
        ? getThumbnailFileNameFromUrl(preferredUrl)
        : null;
      if (
        preferredName &&
        isThumbnailFileNameForPhoto(preferredName, photoId) &&
        safeFileNames.has(preferredName)
      ) {
        return true;
      }
      if (safeFileNames.has(`${photoId}${THUMBNAIL_FILE_EXTENSION}`))
        return true;
      // A rewritten CDN basename is reusable only when exactly one local
      // artifact belongs to this photo; multiple versions are ambiguous.
      return countsByPhotoId.get(photoId) === 1;
    },
  };
}

async function isSafeRegularThumbnail(thumbnailPath: string): Promise<boolean> {
  try {
    const stats = await fs.lstat(thumbnailPath);
    return stats.isFile() && !stats.isSymbolicLink();
  } catch (error) {
    const { code } = error as NodeJS.ErrnoException;
    if (code === "ENOENT" || code === "ENOTDIR") return false;
    throw error;
  }
}

/** Resolve both legacy `<id>.webp` and content-addressed thumbnail caches. */
export async function resolveExistingThumbnail(
  photoId: string,
  thumbnailsDir: string,
  preferredUrl?: string,
): Promise<ExistingThumbnail | null> {
  const preferredName = preferredUrl
    ? getThumbnailFileNameFromUrl(preferredUrl)
    : null;
  const candidates = [
    preferredName,
    `${photoId}${THUMBNAIL_FILE_EXTENSION}`,
  ].filter(
    (candidate, index, all): candidate is string =>
      Boolean(candidate) &&
      all.indexOf(candidate) === index &&
      isThumbnailFileNameForPhoto(candidate!, photoId),
  );

  // Remote thumbnail URLs normally retain the local content-addressed basename,
  // so this is the O(1) path for both local and remote thumbnail storage.
  for (const fileName of candidates) {
    const thumbnailPath = path.join(thumbnailsDir, fileName);
    if (await isSafeRegularThumbnail(thumbnailPath)) {
      return {
        fileName,
        path: thumbnailPath,
        url:
          preferredUrl && fileName === preferredName
            ? preferredUrl
            : getThumbnailPublicUrlForFileName(fileName),
      };
    }
  }

  // A custom remote CDN may rewrite the basename. Discover a local addressed
  // artifact as a fallback. If cleanup was interrupted, multiple versions can
  // coexist and neither lexical hash order nor mtime proves which one matches
  // the manifest. Treat that ambiguity as a cache miss so the caller rebuilds
  // from the source image instead of silently reusing arbitrary pixels.
  try {
    const entries = await fs.readdir(thumbnailsDir);
    const matchingNames = entries.filter((entry) =>
      isThumbnailFileNameForPhoto(entry, photoId),
    );
    const safeNames = (
      await Promise.all(
        matchingNames.map(async (fileName) => ({
          fileName,
          safe: await isSafeRegularThumbnail(
            path.join(thumbnailsDir, fileName),
          ),
        })),
      )
    ).filter(({ safe }) => safe);
    const fileName =
      safeNames.length === 1 ? safeNames[0]?.fileName : undefined;
    return fileName
      ? {
          fileName,
          path: path.join(thumbnailsDir, fileName),
          url: getThumbnailPublicUrlForFileName(fileName),
        }
      : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

// 创建成功结果
function createSuccessResult(
  thumbnailUrl: string,
  thumbnailBuffer: Buffer,
  thumbHash: Uint8Array | null,
): ThumbnailResult {
  return {
    thumbnailUrl,
    thumbnailBuffer,
    thumbHash,
  };
}

// 确保缩略图目录存在
async function ensureThumbnailDir(): Promise<void> {
  const { thumbnailsDir } = getPhotoExecutionContext().output;
  await fs.mkdir(thumbnailsDir, { recursive: true });
}

// 检查缩略图是否存在。
// 目录显式传参：这是唯一同时被两种作用域调用的函数——DiffPlanner 在主进程
// 规划阶段（无照片上下文，取 session.config.output）与照片管道内（取
// 上下文 output）都要用它。
export async function thumbnailExists(
  photoId: string,
  thumbnailsDir: string,
  preferredUrl?: string,
): Promise<boolean> {
  return Boolean(
    await resolveExistingThumbnail(photoId, thumbnailsDir, preferredUrl),
  );
}

// 读取现有缩略图并生成 thumbhash
async function processExistingThumbnail(
  photoId: string,
  preferredUrl?: string,
): Promise<ThumbnailResult | null> {
  const existing = await resolveExistingThumbnail(
    photoId,
    getPhotoExecutionContext().output.thumbnailsDir,
    preferredUrl,
  );
  if (!existing) return null;

  const thumbnailLog = getPhotoProcessingLoggers().thumbnail;
  thumbnailLog.info(`Reusing existing thumbnail: ${photoId}`);

  try {
    const existingBuffer = await fs.readFile(existing.path);
    const thumbHash = await generateThumbHash(existingBuffer);

    return createSuccessResult(existing.url, existingBuffer, thumbHash);
  } catch (error) {
    thumbnailLog?.warn(
      `Failed to read existing thumbnail, regenerating: ${photoId}`,
      error,
    );
    return null;
  }
}

// 生成新的缩略图（失败返回 null）
async function generateNewThumbnail(
  imageBuffer: Buffer,
  photoId: string,
): Promise<ThumbnailResult | null> {
  const log = getPhotoProcessingLoggers().thumbnail;
  log.info(`Generating thumbnail: ${photoId}`);
  const startTime = Date.now();

  try {
    // 创建 Sharp 实例，复用于缩略图和 thumbhash 生成
    const sharpInstance = sharp(imageBuffer, SOURCE_SHARP_OPTIONS).rotate(); // 自动根据 EXIF 旋转

    // 生成缩略图
    const thumbnailBuffer = await sharpInstance
      .clone() // 克隆实例用于缩略图生成
      .resize(THUMBNAIL_WIDTH, null, {
        withoutEnlargement: true,
      })
      .webp({ quality: THUMBNAIL_QUALITY, effort: 4 })
      .toBuffer();

    const fileName = createThumbnailFileName(photoId, thumbnailBuffer);
    const thumbnailPath = path.join(
      getPhotoExecutionContext().output.thumbnailsDir,
      fileName,
    );
    const thumbnailUrl = getThumbnailPublicUrlForFileName(fileName);

    // 原子落盘：普通 writeFile 中途被杀会留下截断的 .webp，增量路径此后会
    // 永远复用这张坏图（thumbnailExists 只看存在性，不看完整性）。
    await writeFileAtomic(thumbnailPath, thumbnailBuffer);

    // 记录生成信息
    const duration = Date.now() - startTime;
    const sizeKB = Math.round(thumbnailBuffer.length / 1024);
    log.success(`Generated: ${photoId} (${sizeKB}KB, ${duration}ms)`);

    // 基于生成的缩略图生成 thumbhash
    const thumbHash = await generateThumbHash(thumbnailBuffer);

    return createSuccessResult(thumbnailUrl, thumbnailBuffer, thumbHash);
  } catch (error) {
    log.error(`Generation failed: ${photoId}`, error);
    return null;
  }
}

// 生成缩略图和 thumbhash（复用 Sharp 实例）。失败返回 null——
// 这是唯一的失败编码，调用方据此把整张照片标记为失败并跳过。
export async function generateThumbnailAndThumbHash(
  imageBuffer: Buffer,
  photoId: string,
  forceRegenerate = false,
  preferredUrl?: string,
): Promise<ThumbnailResult | null> {
  const thumbnailLog = getPhotoProcessingLoggers().thumbnail;

  try {
    await ensureThumbnailDir();

    // 如果不是强制模式且缩略图已存在，尝试复用现有文件
    if (
      !forceRegenerate &&
      (await thumbnailExists(
        photoId,
        getPhotoExecutionContext().output.thumbnailsDir,
        preferredUrl,
      ))
    ) {
      const existingResult = await processExistingThumbnail(
        photoId,
        preferredUrl,
      );

      if (existingResult) {
        return existingResult;
      }
      // 如果处理现有缩略图失败，继续生成新的
    }

    // 生成新的缩略图
    return await generateNewThumbnail(imageBuffer, photoId);
  } catch (error) {
    thumbnailLog.error(`Processing failed: ${photoId}`, error);
    return null;
  }
}
