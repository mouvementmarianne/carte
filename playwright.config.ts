import { defineConfig } from '@playwright/test';

export default defineConfig({
	use: {
		baseURL: 'https://www.mouvementmarianne.org/carte-interactive/',
		headless: false,
	},
	tsconfig: './tests/tsconfig.json',
	workers: 1,
});
