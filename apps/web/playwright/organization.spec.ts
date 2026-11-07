import { expect } from "playwright/test";
import { test } from "./lib/fixtures";
import { invites } from "./utils/mock";

test.describe("Invite, accept and remove organization member", async () => {
  test.beforeEach(async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
  });

  test("Invite organization member", async ({ page }) => {
    const inviteEmail = `org-invite-${Date.now()}@formbricks.com`;

    await test.step("Invite User", async () => {
      const workspaceId = /\/workspaces\/([^/]+)\//.exec(page.url())?.[1];
      // Old workspace-scoped org settings URL is redirected to the org-scoped route.
      await page.goto(`/workspaces/${workspaceId}/settings/organization/teams`);
      await page.waitForURL(/\/organizations\/[^/]+\/settings\/teams/);

      await page.locator('[data-testid="members-loading-card"]:first-child').waitFor({ state: "hidden" });

      // Add member button
      await expect(page.getByRole("button", { name: "Invite member" })).toBeVisible();
      await page.getByRole("button", { name: "Invite member" }).click();

      // Fill the member name and email form
      await expect(page.getByLabel("Email")).toBeVisible();
      await page.getByLabel("Full Name").fill(invites.addMember.name);

      await expect(page.getByLabel("Email")).toBeVisible();
      await page.getByLabel("Email").fill(inviteEmail);

      await page.getByRole("button", { name: "Invite", exact: true }).click();

      await expect(page.locator(".formbricks__toast__success")).toBeVisible({ timeout: 15000 });
    });

    await test.step("Copy invite Link", async () => {
      await expect(page.locator("#membersInfoWrapper")).toBeVisible();

      const invitedMemberInfo = page.locator("#singleMemberInfo").filter({ hasText: inviteEmail });
      await expect(invitedMemberInfo).toBeVisible({ timeout: 10000 });

      await expect(invitedMemberInfo.getByText("Pending", { exact: true })).toBeVisible();

      const shareInviteButton = invitedMemberInfo.locator("#shareInviteButton");
      await expect(shareInviteButton).toBeVisible();

      await shareInviteButton.click();

      const inviteLinkText = await page.waitForSelector("#inviteLinkText");
      expect(inviteLinkText).toBeTruthy();

      // invite link text is an input element, so we need to get its value instead of textContent
      const inviteLinkTextContent = await inviteLinkText.inputValue();
      expect(inviteLinkTextContent).toBeTruthy();
      // if (inviteLinkTextContent) {
      //   inviteLink = inviteLinkTextContent;
      // }
    });
  });

  // test("Accept invite", async ({ page }) => {
  //   const { email, name } = mockUsers.organization[1];
  //   page.goto(inviteLink);

  //   await page.waitForURL(/\/invite\?token=[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/);

  //   // Create account button
  //   await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
  //   await page.getByRole("link", { name: "Create account" }).click();

  //   await signupUsingInviteToken(page, name, email, name);
  //   await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
  // });

  // test("Remove member", async ({ page }) => {
  //   await apiLogin(page, email, name);

  //   await page.goto("/");
  //   await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

  //   const dropdownTrigger = page.locator("#userDropdownTrigger");
  //   await expect(dropdownTrigger).toBeVisible();
  //   await dropdownTrigger.click();

  //   const dropdownInnerContentWrapper = page.locator("#userDropdownInnerContentWrapper");
  //   await expect(dropdownInnerContentWrapper).toBeVisible();

  //   await page.getByRole("link", { name: "Organization" }).click();

  //   await page.waitForURL(/\/workspaces\/[^/]+\/settings\/members/);

  //   await page.locator('[data-testid="members-loading-card"]:first-child').waitFor({ state: "hidden" });

  //   await expect(page.locator("#membersInfoWrapper")).toBeVisible();

  //   const lastMemberInfo = page.locator("#membersInfoWrapper > #singleMemberInfo:last-child");
  //   await expect(lastMemberInfo).toBeVisible();

  //   const deleteMemberButton = lastMemberInfo.locator("#deleteMemberButton");
  //   await expect(deleteMemberButton).toBeVisible();

  //   await deleteMemberButton.click();

  //   await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
  //   await page.getByRole("button", { name: "Delete", exact: true }).click();
  // });
});
