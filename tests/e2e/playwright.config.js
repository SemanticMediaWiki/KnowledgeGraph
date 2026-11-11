'use strict';

const { defineConfig, devices } = require( '@playwright/test' );

// The test wiki is configured with wgServer http://localhost:8080 (see build/Dockerfile),
// so it has to be reached under exactly that origin.
module.exports = defineConfig( {
	testDir: '.',
	testMatch: '*.spec.js',
	// All tests share one wiki and the same seeded pages.
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [ [ 'list' ], [ 'html', { open: 'never' } ] ] : 'list',
	use: {
		baseURL: process.env.WIKI_URL || 'http://localhost:8080',
		trace: 'retain-on-failure'
	},
	projects: [ { name: 'chromium', use: { ...devices[ 'Desktop Chrome' ] } } ]
} );
