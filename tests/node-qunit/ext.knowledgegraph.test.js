'use strict';

// Captures the params passed to `new mw.Api().postWithToken( type, params )` during
// fn(), and resolves/rejects with the given response -- mirrors the mw.Api mocking
// pattern used in ext.knowledgegraph.dialog.test.js for KnowledgeGraph.js's
// knowledgegraph-load-* API call sites (loadNodes()).
function stubApi( { postResponse, postFails } = {} ) {
	let capturedPostParams;
	const OriginalApi = mw.Api;

	mw.Api = function () {};
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
