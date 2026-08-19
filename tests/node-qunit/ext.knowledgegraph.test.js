'use strict';

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

} );
