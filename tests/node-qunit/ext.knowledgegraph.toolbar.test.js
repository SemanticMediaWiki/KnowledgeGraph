'use strict';

// Registers each Tool class passed to OO.ui.ToolFactory.prototype.register()
// during fn() into an array, then restores the original register().
function captureRegisteredTools( fn ) {
	const registered = [];
	const original = OO.ui.ToolFactory.prototype.register;
	OO.ui.ToolFactory.prototype.register = function ( ToolClass ) {
		registered.push( ToolClass );
		return original.call( this, ToolClass );
	};
	try {
		fn();
	} finally {
		OO.ui.ToolFactory.prototype.register = original;
	}
	return registered;
}

// Captures the arguments passed to `new OO.ui.Toolbar( ... )` during fn(),
// since the hand-rolled Widget stub only stores its first constructor
// argument as this.config -- not useful for asserting the { actions } object
// passed as the third argument here.
function captureToolbarConstructorArgs( fn ) {
	const Original = OO.ui.Toolbar;
	let capturedArgs;
	function Wrapped( ...args ) {
		capturedArgs = args;
		return Original.apply( this, args );
	}
	Wrapped.prototype = Original.prototype;
	Wrapped.static = Original.static;
	OO.ui.Toolbar = Wrapped;
	try {
		fn();
	} finally {
		OO.ui.Toolbar = Original;
	}
	return capturedArgs;
}

QUnit.module( 'ext.knowledgegraph.toolbar', () => {

	QUnit.test( 'create builds a toolbar with actions: true', ( assert ) => {
		const args = captureToolbarConstructorArgs( () => {
			KnowledgeGraphToolbar.create( () => {} );
		} );

		assert.true( args[ 2 ].actions, 'OO.ui.Toolbar is constructed with actions: true' );
	} );

	QUnit.test( 'create registers add-node, show-config, reload (spliced at index 2), export-graph in order', ( assert ) => {
		const registered = captureRegisteredTools( () => {
			KnowledgeGraphToolbar.create( () => {} );
		} );

		assert.deepEqual(
			registered.map( ( ToolClass ) => ToolClass.static.name ),
			[ 'add-node', 'show-config', 'reload', 'export-graph' ],
			'tools are registered in the expected order, with reload spliced at index 2'
		);
	} );

	QUnit.test( 'create calls toolbar.setup with the my-group inclusion config', ( assert ) => {
		const toolbar = KnowledgeGraphToolbar.create( () => {} );

		assert.deepEqual(
			toolbar.groups,
			[ { name: 'my-group', include: [ { group: 'group' } ] } ],
			'toolbar.setup is called with a single my-group entry including the "group" tool group'
		);
	} );

	QUnit.test( 'each registered tool is assigned to the "group" tool group', ( assert ) => {
		const registered = captureRegisteredTools( () => {
			KnowledgeGraphToolbar.create( () => {} );
		} );

		registered.forEach( ( ToolClass ) => {
			assert.strictEqual( ToolClass.static.group, 'group', `${ ToolClass.static.name } has group: 'group'` );
		} );
	} );

	QUnit.test( 'a registered tool instance calls the supplied onSelect on select', ( assert ) => {
		let called = 0;
		const onSelect = function () {
			called++;
		};

		const registered = captureRegisteredTools( () => {
			KnowledgeGraphToolbar.create( onSelect );
		} );

		const AddNodeTool = registered.find( ( ToolClass ) => ToolClass.static.name === 'add-node' );
		const instance = new AddNodeTool( {} );

		instance.onSelect();

		assert.strictEqual( called, 1, 'obj.onSelect is invoked once' );
	} );

	QUnit.test( 'a registered tool instance toggles active state when no onSelect is supplied', ( assert ) => {
		const registered = captureRegisteredTools( () => {
			// A falsy onSelect propagates to every tool config, exercising the
			// "toggle this.toggled / setActive" branch of Tool.prototype.onSelect.
			KnowledgeGraphToolbar.create( undefined );
		} );

		const AddNodeTool = registered.find( ( ToolClass ) => ToolClass.static.name === 'add-node' );
		const instance = new AddNodeTool( {} );

		assert.strictEqual( instance.toggled, false, 'precondition: tool starts untoggled' );

		instance.onSelect();
		assert.strictEqual( instance.toggled, true, 'first onSelect toggles to true' );
		assert.strictEqual( instance.active, true, 'first onSelect sets active state to true' );

		instance.onSelect();
		assert.strictEqual( instance.toggled, false, 'second onSelect toggles back to false' );
		assert.strictEqual( instance.active, false, 'second onSelect sets active state to false' );
	} );

	QUnit.test( 'a registered tool instance honours config.data.disabled and config.data.pending', ( assert ) => {
		const registered = captureRegisteredTools( () => {
			KnowledgeGraphToolbar.create( () => {} );
		} );
		const AddNodeTool = registered.find( ( ToolClass ) => ToolClass.static.name === 'add-node' );

		const plain = new AddNodeTool( {} );
		assert.strictEqual( plain.disabled, false, 'without config.data.disabled, setDisabled(true) is not called' );
		assert.strictEqual( plain.pending, 0, 'without config.data.pending, pushPending() is not called' );

		// The production tool-group entries never set a `config` key, so the
		// `disabled`/`pending` branches of createTool() are only reachable by
		// forcing KnowledgeGraphFunctions.getNestedProp() to return truthy for
		// this one construction.
		const original = KnowledgeGraphFunctions.getNestedProp;
		KnowledgeGraphFunctions.getNestedProp = function ( path, obj ) {
			if ( path[ 1 ] === 'disabled' || path[ 1 ] === 'pending' ) {
				return true;
			}
			return original( path, obj );
		};
		let flagged;
		try {
			flagged = new AddNodeTool( {} );
		} finally {
			KnowledgeGraphFunctions.getNestedProp = original;
		}

		assert.strictEqual( flagged.disabled, true, 'config.data.disabled true calls setDisabled(true)' );
		assert.strictEqual( flagged.pending, 1, 'config.data.pending true calls pushPending()' );
	} );

	QUnit.test( 'a registered tool instance onUpdateState pops pending and clears disabled', ( assert ) => {
		const registered = captureRegisteredTools( () => {
			KnowledgeGraphToolbar.create( () => {} );
		} );
		const AddNodeTool = registered.find( ( ToolClass ) => ToolClass.static.name === 'add-node' );

		const original = KnowledgeGraphFunctions.getNestedProp;
		KnowledgeGraphFunctions.getNestedProp = function ( path, obj ) {
			if ( path[ 1 ] === 'disabled' || path[ 1 ] === 'pending' ) {
				return true;
			}
			return original( path, obj );
		};
		let instance;
		try {
			instance = new AddNodeTool( {} );
		} finally {
			KnowledgeGraphFunctions.getNestedProp = original;
		}

		assert.strictEqual( instance.pending, 1, 'precondition: tool starts pending' );
		assert.strictEqual( instance.disabled, true, 'precondition: tool starts disabled' );

		instance.onUpdateState();

		assert.strictEqual( instance.pending, 0, 'onUpdateState pops the pending count' );
		assert.strictEqual( instance.disabled, false, 'onUpdateState clears the disabled state' );
	} );

} );
