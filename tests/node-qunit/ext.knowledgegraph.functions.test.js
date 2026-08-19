'use strict';

QUnit.module( 'ext.knowledgegraph.functions', () => {

	QUnit.test( 'isObject', ( assert ) => {
		assert.true( KnowledgeGraphFunctions.isObject( {} ), 'a plain object is an object' );
		assert.false( KnowledgeGraphFunctions.isObject( [] ), 'an array is not an object' );
		assert.false( KnowledgeGraphFunctions.isObject( null ), 'null is not an object' );
	} );

	QUnit.test( 'getNestedProp', ( assert ) => {
		const obj = { a: { b: { c: 42 } } };
		assert.strictEqual( KnowledgeGraphFunctions.getNestedProp( [ 'a', 'b', 'c' ], obj ), 42, 'resolves a nested path' );
		assert.strictEqual( KnowledgeGraphFunctions.getNestedProp( [ 'a', 'x' ], obj ), null, 'returns null for a missing path segment' );
	} );

	QUnit.test( 'makeNodeId', ( assert ) => {
		assert.strictEqual( KnowledgeGraphFunctions.makeNodeId( 'Foo', 3 ), 'Foo#3', 'joins label and typeId with "#"' );
	} );

	QUnit.test( 'makeEdgeId', ( assert ) => {
		assert.strictEqual(
			KnowledgeGraphFunctions.makeEdgeId( 'A', 'B', 'prop', 2 ),
			'A→prop→B#2',
			'appends typeId to a bare "to" id'
		);
		assert.strictEqual(
			KnowledgeGraphFunctions.makeEdgeId( 'A', 'B#7', 'prop', 2 ),
			'A→prop→B#7',
			'leaves a "to" id untouched when it already contains "#"'
		);
	} );

	QUnit.test( 'colorForPropertyLabel', ( assert ) => {
		const colors = [ 'red', 'blue' ];
		const propColors = {};
		const first = KnowledgeGraphFunctions.colorForPropertyLabel( 'P1', colors, propColors );
		const again = KnowledgeGraphFunctions.colorForPropertyLabel( 'P1', colors, propColors );
		assert.strictEqual( first, 'red', 'assigns the first color to the first label' );
		assert.strictEqual( again, first, 'returns the same color for a label seen before' );
	} );

	QUnit.test( 'rgbToHex', ( assert ) => {
		assert.strictEqual(
			KnowledgeGraphFunctions.rgbToHex( 'rgb(255, 0, 16)' ),
			'#ff0010',
			'converts a well-formed rgb() string to a zero-padded lowercase hex string'
		);
		assert.strictEqual(
			KnowledgeGraphFunctions.rgbToHex( 'not-a-color' ),
			'#000000',
			'returns "#000000" when the string has no numeric groups'
		);
	} );

	QUnit.test( 'getContrastColor', ( assert ) => {
		assert.strictEqual(
			KnowledgeGraphFunctions.getContrastColor( '#000000' ),
			'#FFFFFF',
			'a color already starting with "#" is used as-is'
		);
		assert.strictEqual(
			KnowledgeGraphFunctions.getContrastColor( 'rgb(0, 0, 0)' ),
			'#FFFFFF',
			'a non-"#" input is converted via rgbToHex before comparison'
		);
		assert.strictEqual(
			KnowledgeGraphFunctions.getContrastColor( '#000000' ),
			'#FFFFFF',
			'a dark color (low luminance) returns "#FFFFFF"'
		);
		assert.strictEqual(
			KnowledgeGraphFunctions.getContrastColor( '#ffffff' ),
			null,
			'a light color (contrast ratio with black below the 7.5 threshold) returns null'
		);
	} );

	QUnit.test( 'randomHSL', ( assert ) => {
		const value = KnowledgeGraphFunctions.randomHSL();
		const match = value.match( /^hsla\(([\d.]+),70%,80%,1\)$/ );
		assert.true( match !== null, 'matches the "hsla(<number>,70%,80%,1)" pattern' );
		const hue = Number( match[ 1 ] );
		assert.true( hue >= 0 && hue < 360, 'the hue is in the [0, 360) range' );
	} );

	QUnit.test( 'uuidv4', ( assert ) => {
		const value = KnowledgeGraphFunctions.uuidv4();
		assert.true(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test( value ),
			'returns a string matching the standard UUID v4 8-4-4-4-12 hex-group shape'
		);
	} );

} );
