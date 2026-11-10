import "server-only";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import type { SessionUser } from "@/lib/auth/session";

export type ReadableAsset = {
  id: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  isPublic: boolean;
};

/**
 * Decides whether `user` (or an anonymous visitor) may read an asset.
 * Returns the asset when access is allowed, otherwise null.
 *
 * Rules, in order:
 *  - public assets (avatars, thumbnails): anyone
 *  - the uploader and admins: always
 *  - promo video of a published course: anyone
 *  - lecture media: free-preview lectures of published courses for anyone;
 *    otherwise the course instructor and actively enrolled students
 *  - lecture resources: the course instructor and actively enrolled students
 */
export async function readableAsset(assetId: string, user: SessionUser | null): Promise<ReadableAsset | null> {
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      ownerId: true,
      status: true,
      storageKey: true,
      filename: true,
      mimeType: true,
      sizeBytes: true,
      isPublic: true,
      promoOf: { select: { status: true } },
      lecture: {
        select: { isPreview: true, isReady: true, courseId: true, course: { select: { status: true, instructorId: true } } },
      },
      resource: {
        select: { lecture: { select: { courseId: true, course: { select: { instructorId: true } } } } },
      },
    },
  });
  if (!asset || asset.status !== "READY") return null;

  const result: ReadableAsset = {
    id: asset.id,
    storageKey: asset.storageKey,
    filename: asset.filename,
    mimeType: asset.mimeType,
    sizeBytes: Number(asset.sizeBytes),
    isPublic: asset.isPublic,
  };

  if (asset.isPublic) return result;
  if (user && (user.role === "ADMIN" || user.id === asset.ownerId)) return result;
  if (asset.promoOf?.status === "PUBLISHED") return result;

  const lecture = asset.lecture;
  if (lecture) {
    if (lecture.isPreview && lecture.isReady && lecture.course.status === "PUBLISHED") return result;
    if (!user) return null;
    if (lecture.course.instructorId === user.id) return result;
    return (await hasActiveEnrollment(user.id, lecture.courseId)) ? result : null;
  }

  const resourceLecture = asset.resource?.lecture;
  if (resourceLecture) {
    if (!user) return null;
    if (resourceLecture.course.instructorId === user.id) return result;
    return (await hasActiveEnrollment(user.id, resourceLecture.courseId)) ? result : null;
  }

  return null;
}

export async function hasActiveEnrollment(userId: string, courseId: string): Promise<boolean> {
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { revokedAt: true },
  });
  return !!enrollment && enrollment.revokedAt === null;
}

/**
 * Delete assets and their stored bytes. The rows go first so a failure never
 * leaves a row pointing at a missing file; leftover bytes are only wasted space.
 */
export async function deleteAssets(assetIds: Array<string | null | undefined>): Promise<void> {
  const ids = assetIds.filter((id): id is string => !!id);
  if (ids.length === 0) return;

  const assets = await db.asset.findMany({
    where: { id: { in: ids } },
    select: { id: true, storageKey: true, status: true, uploadId: true },
  });
  if (assets.length === 0) return;

  await db.asset.deleteMany({ where: { id: { in: assets.map((a) => a.id) } } });

  const store = storage();
  await Promise.all(
    assets.map(async (a) => {
      try {
        if (a.status === "UPLOADING") await store.abortUpload(a.storageKey, a.uploadId);
        else await store.remove(a.storageKey);
      } catch (err) {
        console.error(`[assets] could not remove stored file ${a.storageKey}:`, err);
      }
    }),
  );
}

/**
 * Confirms an uploaded asset belongs to `ownerId`, is finished, is of the
 * expected kind, and is not already attached to something else.
 */
export async function claimableAsset(
  assetId: string,
  ownerId: string,
  kind: "IMAGE" | "VIDEO" | "FILE",
): Promise<{ id: string; durationSec: number; filename: string } | null> {
  const asset = await db.asset.findFirst({
    where: {
      id: assetId,
      ownerId,
      kind,
      status: "READY",
      avatarOf: null,
      thumbnailOf: null,
      promoOf: null,
      lecture: null,
      resource: null,
    },
    select: { id: true, durationSec: true, filename: true },
  });
  return asset;
}
