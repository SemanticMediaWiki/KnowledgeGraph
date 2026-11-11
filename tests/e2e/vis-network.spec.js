'use strict';

/**
 * Browser smoke tests for the bundled vis-network library.
 *
 * The unit tests run against `vis` stubs and the contract test only checks that the
 * library API exists. These tests exercise what only a real browser shows: the library
 * renders, emits the events our code listens for and our handlers react to them. They
 * are what makes a vis-network upgrade safe to merge.
 *
 * Requires a wiki seeded with seed-wiki.sh, see README.md ("Browser tests").
 */

const { test, expect } = require( '@playwright/test' );
const pkg = require( '../../package.json' );

const GRAPH_PAGE = '/index.php?title=KG_e2e_graph';
const COLLAPSE_PAGE = '/index.php?title=KG_e2e_collapse';
const DESIGNER_PAGE = '/index.php?title=Special:KnowledgeGraphDesigner';

/**
 * Collects console errors and uncaught exceptions of a page.
 *
 * @param {import('@playwright/test').Page} page
 * @return {string[]} live list, filled while the page runs
 */
function collectErrors( page ) {
	const errors = [];
	page.on( 'console', ( message ) => {
		if ( message.type() === 'error' ) {
			errors.push( `console: ${ message.text() }` );
		}
	} );
	page.on( 'pageerror', ( error ) => errors.push( `pageerror: ${ error.message }` ) );
	return errors;
}

/**
 * Records the vis.Network handles announced on the 'knowledgegraph.instance' hook in
 * `window.__kgInstance` (latest) and counts the announcements in `window.__kgFires`. The hook
 * is registered before any page script runs, so no announcement is missed.
 *
 * @param {import('@playwright/test').Page} page
 */
async function trackInstances( page ) {
	await page.addInitScript( () => {
		window.__kgInstance = null;
		window.__kgFires = 0;
		const timer = setInterval( () => {
			if ( window.mw && window.mw.hook ) {
				clearInterval( timer );
				window.mw.hook( 'knowledgegraph.instance' ).add( ( instance ) => {
					window.__kgInstance = instance;
					window.__kgFires++;
				} );
			}
		}, 5 );
	} );
}

/**
 * Opens a page with a graph and waits until it has nodes.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} url
 */
async function openGraph( page, url ) {
	await trackInstances( page );
	await page.goto( url );
	await page.waitForFunction( () => window.__kgInstance && window.__kgInstance.nodes.length > 0 );
}

/**
 * Opens the Designer. It starts with an empty graph; native confirm() and alert() dialogs
 * (used by "Reset graph" and "Export wikitext") are accepted.
 *
 * @param {import('@playwright/test').Page} page
 */
async function openDesigner( page ) {
	page.on( 'dialog', ( dialog ) => dialog.accept() );
	await trackInstances( page );
	await page.goto( DESIGNER_PAGE );
	await page.waitForFunction( () => window.__kgInstance !== null );
}

/**
 * Adds an article and its properties to the Designer graph through the "Add node" dialog.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} title article to add
 * @param {string} property label of the property to show, as listed in step 2 of the dialog
 */
async function addNodeViaDialog( page, title, property ) {
	const dialog = page.locator( '.oo-ui-window-active' );

	await page.locator( '.oo-ui-tool-name-add-node .oo-ui-tool-link' ).click();
	await dialog.locator( '.oo-ui-comboBoxInputWidget input.oo-ui-inputWidget-input' ).fill( title );
	// The suggestions are loaded from the API while typing. Options of a dialog opened earlier
	// stay in the DOM (hidden), so only look at visible ones inside the active dialog.
	await dialog.locator( '.oo-ui-optionWidget:visible', { hasText: new RegExp( `^${ title }$` ) } ).click();
	await dialog.getByText( 'Continue', { exact: true } ).click();
	await dialog.locator( 'label', { hasText: property } ).first().click();
	await dialog.getByText( 'Done', { exact: true } ).click();

	await expect( dialog ).toHaveCount( 0 );
}

/**
 * Resolves once the layout has settled, i.e. the on-screen position of every node stayed
 * the same for several consecutive samples. Interacting earlier hits nodes that are
 * still moving (physics simulation, initial fit-to-view animation).
 *
 * @param {import('@playwright/test').Page} page
 */
async function waitForSettledLayout( page ) {
	await page.waitForFunction( () => {
		const { network, nodes } = window.__kgInstance;
		const ids = nodes.getIds();
		const snapshot = JSON.stringify( ids.map( ( id ) => {
			const dom = network.canvasToDOM( network.getPositions( [ id ] )[ id ] );
			return [ Math.round( dom.x ), Math.round( dom.y ) ];
		} ) );
		const state = window.__kgSettle || { snapshot: null, since: 0 };
		if ( state.snapshot !== snapshot ) {
			window.__kgSettle = { snapshot, since: Date.now() };
			return false;
		}
		return Date.now() - state.since >= 500;
	}, null, { polling: 100 } );
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} nodeId
 * @return {Promise<{x: number, y: number}>} viewport coordinates of the node's center
 */
