import { expect, test } from "@playwright/test";
import { field, signUp } from "./helpers";

const PAID = "/courses/leading-teams-your-first-90-days-as-a-manager";
const FREE_SLUG = "giving-feedback-that-lands";

test("visitors can browse, search and preview without an account", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Popular right now" })).toBeVisible();

  await page.goto("/courses?q=meetings");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("meetings");
  await expect(page.getByRole("link", { name: "Running Effective Meetings" })).toBeVisible();

  await page.goto(`/courses/${FREE_SLUG}`);
  await page.getByRole("link", { name: "Preview this course" }).click();
  await expect(page.getByText("You're viewing a free preview")).toBeVisible();
  await expect(page.locator("video").filter({ visible: true })).toBeVisible();

  // Members-only pages send visitors to log in.
  await page.goto("/my-learning");
  await expect(page).toHaveURL(/\/login\?next=%2Fmy-learning/);
});

test("sign-up validates input and keeps what was typed", async ({ page }) => {
  await page.goto("/signup");
  await field(page, "name").fill("Val Idation");
  await field(page, "email").fill("val@example.com");
  await field(page, "password").fill("short");
  await page.locator("form").filter({ visible: true }).evaluate((form: HTMLFormElement) => (form.noValidate = true));
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
  await expect(field(page, "name")).toHaveValue("Val Idation");
});

test("a student buys a course with a coupon and gets access", async ({ page }) => {
  await signUp(page, "Bea Buyer", `${PAID}?coupon=WELCOME20`);
  await expect(page.getByText("Coupon WELCOME20 applied")).toBeVisible();
  await page.getByRole("button", { name: "Buy now" }).click();
  await page.waitForURL("**/cart");
  await expect(page.getByText("Coupon discount")).toBeVisible();
  await expect(page.locator("dd.font-display").filter({ visible: true })).toHaveText("$39.99");

  // A declined payment leaves the cart intact.
  await page.getByRole("button", { name: "Proceed to checkout" }).click();
  await page.getByRole("button", { name: "Simulate a declined payment" }).click();
  await expect(page.getByRole("heading", { name: "The payment didn't go through" })).toBeVisible();
  await page.getByRole("link", { name: "Back to cart" }).click();

  await page.getByRole("button", { name: "Proceed to checkout" }).click();
  await page.getByRole("button", { name: "Simulate a successful payment" }).click();
  await expect(page.getByRole("heading", { name: "You're enrolled" })).toBeVisible();

  await page.goto(PAID);
  await expect(page.getByText("You're enrolled in this course")).toBeVisible();
  await page.goto("/account/purchases");
  await expect(page.getByText("Coupon WELCOME20")).toBeVisible();
});

test("a student completes a free course and earns a certificate", async ({ page }) => {
  await signUp(page, "Lea Learner", `/courses/${FREE_SLUG}`);
  await page.getByRole("button", { name: "Enroll for free" }).click();
  await page.waitForURL(`**/learn/${FREE_SLUG}/**`);

  // Video: streaming supports range requests, and finishing it completes the lecture.
  const video = page.locator("video").filter({ visible: true });
  await expect(video).toBeVisible();
  const status = await video.evaluate(async (v: HTMLVideoElement) => (await fetch(v.src, { headers: { Range: "bytes=0-99" } })).status);
  expect(status).toBe(206);
  await video.evaluate(async (v: HTMLVideoElement) => {
    v.muted = true;
    await v.play();
    v.currentTime = v.duration - 1;
  });
  await expect(page.getByText(/Up next in/)).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  // Notes and Q&A.
  const note = `Describe behaviour, not personality ${Date.now()}`;
  await page.getByRole("tab", { name: /Notes/ }).click();
  await page.getByRole("textbox", { name: /New note/ }).fill(note);
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText(note)).toBeVisible();

  // Quiz: a wrong answer is explained, a retry can pass.
  await page.getByRole("navigation", { name: "Course content" }).getByRole("link", { name: /Quick quiz/ }).click();
  await page.getByRole("radio", { name: "The person's personality" }).check();
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByText("You scored 0 out of 1")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await page.getByRole("radio", { name: "A specific, observable behaviour and its impact" }).check();
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByText("You scored 1 out of 1")).toBeVisible();

  // Tick off the rest; the certificate appears at 100%.
  for (let i = 0; i < 8; i++) {
    const box = page.getByRole("checkbox", { checked: false }).first();
    if ((await box.count()) === 0) break;
    await box.click();
    await expect(box).toBeChecked({ checked: true }).catch(() => undefined);
  }
  const certificate = page.getByRole("link", { name: "Certificate", exact: true });
  await expect(certificate).toBeVisible();
  await certificate.click();
  await expect(page.getByRole("heading", { name: "Certificate of completion" })).toBeVisible();
  await expect(page.getByText("Lea Learner").first()).toBeVisible();

  // Reviews are only for enrolled students.
  await page.goto(`/learn/${FREE_SLUG}?tab=review`);
  await page.getByRole("radio", { name: /^5 stars/ }).click();
  await page.getByRole("button", { name: "Post review" }).click();
  // Once saved, the form switches to editing the existing review.
  await expect(page.getByRole("button", { name: "Update review" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Your review" })).toBeVisible();
});
