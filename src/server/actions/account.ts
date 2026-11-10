"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ActionError, actionUser, formValues, ok, parse, run, type ActionResult, type FormState } from "@/lib/action";
import { claimableAsset, deleteAssets } from "@/lib/assets";
import { db } from "@/lib/db";
import { nameSchema, optionalUrlSchema, text } from "@/lib/validation";

const profileSchema = z.object({
  name: nameSchema,
  headline: text("Headline", 0, 120),
  bio: text("Bio", 0, 2000),
  websiteUrl: optionalUrlSchema,
  avatarAssetId: z.string().max(64).optional(),
});

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(async () => {
    const user = await actionUser();
    const input = parse(profileSchema, formValues(formData));
    const current = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { avatarAssetId: true } });

    let avatarAssetId = current.avatarAssetId;
    const wanted = input.avatarAssetId || null;
    if (wanted !== current.avatarAssetId) {
      if (wanted && !(await claimableAsset(wanted, user.id, "IMAGE"))) {
        throw new ActionError("That image upload didn't finish. Please upload it again.");
      }
      avatarAssetId = wanted;
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        name: input.name,
        headline: input.headline,
        bio: input.bio,
        websiteUrl: input.websiteUrl,
        avatarAssetId,
      },
    });
    if (current.avatarAssetId && current.avatarAssetId !== avatarAssetId) {
      await deleteAssets([current.avatarAssetId]);
    }
    refresh();
    return ok("Profile saved.");
  });
}

/** Any signed-in user can start teaching: this unlocks the instructor studio. */
export async function becomeInstructorAction(): Promise<ActionResult> {
  return run(async () => {
    const user = await actionUser();
    if (user.role === "STUDENT") {
      await db.user.update({ where: { id: user.id }, data: { role: "INSTRUCTOR" } });
    }
    redirect("/instructor");
  });
}
