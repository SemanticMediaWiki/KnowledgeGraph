'use strict';

// Captures the params passed to `new mw.Api().get( params )` / `.postWithToken( type, params )`
// during fn(), and resolves/rejects with the given response(s) -- mirrors the mw.Api mocking
// pattern used in ext.knowledgegraph.dialog.test.js for KnowledgeGraph.js's SMW browse and
// knowledgegraph-load-* API call sites.
function stubApi( { getResponse, getFails, postResponse, postFails } = {} ) {
	let capturedGetParams;
	let capturedPostParams;
	const OriginalApi = mw.Api;

	mw.Api = function () {};
	mw.Api.prototype.get = function ( params ) {
		capturedGetParams = params;
		return {
			done( fn ) {
				if ( !getFails && getResponse !== undefined ) {
					fn( getResponse );
				}
				return this;
			},
			fail( fn ) {
				if ( getFails ) {
					fn( getResponse );
				}
				return this;
			}
		};
	};
	mw.Api.prototype.postWithToken = function ( tokenType, params ) {
		capturedPostParams = params;
		return {
			done( fn ) {
				if ( !postFails && postResponse !== undefined ) {
					fn( postResponse );
				}
				return this;
			},
			fail( fn ) {
				if ( postFails ) {
					fn( postResponse );
				}
				return this;
			}
		};
	};

	return {
		restore() {
			mw.Api = OriginalApi;
		},
		getCapturedGetParams() {
			return capturedGetParams;
		},
		getCapturedPostParams() {
			return capturedPostParams;
		}
	};
}

