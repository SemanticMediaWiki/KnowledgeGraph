'use strict';

/**
 * Contract test between our code and the bundled vis-network library.
 *
 * All other tests run against hand-rolled `vis` stubs, so they keep passing when a
 * vis-network upgrade renames or removes an API we depend on. This test loads the real,
 * bundled library (resources/visNetwork/vis-network.min.js) and verifies that every
 * vis-network member our production code calls actually exists, and that the DataSet
 * behaves the way the code expects. The list of used members is derived from the
 * production sources, so new usages are covered without maintaining a second list.
 *
 * Not covered here (needs a real browser): rendering and the events emitted by Network.
 */

const fs = require( 'fs' );
const path = require( 'path' );

const RESOURCES = path.resolve( __dirname, '../../resources' );
const vis = require( path.join( RESOURCES, 'visNetwork/vis-network.min.js' ) );

// Production sources only: top-level resources/*.js, not the bundled library.
const sources = fs.readdirSync( RESOURCES )
	.filter( ( file ) => file.endsWith( '.js' ) )
	// eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed repository directory
	.map( ( file ) => fs.readFileSync( path.join( RESOURCES, file ), 'utf8' ) )
	.join( '\n' );

/**
 * @param {RegExp} pattern with one capture group (the member name); must carry the g flag
 * @return {string[]} unique member names found in the production sources
 */
function usedMembers( pattern ) {
	return [ ...new Set( [ ...sources.matchAll( pattern ) ].map( ( match ) => match[ 1 ] ) ) ].sort();
}

QUnit.module( 'ext.knowledgegraph.vis-contract', () => {

	QUnit.test( 'bundle exposes the constructors our code instantiates', ( assert ) => {
		usedMembers( /\bvis\.([A-Za-z]+)/g )
			// `vis.js` appears in comments only
			.filter( ( name ) => name !== 'js' )
			.forEach( ( name ) => {
				assert.strictEqual( typeof vis[ name ], 'function', `vis.${ name } is a constructor` );
			} );
	} );

	QUnit.test( 'Network provides every method called on self.Network', ( assert ) => {
		const methods = usedMembers( /\bself\.Network\.([A-Za-z]+)\(/g );

		assert.true( methods.length > 0, 'found Network usages in the sources (guards against a vacuous test)' );
		methods.forEach( ( name ) => {
			assert.strictEqual( typeof vis.Network.prototype[ name ], 'function', `Network#${ name }` );
		} );
	} );

	QUnit.test( 'DataSet provides every method called on the node and edge sets', ( assert ) => {
		const methods = usedMembers( /\b(?:self\.(?:Nodes|Edges)|nodes|edges)\.([A-Za-z]+)\(/g )
			// Array methods are called on plain arrays of the same name (e.g. `nodes.join`).
			.filter( ( name ) => !Array.prototype[ name ] );

		assert.true( methods.length > 0, 'found DataSet usages in the sources (guards against a vacuous test)' );
		methods.forEach( ( name ) => {
			assert.strictEqual( typeof vis.DataSet.prototype[ name ], 'function', `DataSet#${ name }` );
		} );
	} );

	QUnit.test( 'DataSet add, update, get and remove behave as the code expects', ( assert ) => {
		const nodes = new vis.DataSet( [] );

		nodes.add( { id: 'A#1', label: 'A' } );
		nodes.add( [ { id: 'B', label: 'B' }, { id: 'C', label: 'C' } ] );
		assert.strictEqual( nodes.length, 3, 'add() accepts a single item and an array' );

		nodes.update( { id: 'A#1', label: 'A2' } );
		assert.strictEqual( nodes.get( 'A#1' ).label, 'A2', 'update() changes an existing item by id' );
		assert.strictEqual( nodes.get( 'missing' ), null, 'get() of an unknown id returns null' );
		assert.deepEqual( nodes.get().map( ( node ) => node.id ), [ 'A#1', 'B', 'C' ], 'get() returns all items' );

		nodes.remove( 'B' );
		assert.deepEqual( nodes.get().map( ( node ) => node.id ), [ 'A#1', 'C' ], 'remove() by id' );

		assert.throws( () => nodes.add( { id: 'C' } ), 'add() rejects a duplicate id' );
	} );
} );
