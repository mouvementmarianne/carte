import AxeBuilder from '@axe-core/playwright';
import {
	type BrowserContext,
	expect,
	type Locator,
	type Page,
	test,
} from '@playwright/test';
import type { AxeResults } from 'axe-core';

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
test.describe('carte interactive', () => {
	test.describe.configure({ mode: 'serial' });

	test.beforeAll(async ({ browser }) => {
		// Arrange
		test.setTimeout(120000);

		context = await browser.newContext();
		page = await context.newPage();

		// Act
		const response: { status: () => number } | null = await page.goto('');

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
	test('01 - la carte est affichée', async () => {
		// Act
		await waitForMapReady();

		// Assert
		await expect(page.locator('.leaflet-container')).toBeVisible();
	});

	test('02 - les régions sont visibles', async () => {
		// Arrange
		await waitForMapReady();

		// Act
		const regions: Locator = page.locator('path.leaflet-interactive');

		// Assert
		await expect(regions.first()).toBeVisible();
	});

	/**
	 * Accessibilité
	 */
	test('03 - la page respecte WCAG 2.1 AA', async () => {
		// Arrange
		await expect(page.locator('.leaflet-container')).toBeVisible();

		// Act
		const results: AxeResults = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa'])
			.analyze();

		// Assert
		expect(results.violations).toEqual([]);
	});

	test('04 - la navigation clavier permet d’atteindre la carte', async () => {
		// Arrange
		const map: Locator = page.locator('.leaflet-container');

		// Act
		while (!(await map.evaluate((el) => el === document.activeElement))) {
			await page.keyboard.press('Tab');
		}

		// Assert
		await expect(map).toBeFocused();
	});

	test('05 - les régions sont accessibles au clavier', async () => {
		// Arrange
		const interactiveRegions: Locator = page.locator(
			'path.leaflet-interactive[role="button"]',
		);
		await expect(interactiveRegions).toHaveCount(18);

		// Act
		const count: number = await interactiveRegions.count();

		// Assert
		for (let i: number = 0; i < count; i++) {
			await expect(interactiveRegions.nth(i)).toHaveAttribute('tabindex', '0');
		}
	});

	test('06 - la fiche régionale est accessible au clavier avec Entrée', async () => {
		// Arrange
		const region = page.getByLabel('Afficher les informations de Occitanie');
		await region.focus();
		await expect(region).toBeFocused();

		// Act
		await region.press('Enter');

		// Assert
		const dialog: Locator = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await expect(dialog).toContainText('Chargé·e de Développement Régional');
		await expect(
			page.locator('[aria-label="Afficher les informations de Gard"]'),
		).toHaveCount(1);
	});

	test('07 - le focus est correctement géré par la popup', async () => {
		// Assert
		await expect(page.getByRole('dialog')).toBeFocused();
	});

	test('08 - la popup se ferme au clavier avec Echap', async () => {
		// Act
		await page.keyboard.press('Escape');

		// Assert
		await expect(
			page.getByText('Chargé·e de Développement Régional'),
		).toBeHidden();
	});

	/**
	 * Popup
	 */
	test('09 - une région affiche ses informations', async () => {
		// Act
		const region = page.getByLabel('Afficher les informations de Occitanie');
		await region.focus();
		await region.press('Enter');

		// Assert
		await expect(
			page.getByText('Chargé·e de Développement Régional'),
		).toBeVisible();

		await expect(
			page.getByText(/Chargé·e de Développement Régional/),
		).toBeVisible();
		await expect(page.getByText(/📞/)).toBeVisible();
		await expect(page.getByText(/📍/)).toBeVisible();
		await expect(page.getByText(/👥/)).toBeVisible();

		await expect(page.getByText('bénévole')).toBeVisible();

		await expect(page.getByText('département')).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(
			page.locator('[aria-label="Afficher les informations de Occitanie"]'),
		).toHaveCount(1);
		await expect(page.locator('.leaflet-popup')).toHaveCount(0);
	});

	/**
	 * Régions non renseignées
	 */
	test('10 - les territoires non renseignés ne sont pas interactifs', async () => {
		// Arrange
		const disabledRegion = page
			.locator('path.leaflet-interactive:not([role="button"])')
			.first();

		// Assert
		await expect(disabledRegion).not.toHaveAttribute('role', 'button');
	});

	/**
	 * Départements
	 */
	test("11 - la fiche départementale est accessible après sélection d'une région", async () => {
		// Arrange
		await page.reload();
		await expect(page).toHaveTitle(/Mouvement Marianne/);
		const region = page.getByLabel('Afficher les informations de Occitanie');
		await region.focus();
		await region.press('Enter');
		const department = page.getByLabel('Afficher les informations de Gard');
		await expect(department).toBeAttached({
			timeout: 10000,
		});

		// Act : ouverture de la fiche départementale
		await department.focus();
		await page.keyboard.press('Enter');

		// Assert
		await expect(page.getByRole('dialog')).toHaveCount(1);
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await expect(dialog).toContainText('Gard');
		await expect(dialog).toContainText('👤 Référent·e départemental·e :');
		await expect(dialog).toContainText('📞');
		await expect(dialog).toContainText('📅');
		await expect(dialog).toContainText('👥');
	});
});
