import path from "node:path";
import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "amber-demo-1234";
export const SAMPLE_VIDEO = path.join(process.cwd(), "prisma", "seed-assets", "sample-a.mp4");

/** A short unique suffix so repeated runs never collide on names or emails. */
export const unique = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// Next.js keeps recently visited pages in the DOM but hidden, so every locator
// here is either role-based (which skips hidden content) or filtered to visible.
export const field = (page: Page, name: string) => page.locator(`input[name="${name}"]`).filter({ visible: true });

export async function logIn(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto("/login");
  await field(page, "email").fill(email);
  await field(page, "password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

export async function signUp(page: Page, name: string, next = "/") {
  const email = `e2e-${unique()}@example.com`;
  await page.goto(`/signup?next=${encodeURIComponent(next)}`);
  await field(page, "name").fill(name);
  await field(page, "email").fill(email);
  await field(page, "password").fill("e2e-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/signup"));
  return email;
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).filter({ visible: true }).first()).toBeVisible();
}