function nodeCenter( page, nodeId ) {
	return page.evaluate( ( id ) => {
		const network = window.__kgInstance.network;
		const dom = network.canvasToDOM( network.getPositions( [ id ] )[ id ] );
		const box = network.canvas.frame.canvas.getBoundingClientRect();
		return { x: box.left + dom.x, y: box.top + dom.y };
	}, nodeId );
}

/**
 * Finds a viewport point on an edge by probing around the middle between its two nodes
 * with the library's own hit test, so it works for straight and curved edges.
 *
 * @param {import('@playwright/test').Page} page
 * @return {Promise<{x: number, y: number}|null>}
 */
function pointOnAnEdge( page ) {
	return page.evaluate( () => {
		const { network, edges } = window.__kgInstance;
		const box = network.canvas.frame.canvas.getBoundingClientRect();
		for ( const edge of edges.get() ) {
			const positions = network.getPositions( [ edge.from, edge.to ] );
			const a = network.canvasToDOM( positions[ edge.from ] );
			const b = network.canvasToDOM( positions[ edge.to ] );
			for ( let t = 0.3; t <= 0.7; t += 0.1 ) {
				for ( let offset = -40; offset <= 40; offset += 4 ) {
					// Probe along the normal of the straight connection.
					const length = Math.hypot( b.x - a.x, b.y - a.y ) || 1;
					const x = a.x + ( b.x - a.x ) * t - ( ( b.y - a.y ) / length ) * offset;
					const y = a.y + ( b.y - a.y ) * t + ( ( b.x - a.x ) / length ) * offset;
					if ( network.getNodeAt( { x, y } ) === undefined && network.getEdgeAt( { x, y } ) !== undefined ) {
						return { x: box.left + x, y: box.top + y };
					}
				}
			}
		}
		return null;
	} );
}

test.describe( 'vis-network in the browser', () => {

	test( 'serves the vis-network version pinned in package.json', async ( { request } ) => {
		const response = await request.get( '/load.php?modules=ext.KnowledgeGraph&only=scripts&debug=true' );
		const script = await response.text();

		expect( script.match( /@version\s+(\d+\.\d+\.\d+)/ )[ 1 ] ).toBe( pkg.dependencies[ 'vis-network' ] );
	} );

	test( 'renders the graph from #knowledgegraph', async ( { page } ) => {
		const errors = collectErrors( page );

		await openGraph( page, GRAPH_PAGE );

		const ids = await page.evaluate( () => window.__kgInstance.nodes.get().map( ( node ) => node.id ) );
		expect( ids.sort() ).toEqual( [ 'Alice', 'Bob', 'Carol' ] );
		expect( await page.evaluate( () => window.__kgInstance.edges.length ) ).toBe( 3 );
		await expect( page.locator( '.vis-network canvas' ).first() ).toBeVisible();
		expect( errors ).toEqual( [] );
	} );

	test( 'maps a pointer position to the node under it', async ( { page } ) => {
		await openGraph( page, GRAPH_PAGE );
		await waitForSettledLayout( page );

		const { x, y } = await nodeCenter( page, 'Bob' );
		const hit = await page.evaluate( ( { x: px, y: py } ) => {
			const box = window.__kgInstance.network.canvas.frame.canvas.getBoundingClientRect();
			return window.__kgInstance.network.getNodeAt( { x: px - box.left, y: py - box.top } );
		}, { x, y } );

		expect( hit ).toBe( 'Bob' );
	} );

	test( 'selects an edge on hover and releases it again', async ( { page } ) => {
		await openGraph( page, GRAPH_PAGE );
		await waitForSettledLayout( page );

		const point = await pointOnAnEdge( page );
		expect( point, 'found a point on an edge' ).not.toBeNull();

		await page.mouse.move( point.x, point.y, { steps: 5 } );
		await expect.poll( () => page.evaluate( () => window.__kgInstance.network.getSelectedEdges().length ) )
			.toBe( 1 );

		await page.mouse.move( 5, 5, { steps: 5 } );
		await expect.poll( () => page.evaluate( () => window.__kgInstance.network.getSelectedEdges().length ) )
			.toBe( 0 );
	} );

	test( 'opens the node context menu on right click', async ( { page } ) => {
		await openGraph( page, GRAPH_PAGE );
		await waitForSettledLayout( page );

		const { x, y } = await nodeCenter( page, 'Bob' );
		await page.mouse.click( x, y, { button: 'right' } );

		await expect( page.locator( '.kg-node-properties-menu' ) ).toBeVisible();
	} );

	test( 'opens the article of a node on double click', async ( { page, context } ) => {
		await openGraph( page, GRAPH_PAGE );
		await waitForSettledLayout( page );

		const { x, y } = await nodeCenter( page, 'Bob' );
		const popup = context.waitForEvent( 'page' );
		await page.mouse.dblclick( x, y );

		expect( ( await popup ).url() ).toMatch( /\/(index\.php\?title=)?Bob$/ );
	} );

	test( 'collapses and expands the neighbors of a node on click', async ( { page } ) => {
		const errors = collectErrors( page );
		// depth=1: Bob and Carol are only neighbors of Alice, so clicking Alice toggles them.
		await openGraph( page, COLLAPSE_PAGE );
		await waitForSettledLayout( page );

		const hiddenNodes = () => page.evaluate( () => window.__kgInstance.nodes.get( { filter: ( node ) => node.hidden } )
			.map( ( node ) => node.id ).sort() );
		const hiddenEdges = () => page.evaluate( () => window.__kgInstance.edges.get( { filter: ( edge ) => edge.hidden } )
			.length );
		expect( await hiddenNodes() ).toEqual( [] );

		const { x, y } = await nodeCenter( page, 'Alice' );
		await page.mouse.click( x, y );
		await expect.poll( hiddenNodes ).toEqual( [ 'Bob', 'Carol' ] );
		expect( await hiddenEdges() ).toBe( 2 );

		await page.mouse.click( x, y );
		await expect.poll( hiddenNodes ).toEqual( [] );
		expect( await hiddenEdges() ).toBe( 0 );
		expect( errors ).toEqual( [] );
	} );
} );

