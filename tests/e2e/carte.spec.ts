import AxeBuilder from "@axe-core/playwright";
import {
	type BrowserContext,
	expect,
	type Locator,
	type Page,
	test,
} from "@playwright/test";
import type { AxeResults } from "axe-core";

let context: BrowserContext;
let page: Page;

async function waitForMapReady(timeout: number = 120000): Promise<void> {
	await page.waitForFunction(
		() => (window as Window & { __ready?: boolean }).__ready === true,
		{ timeout },
	);
}

/**
 * Tests E2E en production
 *
 * Les tests partagent une seule page dans un vrai navigateur afin
 *      1. de limiter le nombre de requêtes vers le site de production
 *      2. et d'éviter le rate limiting (HTTP 429 Too many requests).
 */
test.describe("carte interactive", () => {
	test.describe.configure({ mode: "serial" });

	test.beforeAll(async ({ browser }) => {
		// Arrange
		test.setTimeout(120000);

		context = await browser.newContext();
		page = await context.newPage();

		// Act
		const response: { status: () => number } | null = await page.goto("");

		// Assert
		expect(response?.status()).toBe(200);
		await expect(page).toHaveTitle(/Mouvement Marianne/);
	});

	test.afterAll(async () => {
		await context.close();
	});

	/**
	 * Carte
	 */
	test("01 - la carte est affichée", async () => {
		// Act
		await waitForMapReady();

		// Assert
		await expect(page.locator(".leaflet-container")).toBeVisible();
	});

	test("02 - les régions sont visibles", async () => {
		// Arrange
		await waitForMapReady();

		// Act
		const regions: Locator = page.locator("path.leaflet-interactive");

		// Assert
		await expect(regions.first()).toBeVisible();
	});

	/**
	 * Accessibilité
	 */
	test("03 - la page respecte WCAG 2.1 AA", async () => {
		// Arrange
		await expect(page.locator(".leaflet-container")).toBeVisible();

		// Act
		const results: AxeResults = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa"])
			.analyze();

		// Assert
		expect(results.violations).toEqual([]);
	});

	test("04 - la navigation clavier permet d’atteindre la carte", async () => {
		// Arrange
		const map: Locator = page.locator(".leaflet-container");

		// Act
		while (!(await map.evaluate((el) => el === document.activeElement))) {
			await page.keyboard.press("Tab");
		}

		// Assert
		await expect(map).toBeFocused();
	});

	test("05 - les régions sont accessibles au clavier", async () => {
		// Arrange
		const interactiveRegions: Locator = page.locator(
			'path.leaflet-interactive[role="button"]',
		);
		await expect(interactiveRegions).toHaveCount(18);

		// Act
		const count: number = await interactiveRegions.count();

		// Assert
		for (let i: number = 0; i < count; i++) {
			await expect(interactiveRegions.nth(i)).toHaveAttribute("tabindex", "0");
		}
	});

	test("06 - une région peut être ouverte avec Entrée", async () => {
		// Arrange
		const region: Locator = page.locator("path.leaflet-interactive").first();
		await region.focus();

		// Act
		await page.keyboard.press("Enter");

		// Assert
		await expect(
			page.getByText("Chargé·e de Développement Régional"),
		).toBeVisible();
	});

	test("07 - le focus est correctement géré par la popup", async () => {
		// Assert
		await expect(page.getByRole("dialog")).toBeFocused();
	});

	test("08 - la popup se ferme au clavier avec Escape", async () => {
		// Act
		await page.keyboard.press("Escape");

		// Assert
		await expect(
			page.getByText("Chargé·e de Développement Régional"),
		).toBeHidden();
	});

	/**
	 * Popup
	 */
	test("09 - une région affiche ses informations", async () => {
		// Act
		await page.locator("path.leaflet-interactive").first().click();

		// Assert
		await expect(
			page.getByText("Chargé·e de Développement Régional"),
		).toBeVisible();

		await expect(
			page.getByText(/Chargé·e de Développement Régional/),
		).toBeVisible();
		await expect(page.getByText(/📞/)).toBeVisible();
		await expect(page.getByText(/📍/)).toBeVisible();
		await expect(page.getByText(/👥/)).toBeVisible();

		await expect(page.getByText("bénévole")).toBeVisible();

		await expect(page.getByText("département")).toBeVisible();

		await page.keyboard.press("Escape");
		await expect(page.locator(".leaflet-popup")).toHaveCount(0);
	});

	/**
	 * Régions non renseignées
	 */
	test("10 - les territoires non renseignés ne sont pas interactifs", async () => {
		// Arrange
		const disabledRegion: Locator = page
			.locator('path.leaflet-interactive:not([role="button"])')
			.first();

		// Act
		await disabledRegion.click({ force: true });

		// Assert
		await expect(page.locator(".leaflet-popup")).toHaveCount(0);
	});
});
