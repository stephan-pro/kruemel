import { expect, type Page } from "@playwright/test";
import { ACCOUNT_TEXTS } from "../../src/ui/accountTexts";
import { HOUSEHOLD_TEXTS } from "../../src/ui/householdTexts";
import { expectPageShown } from "./helpers";
import { FAKE_SERVER } from "./shared";

// Signing in and the household against the fake server (stage 2, `signin.spec.ts`,
// `household.spec.ts`). The fake server runs once for all tests, so every test signs in with an
// address of its own.

/** An address no other test uses (the fake server allows one code a minute per address). */
export function newAddress(): string {
  return `person-${Date.now()}-${Math.floor(Math.random() * 1e6)}@beispiel.de`;
}

export const emailField = (page: Page) => page.getByLabel(ACCOUNT_TEXTS.emailLabel);
export const codeField = (page: Page) => page.getByLabel(ACCOUNT_TEXTS.codeLabel);

export async function requestCode(page: Page, email: string) {
  await emailField(page).fill(email);
  await page.getByRole("button", { name: ACCOUNT_TEXTS.sendCode }).click();
  await expectPageShown(page, ACCOUNT_TEXTS.codeTitle);
}

/** The code the fake server "mailed" to the address. */
export async function mailedCode(page: Page, email: string): Promise<string> {
  const response = await page.request.get(`${FAKE_SERVER}/test/code`, { params: { email } });
  return ((await response.json()) as { code: string }).code;
}

export async function enterCode(page: Page, code: string) {
  await codeField(page).fill(code);
  await page.getByRole("button", { name: ACCOUNT_TEXTS.verifyCode, exact: true }).click();
}

/** On the sign-in page: asks for a code and enters it. */
export async function signInWithCode(page: Page, email: string) {
  await expect(
    page.getByRole("heading", { level: 1, name: ACCOUNT_TEXTS.signInTitle }),
  ).toBeVisible();
  await requestCode(page, email);
  await enterCode(page, await mailedCode(page, email));
}

/** On "Haushalt anlegen": the two names, then the button. */
export async function createHousehold(page: Page, own: string, other: string) {
  await page.getByLabel(HOUSEHOLD_TEXTS.ownNameLabel).fill(own);
  await page.getByLabel(HOUSEHOLD_TEXTS.otherNameLabel).fill(other);
  await page.getByRole("button", { name: HOUSEHOLD_TEXTS.create }).click();
}
