import { expect, test, type Page } from "@playwright/test";

const EMPTY_PAGINATION = {
  limit: 50,
  has_more: false,
  next_cursor: null,
  prev_cursor: null,
};

const API_RESPONSES: Record<string, unknown> = {
  "/auth/config": { clientId: "", tenantId: "", allowedGroupIds: "" },
  "/auth/access": { isAdmin: false },
  "/version": {
    version: "feedback-test",
    display: "feedback-test",
    default_labels: { operator: "test", operation: "feedback" },
  },
  "/labels": {
    source: "attacks",
    labels: { operator: ["test"], operation: ["feedback"] },
  },
  "/attacks": { items: [], pagination: EMPTY_PAGINATION },
};

async function installFeedbackMocks(page: Page): Promise<void> {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    const hasResponse = Object.hasOwn(API_RESPONSES, path);

    await route.fulfill({
      status: hasResponse ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify(
        hasResponse ? API_RESPONSES[path] : { detail: `No mock for ${path}` },
      ),
    });
  });
}

test("Go back and fix restores the feedback dialog", async ({ page }) => {
  await installFeedbackMocks(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Feedback" }).click();
  const feedbackSurface = page
    .locator('[role="dialog"]')
    .filter({ hasText: "Send feedback" });
  await expect(page.getByRole("dialog", { name: "Send feedback" })).toBeVisible();

  await page.getByRole("combobox", { name: "Category" }).selectOption("bug");
  const description = page.getByTestId("feedback-bug-describe-input");
  const reproduction = page.getByTestId("feedback-bug-repro-input");
  const descriptionText =
    "This is a sufficiently long bug description for the feedback form.";
  const reproductionText =
    "Use synthetic key sk-aBcDeFgHiJkLmNoPqRsTuVwXyZ012345 to reproduce.";
  await description.fill(descriptionText);
  await reproduction.fill(reproductionText);

  const submitButton = page.getByTestId("feedback-submit-button");
  await submitButton.click();
  const confirmDialog = page.getByTestId("feedback-confirm-dialog");
  await expect(confirmDialog).toBeVisible();

  await page.getByTestId("feedback-confirm-cancel").click();

  await expect(confirmDialog).toBeHidden();
  await expect(feedbackSurface).toBeVisible();
  await expect(feedbackSurface).not.toHaveAttribute("aria-hidden", "true");
  await expect(page.getByRole("dialog", { name: "Send feedback" })).toBeVisible();
  await expect(submitButton).toBeFocused();
  await expect(description).toHaveValue(descriptionText);
  await expect(reproduction).toHaveValue(reproductionText);

  await description.click();
  await description.fill("Updated description after returning from the warning.");
  await expect(description).toHaveValue(
    "Updated description after returning from the warning.",
  );
});