QUnit.module( 'ext.knowledgegraph', ( hooks ) => {

	let graph;

	hooks.beforeEach( () => {
		graph = new KnowledgeGraph();
	} );

	QUnit.module( 'wrapLabel', () => {

		QUnit.test( 'a short text returns unchanged, trimmed, as a single line', ( assert ) => {
			assert.strictEqual( graph.wrapLabel( 'Short text', 20 ), 'Short text', 'text under maxLength is returned unchanged' );
			assert.strictEqual( graph.wrapLabel( '  Short text  ', 20 ), 'Short text', 'surrounding whitespace is trimmed' );
		} );

		QUnit.test( 'a long text wraps onto multiple lines not exceeding maxLength', ( assert ) => {
			const result = graph.wrapLabel( 'one two three four five six seven', 10 );

			assert.strictEqual( result, 'one two\nthree four\nfive six\nseven', 'text wraps at word boundaries within maxLength' );

			result.split( '\n' ).forEach( ( line, i ) => {
				if ( i < result.split( '\n' ).length - 1 ) {
					assert.true( line.length <= 10, `line "${ line }" does not exceed maxLength` );
				}
			} );
		} );

		QUnit.test( 'the trailing line is trimmed and appended without an extra newline', ( assert ) => {
			const result = graph.wrapLabel( 'one two three four five six seven', 10 );

			assert.false( result.endsWith( '\n' ), 'the result does not end with a newline' );
			assert.strictEqual( result.split( '\n' ).pop(), 'seven', 'the trailing line holds the remaining word(s), trimmed' );
		} );

	} );

	QUnit.module( 'checkAndToogleId', () => {

		QUnit.test( 'trims whitespace, replaces underscores with spaces, and strips a #... suffix', ( assert ) => {
			assert.strictEqual( graph.checkAndToogleId( 'Foo_Bar#3' ), 'Foo Bar', 'underscores become spaces and the #suffix is stripped' );
			assert.strictEqual( graph.checkAndToogleId( '  Foo_Bar  ' ), 'Foo Bar', 'surrounding whitespace is trimmed' );
			assert.strictEqual( graph.checkAndToogleId( 'Foo' ), 'Foo', 'a plain id without underscores or a #suffix is unchanged' );
		} );

	} );

	QUnit.module( 'cleanLabel', () => {

		QUnit.test( 'strips a leading "-" if present', ( assert ) => {
			assert.strictEqual( graph.cleanLabel( '-Label' ), 'Label', 'a leading "-" is stripped' );
			assert.strictEqual( graph.cleanLabel( 'Label' ), 'Label', 'a label without a leading "-" is unchanged' );
		} );

		QUnit.test( 'strips a trailing parenthetical', ( assert ) => {
			assert.strictEqual( graph.cleanLabel( 'Label (extra)' ), 'Label', 'a trailing "(...)" is stripped' );
			assert.strictEqual( graph.cleanLabel( 'Label' ), 'Label', 'a label without a trailing parenthetical is unchanged' );
		} );

		QUnit.test( 'trims whitespace', ( assert ) => {
			assert.strictEqual( graph.cleanLabel( '  Label  ' ), 'Label', 'surrounding whitespace is trimmed' );
		} );

		QUnit.test( 'strips a leading "-" and a trailing parenthetical together', ( assert ) => {
			assert.strictEqual( graph.cleanLabel( '-Label (extra)' ), 'Label', 'both are stripped, leaving the trimmed label' );
			assert.strictEqual( graph.cleanLabel( '-Label (extra)  ' ), 'Label', 'both are stripped with trailing whitespace also trimmed' );
		} );

	} );

	QUnit.module( 'isPlainObject', () => {

		QUnit.test( 'true for plain object literals', ( assert ) => {
			assert.true( KnowledgeGraph.isPlainObject( {} ), 'an empty object literal is a plain object' );
			assert.true( KnowledgeGraph.isPlainObject( { a: 1 } ), 'a non-empty object literal is a plain object' );
		} );

		QUnit.test( 'false for null, arrays, strings, functions, and instances of other constructors', ( assert ) => {
			assert.false( KnowledgeGraph.isPlainObject( null ), 'null is not a plain object' );
			assert.false( KnowledgeGraph.isPlainObject( [] ), 'an array is not a plain object' );
			assert.false( KnowledgeGraph.isPlainObject( 'str' ), 'a string is not a plain object' );
			assert.false( KnowledgeGraph.isPlainObject( () => {} ), 'a function is not a plain object' );
			assert.false( KnowledgeGraph.isPlainObject( new Date() ), 'an instance of another constructor is not a plain object' );
		} );

	} );

	QUnit.module( 'getPropertyValueForNode', () => {

		QUnit.test( 'returns null when self.nodePropertiesCache[nodeId] is absent', ( assert ) => {
			assert.strictEqual( graph.getPropertyValueForNode( 'Missing', 'Has_Author', 'out' ), null, 'no cache entry for the node returns null' );
		} );

		QUnit.test( 'finds a matching entry by normalized property name and direction', ( assert ) => {
			const entry = { property: 'Has_Author', direction: 'out', value: [ 'X' ] };
			graph.nodePropertiesCache.NodeA = [ entry ];

			assert.strictEqual(
				graph.getPropertyValueForNode( 'NodeA', 'has author', 'out' ),
				entry,
				'matches case-insensitively with underscores normalized to spaces'
			);
		} );

		QUnit.test( 'returns null when no entry matches the property name and direction', ( assert ) => {
			const entry = { property: 'Has_Author', direction: 'out', value: [ 'X' ] };
			graph.nodePropertiesCache.NodeA = [ entry ];

			assert.strictEqual( graph.getPropertyValueForNode( 'NodeA', 'has author', 'in' ), null, 'a direction mismatch returns null' );
			assert.strictEqual( graph.getPropertyValueForNode( 'NodeA', 'other property', 'out' ), null, 'a property-name mismatch returns null' );
		} );

	} );

	QUnit.module( 'fetchNamespaceNameForNode', () => {

		QUnit.test( 'defaults the namespace id to 0 when there is no # in the title', ( assert ) => {
			mw.config.set( 'wgFormattedNamespaces', { 0: '' } );

			assert.strictEqual( graph.fetchNamespaceNameForNode( 'Foo' ), 'Main', 'namespace 0 with an empty formatted name falls back to Main' );
		} );

		QUnit.test( 'looks up the namespace id from a #<nsId> suffix', ( assert ) => {
			mw.config.set( 'wgFormattedNamespaces', { 102: 'Property' } );

			assert.strictEqual( graph.fetchNamespaceNameForNode( 'Foo#102' ), 'Property', 'the namespace name is looked up from wgFormattedNamespaces' );
		} );

		QUnit.test( 'falls back to Main when the namespace id is missing from wgFormattedNamespaces', ( assert ) => {
			mw.config.set( 'wgFormattedNamespaces', { 102: 'Property' } );

			assert.strictEqual( graph.fetchNamespaceNameForNode( 'Foo#999' ), 'Main', 'an unknown namespace id falls back to Main' );
		} );

		QUnit.test( 'falls back to Main when the #suffix does not parse as a namespace id', ( assert ) => {
			mw.config.set( 'wgFormattedNamespaces', { 102: 'Property' } );

			assert.strictEqual( graph.fetchNamespaceNameForNode( 'Foo#abc' ), 'Main', 'a non-numeric suffix (NaN) falls back to Main' );
		} );

	} );

	QUnit.module( 'parseProperties', () => {

		QUnit.test( 'prefers di.label, then di.title, then the raw string, then di.item, else \'\'', ( assert ) => {
			const result = graph.parseProperties( [
				{
					property: 'Has_Mixed',
					direction: 'out',
					dataitem: [
						{ label: 'Label wins', title: 'Title', item: 'Item' },
						{ title: 'Title wins' },
						'raw string wins',
						{ item: 'Item wins' },
						{}
					]
				}
			] );

			assert.deepEqual(
				result[ 0 ].value,
				[ 'Label wins', 'Title wins', 'raw string wins', 'Item wins' ],
				'preference order is label > title > raw string > item, and falsy ("") results are filtered out'
			);
		} );

		QUnit.test( 'typeID is taken from dataitem[0].type when present, else null', ( assert ) => {
			const withType = graph.parseProperties( [
				// The real smwbrowse API always sends a numeric SMW DataItem::TYPE_*
				// id here (9 = TYPE_WIKIPAGE), never the property-level type string.
				{ property: 'Has_Author', direction: 'out', dataitem: [ { label: 'X', type: 9 } ] }
			] );
			assert.strictEqual( withType[ 0 ].typeID, 9, 'typeID is read from dataitem[0].type' );

			const withoutType = graph.parseProperties( [
				{ property: 'Has_Author', direction: 'out', dataitem: [ { label: 'X' } ] }
			] );
			assert.strictEqual( withoutType[ 0 ].typeID, null, 'typeID defaults to null when dataitem[0].type is absent' );
		} );

		QUnit.test( 'an empty or absent dataitem produces value: [] and typeID: null', ( assert ) => {
			const emptyArray = graph.parseProperties( [ { property: 'Has_Author', direction: 'out', dataitem: [] } ] );
			assert.deepEqual( emptyArray[ 0 ].value, [], 'an empty dataitem array produces value: []' );
			assert.strictEqual( emptyArray[ 0 ].typeID, null, 'an empty dataitem array produces typeID: null' );

			const absent = graph.parseProperties( [ { property: 'Has_Author', direction: 'out' } ] );
			assert.deepEqual( absent[ 0 ].value, [], 'an absent dataitem produces value: []' );
			assert.strictEqual( absent[ 0 ].typeID, null, 'an absent dataitem produces typeID: null' );
		} );

		QUnit.test( 'output preserves property and direction from the input item', ( assert ) => {
			const result = graph.parseProperties( [
				{ property: 'Has_Author', direction: 'out', dataitem: [ { label: 'X' } ] },
				{ property: 'Has_Editor', direction: 'in', dataitem: [ { label: 'Y' } ] }
			] );

			assert.strictEqual( result[ 0 ].property, 'Has_Author', 'property is preserved for the first item' );
			assert.strictEqual( result[ 0 ].direction, 'out', 'direction is preserved for the first item' );
			assert.strictEqual( result[ 1 ].property, 'Has_Editor', 'property is preserved for the second item' );
			assert.strictEqual( result[ 1 ].direction, 'in', 'direction is preserved for the second item' );
		} );

	} );

	QUnit.module( 'fetchSemanticDataForNode', ( hooks ) => {

		let api;
		let originalWarn;
		let originalError;
		let warnCalls;
		let errorCalls;

		hooks.beforeEach( () => {
			warnCalls = [];
			errorCalls = [];
			// eslint-disable-next-line no-console
			originalWarn = console.warn;
			// eslint-disable-next-line no-console
			originalError = console.error;
			// eslint-disable-next-line no-console
			console.warn = ( ...args ) => warnCalls.push( args );
			// eslint-disable-next-line no-console
			console.error = ( ...args ) => errorCalls.push( args );
		} );

		hooks.afterEach( () => {
			if ( api ) {
				api.restore();
				api = null;
			}
			// eslint-disable-next-line no-console
			console.warn = originalWarn;
			// eslint-disable-next-line no-console
			console.error = originalError;
		} );

		QUnit.test( 'a title with a #2 suffix (namespace type 2) calls back with [] immediately, without calling the API', ( assert ) => {
			api = stubApi( {} );
			let received;

			graph.fetchSemanticDataForNode( 'Foo#2', ( result ) => {
				received = result;
			} );

			assert.deepEqual( received, [], 'callback is invoked synchronously with []' );
			assert.strictEqual( api.getCapturedGetParams(), undefined, 'mw.Api().get() is not called' );
		} );

		QUnit.test( 'a successful response filters out properties starting with "_" and calls back with the rest', ( assert ) => {
			api = stubApi( {
				getResponse: {
					query: {
						data: [
							{ property: '_MDAT', direction: 'out', dataitem: [] },
							{ property: 'Has_Author', direction: 'out', dataitem: [] }
						]
					}
				}
			} );
			let received;

			return new Promise( ( resolve ) => {
				graph.fetchSemanticDataForNode( 'Foo', ( result ) => {
					received = result;
					resolve();
				} );
			} ).then( () => {
				assert.deepEqual(
					received,
					[ { property: 'Has_Author', direction: 'out', dataitem: [] } ],
					'the filtered list (excluding "_"-prefixed properties) is passed to the callback'
				);
				assert.strictEqual( errorCalls.length, 0, 'no console error is logged on success' );
			} );
		} );

		QUnit.test( 'a successful response whose filter empties the list calls back with [] and logs a console warning', ( assert ) => {
			api = stubApi( {
				getResponse: {
					query: {
						data: [
							{ property: '_MDAT', direction: 'out', dataitem: [] }
						]
					}
				}
			} );
			let received;

			return new Promise( ( resolve ) => {
				graph.fetchSemanticDataForNode( 'Foo', ( result ) => {
					received = result;
					resolve();
				} );
			} ).then( () => {
				assert.deepEqual( received, [], 'callback is invoked with [] once the filter removes every property' );
				assert.strictEqual( warnCalls.length, 1, 'a console warning is logged' );
			} );
		} );

		QUnit.test( 'a response missing data.query.data calls back with [] and logs a console warning', ( assert ) => {
			api = stubApi( { getResponse: {} } );
			let received;

			return new Promise( ( resolve ) => {
				graph.fetchSemanticDataForNode( 'Foo', ( result ) => {
					received = result;
					resolve();
				} );
			} ).then( () => {
				assert.deepEqual( received, [], 'callback is invoked with [] when data.query.data is missing' );
				assert.strictEqual( warnCalls.length, 1, 'a console warning is logged' );
			} );
		} );

		QUnit.test( 'an API failure calls back with [] and logs a console error', ( assert ) => {
			api = stubApi( { getResponse: { some: 'error' }, getFails: true } );
			let received;

			return new Promise( ( resolve ) => {
				graph.fetchSemanticDataForNode( 'Foo', ( result ) => {
					received = result;
					resolve();
				} );
			} ).then( () => {
				assert.deepEqual( received, [], 'callback is invoked with [] on API failure' );
				assert.strictEqual( errorCalls.length, 1, 'a console error is logged' );
			} );
		} );

	} );

	QUnit.module( 'loadNodes', ( hooks ) => {

		let api;

		hooks.afterEach( () => {
			if ( api ) {
				api.restore();
				api = null;
			}
		} );

		QUnit.test( 'a title-based request posts a knowledgegraph-load-nodes payload with the serialized Config.properties', ( assert ) => {
			api = stubApi( { postResponse: { 'knowledgegraph-load-nodes': { data: '{}' } } } );
			graph.setConfig( { properties: [ 'Has_Author' ] } );

			return graph.loadNodes( { title: 'Foo', properties: null, depth: 2 } ).then( () => {
				assert.deepEqual(
					api.getCapturedPostParams(),
					{
						action: 'knowledgegraph-load-nodes',
						titles: 'Foo',
						depth: 2,
						properties: JSON.stringify( [ 'Has_Author' ] )
					},
					'the payload has the expected shape for a title-based request'
				);
			} );
		} );

		QUnit.test( 'a properties-based request posts a knowledgegraph-load-properties payload', ( assert ) => {
			api = stubApi( { postResponse: { 'knowledgegraph-load-properties': { data: '{}' } } } );

			return graph.loadNodes( {
				title: null,
				properties: [ 'Has_Author', 'Has_Editor' ],
				titles: [ 'Foo' ],
				depth: 1,
				limit: 10,
				offset: 0,
				inversePropsIncluded: true
			} ).then( () => {
				assert.deepEqual(
					api.getCapturedPostParams(),
					{
						action: 'knowledgegraph-load-properties',
						properties: 'Has_Author|Has_Editor',
						nodes: [ 'Foo' ],
						depth: 1,
						limit: 10,
						offset: 0,
						inversePropsIncluded: true
					},
					'the payload has the expected shape for a properties-based request'
				);
			} );
		} );

		QUnit.test( 'a categories-based request posts a knowledgegraph-load-categories payload', ( assert ) => {
			api = stubApi( { postResponse: { 'knowledgegraph-load-categories': { data: '{}' } } } );

			return graph.loadNodes( {
				title: null,
				properties: null,
				categories: [ 'CatA', 'CatB' ],
				depth: 1,
				limit: 5,
				offset: 0
			} ).then( () => {
				assert.deepEqual(
					api.getCapturedPostParams(),
					{
						action: 'knowledgegraph-load-categories',
						categories: 'CatA|CatB',
						depth: 1,
						limit: 5,
						offset: 0
					},
					'the payload has the expected shape for a categories-based request'
				);
			} );
		} );

		QUnit.test( 'resolves with the parsed data from the matching payload.action key', ( assert ) => {
			const parsedData = { Foo: { properties: [] } };
			api = stubApi( {
				postResponse: { 'knowledgegraph-load-nodes': { data: JSON.stringify( parsedData ) } }
			} );
			graph.setConfig( { properties: [] } );

			return graph.loadNodes( { title: 'Foo', properties: null, depth: 1 } ).then( ( data ) => {
				assert.deepEqual( data, parsedData, 'the resolved value is the JSON.parse of the action-keyed data' );
			} );
		} );

		QUnit.test( 'rejects when the response is missing a "data" key for the payload action', ( assert ) => {
			api = stubApi( { postResponse: { 'knowledgegraph-load-nodes': {} } } );
			graph.setConfig( { properties: [] } );

			return graph.loadNodes( { title: 'Foo', properties: null, depth: 1 } ).then(
				() => {
					assert.true( false, 'the promise should not resolve when "data" is missing' );
				},
				() => {
					assert.true( true, 'the promise rejects when "data" is missing from the response' );
				}
			);
		} );

		QUnit.test( 'rejects with the failure response on API failure', ( assert ) => {
			const failureResponse = { error: 'boom' };
			api = stubApi( { postResponse: failureResponse, postFails: true } );
			graph.setConfig( { properties: [] } );

			return graph.loadNodes( { title: 'Foo', properties: null, depth: 1 } ).then(
				() => {
					assert.true( false, 'the promise should not resolve on API failure' );
				},
				( reason ) => {
					assert.deepEqual( reason, failureResponse, 'the promise rejects with the failure response' );
				}
			);
		} );

	} );

} );
