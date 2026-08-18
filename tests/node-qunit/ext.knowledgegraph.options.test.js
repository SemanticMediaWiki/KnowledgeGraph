'use strict';

QUnit.module( 'ext.knowledgegraph.options', () => {

	QUnit.test( 'getDefaultOptions returns an object', ( assert ) => {
		const options = KnowledgeGraphOptions.getDefaultOptions();
		assert.strictEqual( typeof options, 'object', 'returns an object' );
	} );

	QUnit.test( 'getDefaultOptions returns independent objects on each call', ( assert ) => {
		const first = KnowledgeGraphOptions.getDefaultOptions();
		const second = KnowledgeGraphOptions.getDefaultOptions();

		assert.notStrictEqual( first, second, 'two calls return two different object references' );

		first.autoResize = false;
		first.edges.arrows.to.enabled = true;

		assert.strictEqual( second.autoResize, true, 'mutating one result does not affect a subsequent call' );
		assert.strictEqual( second.edges.arrows.to.enabled, false, 'mutating a nested value does not affect a subsequent call' );
	} );

	QUnit.test( 'getDefaultOptions spot-check of default values', ( assert ) => {
		const options = KnowledgeGraphOptions.getDefaultOptions();

		assert.strictEqual( options.autoResize, true, 'autoResize defaults to true' );
		assert.strictEqual( options.edges.arrows.to.enabled, false, 'edges.arrows.to.enabled defaults to false' );
		assert.strictEqual( options.nodes.color.border, '#2B7CE9', 'nodes.color.border has the expected default color' );
		assert.strictEqual( options.physics.barnesHut.theta, 0.5, 'physics.barnesHut.theta defaults to 0.5' );
		assert.strictEqual( options.layout.hierarchical.direction, 'UD', 'layout.hierarchical.direction defaults to UD' );
	} );

	QUnit.test( 'edges.scaling.customScalingFunction', ( assert ) => {
		const fn = KnowledgeGraphOptions.getDefaultOptions().edges.scaling.customScalingFunction;

		assert.strictEqual( fn( 5, 5, 0, 3 ), 0.5, 'returns 0.5 when max === min' );
		assert.strictEqual( fn( 0, 10, 0, 5 ), 0.5, 'returns the scaled ratio when value is halfway between min and max' );
		assert.strictEqual( fn( 0, 10, 0, 10 ), 1, 'returns 1 when value === max' );
		assert.strictEqual( fn( 0, 10, 0, -5 ), 0, 'clamps to 0 when value < min' );
	} );

	QUnit.test( 'nodes.scaling.customScalingFunction', ( assert ) => {
		const fn = KnowledgeGraphOptions.getDefaultOptions().nodes.scaling.customScalingFunction;

		assert.strictEqual( fn( 5, 5, 0, 3 ), 0.5, 'returns 0.5 when max === min' );
		assert.strictEqual( fn( 0, 10, 0, 5 ), 0.5, 'returns the scaled ratio when value is halfway between min and max' );
		assert.strictEqual( fn( 0, 10, 0, 10 ), 1, 'returns 1 when value === max' );
		assert.strictEqual( fn( 0, 10, 0, -5 ), 0, 'clamps to 0 when value < min' );
	} );

} );
