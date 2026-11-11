import { expect, test } from "@playwright/test";
import { SAMPLE_VIDEO, expectToast, logIn, signUp, unique } from "./helpers";

test("an instructor builds a course, an admin approves it, a student can buy it", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const title = `Sourdough Baking ${unique()}`;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // ── Instructor ──
  await signUp(page, "Tess Teacher", "/teach");
  await page.getByRole("button", { name: "Become an instructor" }).click();
  await page.waitForURL("**/instructor");
  await page.getByRole("link", { name: "New course" }).first().click();
  await page.getByRole("textbox", { name: "Course title" }).fill(title);
  await page.getByRole("button", { name: "Create course" }).click();
  await page.waitForURL("**/details");

  await page.getByRole("textbox", { name: "Subtitle" }).fill("Bake a reliable loaf at home with four ingredients.");
  await page
    .getByRole("textbox", { name: "Description" })
    .fill("Learn to make a starter, mix and shape dough, and bake a crusty loaf, with timings that fit a normal kitchen and a normal week.");
  await page.getByRole("combobox", { name: "Category" }).selectOption({ label: "Health & Fitness" });
  await page.getByRole("button", { name: "Save details" }).click();
  await expectToast(page, "Course details saved.");

  await page.getByRole("link", { name: "Goals" }).click();
  await page.getByRole("textbox", { name: "What students will learn 1" }).fill("Create and keep a starter alive");
  await page.getByRole("button", { name: "Add another" }).first().click();
  await page.getByRole("textbox", { name: "What students will learn 2" }).fill("Shape and bake a loaf");
  await page.getByRole("button", { name: "Save goals" }).click();
  await expectToast(page, "Saved.");

  // Publishing is blocked until there is content.
  await page.getByRole("link", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("button", { name: "Submit for review" })).toBeDisabled();

  await page.getByRole("link", { name: "Curriculum" }).click();
  await page.getByRole("textbox", { name: "New section" }).fill("The starter");
  await page.getByRole("button", { name: "Add section" }).click();

  const newTitle = page.getByRole("textbox", { name: "Title of new lecture in The starter" });
  const editor = page.getByRole("dialog");
  await newTitle.fill("Welcome");
  await page.getByRole("button", { name: "Add lecture" }).click();
  await expect(editor.getByRole("heading", { name: "Edit video lecture" })).toBeVisible();
  await editor.locator('input[type="file"][aria-label="Upload a video"]').setInputFiles(SAMPLE_VIDEO);
  await expectToast(page, "File attached.");
  await editor.getByRole("checkbox", { name: /Free preview/ }).check();
  await editor.getByRole("button", { name: "Save lecture" }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByText("Video · 0:30")).toBeVisible();

  await page.getByRole("combobox", { name: "Type of new lecture in The starter" }).selectOption("QUIZ");
  await newTitle.pressSequentially("Starter check");
  await page.getByRole("button", { name: "Add lecture" }).click();
  await editor.getByRole("button", { name: "Add question" }).click();
  await editor.getByRole("textbox", { name: "Question 1 text" }).fill("How often do you feed a starter kept at room temperature?");
  await editor.getByRole("textbox", { name: "Question 1 option 1" }).fill("Daily");
  await editor.getByRole("textbox", { name: "Question 1 option 2" }).fill("Monthly");
  await editor.getByRole("button", { name: "Save lecture" }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByText("Quiz · 1 question")).toBeVisible();

  await page.getByRole("link", { name: "Pricing" }).click();
  await page.getByRole("radio", { name: /Paid/ }).check();
  await page.getByRole("textbox", { name: /Price/ }).fill("24.50");
  await page.getByRole("button", { name: "Save pricing" }).click();
  await expectToast(page, "Price saved.");

  await page.getByRole("link", { name: "Publish", exact: true }).click();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("Waiting for review")).toBeVisible();

  // Not public yet.
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(`/courses/${slug}`);
  await expect(visitorPage.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();

  // ── Admin ──
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await logIn(admin, "admin@amber.test");
  await admin.goto("/admin/courses?status=in_review");
  await admin.getByRole("link", { name: title }).click();
  await admin.getByRole("button", { name: "Approve and publish" }).click();
  await expect(admin.getByRole("button", { name: "Unpublish course" })).toBeVisible();

  // ── Student ──
  await visitorPage.goto(`/courses/${slug}`);
  await expect(visitorPage.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(visitorPage.getByText("$24.50")).toBeVisible();
  await signUp(visitorPage, "Sam Student", `/courses/${slug}`);
  await visitorPage.getByRole("button", { name: "Buy now" }).click();
  await visitorPage.getByRole("button", { name: "Proceed to checkout" }).click();
  await visitorPage.getByRole("button", { name: "Simulate a successful payment" }).click();
  await expect(visitorPage.getByRole("heading", { name: "You're enrolled" })).toBeVisible();

  // The instructor sees the sale; a refund by the admin removes access again.
  await page.goto("/instructor/earnings");
  await expect(page.getByText("$17.15").first()).toBeVisible(); // 70% of 24.50

  await admin.goto("/admin/orders");
  await admin.getByRole("button", { name: "Refund" }).first().click();
  await admin.getByRole("button", { name: /^Refund \$/ }).click();
  await expectToast(admin, "Order refunded and access removed.");
  await visitorPage.goto(`/learn/${slug}`);
  await expect(visitorPage).toHaveURL(new RegExp(`/courses/${slug}$`));

  await visitor.close();
  await adminContext.close();
});

test("students cannot reach instructor or admin areas", async ({ page }) => {
  await logIn(page, "maya@amber.test");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/instructor");
  await expect(page).toHaveURL(/\/teach$/);
});
