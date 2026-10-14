'use strict';

// Every source string below carries a unique comment so the shared
// KnowledgeGraph.moduleCache never serves a result from another test.
let moduleCounter = 0;
function moduleSource( exportedValue ) {
	moduleCounter++;
	return `// module ${ moduleCounter }\nexport default ${ JSON.stringify( exportedValue ) };`;
}

// The default options hold a fresh customScalingFunction per call, which never
// compares deep-equal; comparing their JSON form covers all the data.
function asData( value ) {
	return JSON.parse( JSON.stringify( value ) );
}

// Runs fn() with console.error captured, restoring it afterwards.
async function captureConsoleError( fn ) {
	/* eslint-disable no-console */
	const original = console.error;
	const logged = [];
	console.error = ( ...args ) => {
		logged.push( args );
	};
	try {
		await fn();
	} finally {
		console.error = original;
	}
	/* eslint-enable no-console */
	return logged;
}

QUnit.module( 'ext.knowledgegraph bootstrap helpers', ( hooks ) => {

	hooks.beforeEach( () => {
		KnowledgeGraph.moduleCache.clear();
	} );

	QUnit.module( 'loadModule', () => {

		QUnit.test( 'returns null without importing for non-string and blank input', async ( assert ) => {
			for ( const input of [ undefined, null, 42, {}, '', '   \n\t' ] ) {
				assert.strictEqual( await KnowledgeGraph.loadModule( input ), null, `${ JSON.stringify( input ) } is ignored` );
			}
			assert.strictEqual( KnowledgeGraph.moduleCache.size, 0, 'nothing was cached' );
		} );

		QUnit.test( 'returns the default export of a valid module source', async ( assert ) => {
			const result = await KnowledgeGraph.loadModule( moduleSource( { physics: { enabled: false } } ) );

			assert.deepEqual( result, { physics: { enabled: false } }, 'the default export is returned' );
		} );

		QUnit.test( 'serves a repeated source from the cache', async ( assert ) => {
			const source = moduleSource( { a: 1 } );

			const first = await KnowledgeGraph.loadModule( source );
			const second = await KnowledgeGraph.loadModule( source );

			assert.strictEqual( second, first, 'the same object is returned, not a freshly imported one' );
			assert.strictEqual( KnowledgeGraph.moduleCache.size, 1, 'one cache entry' );
		} );

		QUnit.test( 'returns null for a module without a default export', async ( assert ) => {
			const result = await KnowledgeGraph.loadModule( '// no default\nexport const named = 1;' );

			assert.strictEqual( result, null, 'null instead of undefined' );
		} );

		QUnit.test( 'returns null, logs the error and does not cache a module that fails to load', async ( assert ) => {
			let result;
			const logged = await captureConsoleError( async () => {
				result = await KnowledgeGraph.loadModule( 'export default {' );
			} );

			assert.strictEqual( result, null, 'null is returned' );
			assert.strictEqual( logged.length, 1, 'the failure is logged once' );
			assert.strictEqual( logged[ 0 ][ 0 ], 'KnowledgeGraph: Failed to load module:', 'with the module-load prefix' );
			assert.strictEqual( KnowledgeGraph.moduleCache.size, 0, 'the failure is not cached' );
		} );

	} );

	QUnit.module( 'buildConfig', () => {

		QUnit.test( 'fills in defaults for an empty graph', async ( assert ) => {
			const config = await KnowledgeGraph.buildConfig( {} );

			assert.deepEqual( config.data, {}, 'data defaults to {}' );
			assert.deepEqual( config.properties, [], 'properties defaults to []' );
			assert.strictEqual( config.depth, '', 'depth defaults to an empty string' );
			assert.strictEqual( config.context, 'parserfunction', 'context defaults to parserfunction' );
			assert.false( config[ 'show-toolbar' ], 'show-toolbar defaults to false' );
			assert.false( config[ 'show-property-type' ], 'show-property-type defaults to false' );
			assert.deepEqual( config.propertyOptions, {}, 'propertyOptions defaults to {}' );
			assert.deepEqual( asData( config.graphOptions ), asData( KnowledgeGraphOptions.getDefaultOptions() ), 'graphOptions are the defaults' );
		} );

		QUnit.test( 'keeps the given values over the defaults', async ( assert ) => {
			const config = await KnowledgeGraph.buildConfig( {
				data: { Foo: { properties: {} } },
				properties: [ 'Has_Author' ],
				depth: 2,
				'show-toolbar': true,
				context: 'designer'
			} );

			assert.deepEqual( config.data, { Foo: { properties: {} } }, 'data is kept' );
			assert.deepEqual( config.properties, [ 'Has_Author' ], 'properties are kept' );
			assert.strictEqual( config.depth, 2, 'depth is kept' );
			assert.true( config[ 'show-toolbar' ], 'show-toolbar is kept' );
			assert.strictEqual( config.context, 'designer', 'context is kept' );
		} );

		QUnit.test( 'merges a graphOptions object over the default options', async ( assert ) => {
			const defaults = KnowledgeGraphOptions.getDefaultOptions();

			const config = await KnowledgeGraph.buildConfig( { graphOptions: { locale: 'de', physics: { enabled: false } } } );

			assert.strictEqual( config.graphOptions.locale, 'de', 'the given option wins' );
			assert.false( config.graphOptions.physics.enabled, 'including nested ones' );
			assert.deepEqual( asData( config.graphOptions.nodes ), asData( defaults.nodes ), 'untouched defaults remain' );
		} );

		QUnit.test( 'falls back to the default options when graphOptions is not an object or a module string', async ( assert ) => {
			for ( const invalid of [ undefined, null, 7, [ 'a' ], true ] ) {
				const config = await KnowledgeGraph.buildConfig( { graphOptions: invalid } );

				assert.deepEqual(
					asData( config.graphOptions ),
					asData( KnowledgeGraphOptions.getDefaultOptions() ),
					`${ JSON.stringify( invalid ) } yields the defaults`
				);
			}
		} );

		QUnit.test( 'resolves a graphOptions module string and merges it over the defaults', async ( assert ) => {
			const config = await KnowledgeGraph.buildConfig( { graphOptions: moduleSource( { locale: 'fr' } ) } );

			assert.strictEqual( config.graphOptions.locale, 'fr', 'the module export is used' );
			assert.deepEqual(
				asData( config.graphOptions.nodes ),
				asData( KnowledgeGraphOptions.getDefaultOptions().nodes ),
				'defaults still apply'
			);
		} );

		QUnit.test( 'applies a requested width and height to graphOptions only when given', async ( assert ) => {
			const defaults = KnowledgeGraphOptions.getDefaultOptions();

			const without = await KnowledgeGraph.buildConfig( {} );
			assert.strictEqual( without.graphOptions.width, defaults.width, 'no width requested: the default stays' );
			assert.strictEqual( without.graphOptions.height, defaults.height, 'no height requested: the default stays' );

			const withSize = await KnowledgeGraph.buildConfig( { width: '50%', height: '400px' } );
			assert.strictEqual( withSize.graphOptions.width, '50%', 'the requested width is applied' );
			assert.strictEqual( withSize.graphOptions.height, '400px', 'the requested height is applied' );
		} );

		QUnit.test( 'keeps plain-object propertyOptions and resolves module strings', async ( assert ) => {
			const config = await KnowledgeGraph.buildConfig( {
				propertyOptions: {
					Plain: { color: 'red' },
					FromModule: moduleSource( { color: 'blue' } )
				}
			} );

			assert.deepEqual( config.propertyOptions.Plain, { color: 'red' }, 'a plain object is kept' );
			assert.deepEqual( config.propertyOptions.FromModule, { color: 'blue' }, 'a module string is resolved' );
		} );

		QUnit.test( 'replaces propertyOptions entries that are neither object nor module string with {}', async ( assert ) => {
			const config = await KnowledgeGraph.buildConfig( {
				propertyOptions: { Number: 5, Nothing: null, List: [ 1 ] }
			} );

			assert.deepEqual( config.propertyOptions, { Number: {}, Nothing: {}, List: {} }, 'each invalid entry becomes {}' );
		} );

		QUnit.test( 'uses {} when propertyOptions itself is not a plain object', async ( assert ) => {
			for ( const invalid of [ undefined, null, 'text', [ 'a' ] ] ) {
				const config = await KnowledgeGraph.buildConfig( { propertyOptions: invalid } );

				assert.deepEqual( config.propertyOptions, {}, `${ JSON.stringify( invalid ) } yields {}` );
			}
		} );

	} );

} );
