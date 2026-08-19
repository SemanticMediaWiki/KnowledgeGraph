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

QUnit.module( 'ext.knowledgegraph.actiontoolbar', () => {

	QUnit.test( 'create builds a toolbar with actions: false', ( assert ) => {
		const args = captureToolbarConstructorArgs( () => {
			KnowledgeGraphActionToolbar.create( () => {} );
		} );

		assert.strictEqual( args[ 2 ].actions, false, 'OO.ui.Toolbar is constructed with actions: false' );
	} );

	QUnit.test( 'create registers info-button and help-button, both in the selectSwitch group', ( assert ) => {
		const registered = captureRegisteredTools( () => {
			KnowledgeGraphActionToolbar.create( () => {} );
		} );

		assert.deepEqual(
			registered.map( ( ToolClass ) => ToolClass.static.name ),
			[ 'info-button', 'help-button' ],
			'info-button and help-button are registered in order'
		);
		registered.forEach( ( ToolClass ) => {
			assert.strictEqual( ToolClass.static.group, 'selectSwitch', `${ ToolClass.static.name } has group: 'selectSwitch'` );
		} );
	} );

	QUnit.test( 'create includes info-button in the toolbar setup when KnowledgeGraphDisableCredits is false', ( assert ) => {
		const previous = mw.config.get( 'KnowledgeGraphDisableCredits' );
		mw.config.set( 'KnowledgeGraphDisableCredits', false );

		let toolbar;
		try {
			toolbar = KnowledgeGraphActionToolbar.create( () => {} );
		} finally {
			mw.config.set( 'KnowledgeGraphDisableCredits', previous );
		}

		assert.deepEqual(
			toolbar.groups,
			[ { type: 'bar', include: [ 'info-button' ] } ],
			'toolbar.setup is called with type: "bar" and info-button included'
		);
	} );

	QUnit.test( 'create excludes info-button from the toolbar setup when KnowledgeGraphDisableCredits is not false', ( assert ) => {
		const previous = mw.config.get( 'KnowledgeGraphDisableCredits' );
		mw.config.set( 'KnowledgeGraphDisableCredits', true );

		let toolbar;
		try {
			toolbar = KnowledgeGraphActionToolbar.create( () => {} );
		} finally {
			mw.config.set( 'KnowledgeGraphDisableCredits', previous );
		}

		assert.deepEqual(
			toolbar.groups,
			[ { type: 'bar', include: [] } ],
			'toolbar.setup is called with type: "bar" and an empty include list'
		);
	} );

	QUnit.test( 'a registered tool instance calls the supplied onSelect on select', ( assert ) => {
		let called = 0;
		const onSelect = function () {
			called++;
		};

		const registered = captureRegisteredTools( () => {
			KnowledgeGraphActionToolbar.create( onSelect );
		} );

		const HelpButtonTool = registered.find( ( ToolClass ) => ToolClass.static.name === 'help-button' );
		const instance = new HelpButtonTool( {} );

		instance.onSelect();

		assert.strictEqual( called, 1, 'obj.onSelect is invoked once' );
	} );

	QUnit.test( 'a registered tool instance toggles active state when no onSelect is supplied', ( assert ) => {
		const registered = captureRegisteredTools( () => {
			// A falsy onSelect propagates to every tool config, exercising the
			// "toggle this.toggled / setActive" branch of Tool.prototype.onSelect.
			KnowledgeGraphActionToolbar.create( undefined );
		} );

		const HelpButtonTool = registered.find( ( ToolClass ) => ToolClass.static.name === 'help-button' );
		const instance = new HelpButtonTool( {} );

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
			KnowledgeGraphActionToolbar.create( () => {} );
		} );
		const HelpButtonTool = registered.find( ( ToolClass ) => ToolClass.static.name === 'help-button' );

		const plain = new HelpButtonTool( {} );
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
			flagged = new HelpButtonTool( {} );
		} finally {
			KnowledgeGraphFunctions.getNestedProp = original;
		}

		assert.strictEqual( flagged.disabled, true, 'config.data.disabled true calls setDisabled(true)' );
		assert.strictEqual( flagged.pending, 1, 'config.data.pending true calls pushPending()' );
	} );

	QUnit.test( 'a registered tool instance onUpdateState pops pending and clears disabled', ( assert ) => {
		const registered = captureRegisteredTools( () => {
			KnowledgeGraphActionToolbar.create( () => {} );
		} );
		const HelpButtonTool = registered.find( ( ToolClass ) => ToolClass.static.name === 'help-button' );

		const original = KnowledgeGraphFunctions.getNestedProp;
		KnowledgeGraphFunctions.getNestedProp = function ( path, obj ) {
			if ( path[ 1 ] === 'disabled' || path[ 1 ] === 'pending' ) {
				return true;
			}
			return original( path, obj );
		};
		let instance;
		try {
			instance = new HelpButtonTool( {} );
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
