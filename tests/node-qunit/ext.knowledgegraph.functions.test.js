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

} );
