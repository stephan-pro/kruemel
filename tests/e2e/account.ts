import {
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  expect,
  type Page,
} from "@playwright/test";
import type { Session } from "../../src/auth/auth";
import { type AppData, SCHEMA_VERSION } from "../../src/storage/appData";
import { ACCOUNT_TEXTS } from "../../src/ui/accountTexts";
import { HOUSEHOLD_TEXTS } from "../../src/ui/householdTexts";
import { expectPageShown } from "./helpers";
import { E2E_APP, FAKE_SERVER } from "./shared";

// Signing in and the household against the fake server (stage 2, `signin.spec.ts`,
// `household.spec.ts`). The fake server runs once for all tests, so every test signs in with an
// address of its own.

/** An address no other test uses (the fake server allows one code a minute per address). */
export function newAddress(): string {
  return `person-${Date.now()}-${Math.floor(Math.random() * 1e6)}@beispiel.de`;
}

export const emailField = (page: Page) => page.getByLabel(ACCOUNT_TEXTS.emailLabel);
export const codeField = (page: Page) => page.getByLabel(ACCOUNT_TEXTS.codeLabel);

/**
 * Makes an account for the address by hand, as the operator does in the dashboard ("Add user").
 * New addresses need an invite since E2-5b; the tests of that path are in `friends.spec.ts`.
 */
export async function addUser(request: APIRequestContext, email: string) {
  const response = await request.post(`${FAKE_SERVER}/test/user`, { data: { email } });
  expect(response.ok()).toBe(true);
}

/** On the sign-in page: asks for a code; the address gets an account first unless `invited`. */
export async function requestCode(page: Page, email: string, invited = false) {
  if (!invited) {
    await addUser(page.request, email);
  }
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

/** On the sign-in page: asks for a code and enters it (see `requestCode` for `invited`). */
export async function signInWithCode(page: Page, email: string, invited = false) {
  await expect(
    page.getByRole("heading", { level: 1, name: ACCOUNT_TEXTS.signInTitle }),
  ).toBeVisible();
  await requestCode(page, email, invited);
  await enterCode(page, await mailedCode(page, email));
}

/** On "Haushalt anlegen": the two names, then the button. */
export async function createHousehold(page: Page, own: string, other: string) {
  await page.getByLabel(HOUSEHOLD_TEXTS.ownNameLabel).fill(own);
  await page.getByLabel(HOUSEHOLD_TEXTS.otherNameLabel).fill(other);
  await page.getByRole("button", { name: HOUSEHOLD_TEXTS.create }).click();
}

// Shared data (E2-3b, `sync.spec.ts`): the two members of a household are made through the fake
// server's API, without the pages (those are tested in `signin.spec.ts` and `household.spec.ts`).

/** What the fake server hands out on signing in, as the app keeps it (`kruemel-fake:auth`). */
export interface Member {
  readonly token: string;
  readonly session: Session;
}

/** Where the app keeps the session in the mode `e2e` (`FAKE_AUTH_KEY`). */
export const FAKE_AUTH_KEY = "kruemel-fake:auth";

const bearer = (member: Member) => ({ Authorization: `Bearer ${member.token}` });

/** Signs a new address in through the API. */
export async function memberByApi(request: APIRequestContext, email = newAddress()) {
  await addUser(request, email);
  await request.post(`${FAKE_SERVER}/auth/code`, { data: { email } });
  const code = (await (await request.get(`${FAKE_SERVER}/test/code`, { params: { email } })).json())
    .code as string;
  const response = await request.post(`${FAKE_SERVER}/auth/verify`, { data: { email, code } });
  expect(response.ok()).toBe(true);
  return (await response.json()) as Member;
}

/** A household of two (Alex creates it, Robin joins), optionally with data put in place. */
export async function householdOfTwo(request: APIRequestContext, data?: AppData) {
  const alex = await memberByApi(request);
  const robin = await memberByApi(request);
  await request.post(`${FAKE_SERVER}/household/create`, {
    headers: bearer(alex),
    data: { personA: "Alex", personB: "Robin" },
  });
  const invite = await (
    await request.post(`${FAKE_SERVER}/household/invite`, { headers: bearer(alex) })
  ).json();
  await request.post(`${FAKE_SERVER}/household/accept`, {
    headers: bearer(robin),
    data: { token: invite.token },
  });
  if (data !== undefined) {
    await pushAs(request, alex, { type: "replaceAll", data, id: crypto.randomUUID() });
  }
  return { alex, robin };
}

/** Sends one change to the household as the member would (`schemaVersion`: of that app). */
export async function pushAs(
  request: APIRequestContext,
  member: Member,
  change: object,
  schemaVersion = SCHEMA_VERSION,
) {
  const response = await request.post(`${FAKE_SERVER}/push?schemaVersion=${schemaVersion}`, {
    headers: bearer(member),
    data: change,
  });
  expect(response.ok()).toBe(true);
}

/** The household's data as the server has them. */
export async function serverData(request: APIRequestContext, member: Member): Promise<AppData> {
  return (await request.get(`${FAKE_SERVER}/test/data`, { headers: bearer(member) })).json();
}

/**
 * A device of a signed-in member: its own browser storage, the session put in place once (a
 * reload after signing out stays signed out), opened at `hash`.
 */
export async function openMember(
  browser: Browser,
  member: Member,
  hash = "#/aufgaben",
  prepare?: (context: BrowserContext) => Promise<void>,
): Promise<Page> {
  const context = await browser.newContext();
  await context.addInitScript(
    ({ key, value }) => {
      if (sessionStorage.getItem("e2e-seeded") === null) {
        sessionStorage.setItem("e2e-seeded", "1");
        localStorage.setItem(key, value);
      }
    },
    { key: FAKE_AUTH_KEY, value: JSON.stringify(member) },
  );
  await prepare?.(context);
  const page = await context.newPage();
  await page.goto(`${E2E_APP}${hash}`);
  return page;
}

/** The keys of the device's copies of shared data (`kruemel:<household>:<person>:sync`). */
export function sharedCopyKeys(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Object.keys(localStorage).filter((key) => /^kruemel:[^:]+:[^:]+:sync$/.test(key)),
  );
}