test.describe( 'Designer', () => {

	test( 'loads without errors', async ( { page } ) => {
		const errors = collectErrors( page );

		await openDesigner( page );

		await expect( page.locator( '.oo-ui-toolbar' ).first() ).toBeVisible();
		await expect( page.locator( '.vis-network canvas' ).first() ).toBeVisible();
		expect( errors ).toEqual( [] );
	} );

	test( 'adds an article with its linked pages through the Add node dialog', async ( { page } ) => {
		const errors = collectErrors( page );
		await openDesigner( page );

		await addNodeViaDialog( page, 'Alice', 'Knows (Page)' );

		await expect.poll( () => page.evaluate( () => window.__kgInstance.nodes.getIds().sort() ) )
			.toEqual( [ 'Alice', 'Bob', 'Carol' ] );
		expect( await page.evaluate( () => window.__kgInstance.edges.length ) ).toBe( 3 );
		expect( errors ).toEqual( [] );
	} );

	test.describe( 'export', () => {
		test.use( { permissions: [ 'clipboard-read', 'clipboard-write' ] } );

		test( 'copies the visible graph as #knowledgegraph wikitext', async ( { page } ) => {
			await openDesigner( page );
			await addNodeViaDialog( page, 'Alice', 'Knows (Page)' );
			await expect.poll( () => page.evaluate( () => window.__kgInstance.nodes.length ) ).toBe( 3 );

			await page.locator( '.oo-ui-tool-name-export-graph .oo-ui-tool-link' ).click();

			await expect.poll( () => page.evaluate( () => navigator.clipboard.readText() ) )
				.toContain( 'nodes=Alice, Bob, Carol' );
			const wikitext = await page.evaluate( () => navigator.clipboard.readText() );
			expect( wikitext ).toMatch( /^\{\{#knowledgegraph:/ );
			expect( wikitext ).toContain( '|properties=Knows' );
		} );
	} );

	test( 'keeps the graph interactive after "Reset graph"', async ( { page } ) => {
		const errors = collectErrors( page );
		await openDesigner( page );
		await addNodeViaDialog( page, 'Alice', 'Knows (Page)' );
		await expect.poll( () => page.evaluate( () => window.__kgInstance.nodes.length ) ).toBe( 3 );
		const firesBefore = await page.evaluate( () => {
			window.__kgInstance.network.__beforeReset = true;
			return window.__kgFires;
		} );

		await page.locator( '.oo-ui-tool-name-reload .oo-ui-tool-link' ).click();

		await expect.poll( () => page.evaluate( () => window.__kgFires ) ).toBe( firesBefore + 1 );
		expect( await page.evaluate( () => window.__kgInstance.network.__beforeReset ), 'new network' )
			.toBeUndefined();
		expect( await page.evaluate( () => window.__kgInstance.nodes.length ), 'graph was emptied' ).toBe( 0 );

		// The click, hover, double-click and context menu handlers have to be bound to the new network.
		await addNodeViaDialog( page, 'Alice', 'Knows (Page)' );
		await expect.poll( () => page.evaluate( () => window.__kgInstance.nodes.length ) ).toBe( 3 );
		await waitForSettledLayout( page );
		const { x, y } = await nodeCenter( page, 'Bob' );

		await page.mouse.click( x, y, { button: 'right' } );
		await expect( page.locator( '.kg-node-properties-menu' ) ).toBeVisible();
		await page.mouse.click( 5, 5 );

		const popup = page.context().waitForEvent( 'page' );
		await page.mouse.dblclick( x, y );
		expect( ( await popup ).url() ).toMatch( /\/(index\.php\?title=)?Bob$/ );
		expect( errors ).toEqual( [] );
	} );
} );
