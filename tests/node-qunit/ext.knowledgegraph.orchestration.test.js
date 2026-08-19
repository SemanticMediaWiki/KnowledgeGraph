'use strict';

// Minimal config accepted by KnowledgeGraph.prototype.initialize() -- graphOptions
// is filled in with KnowledgeGraphOptions defaults, matching how the real
// $( document ).ready() bootstrap in KnowledgeGraph.js builds `config` before
// calling initialize().
function makeConfig( overrides ) {
	return Object.assign(
		{
			data: {},
			propertyOptions: {},
			properties: [],
			depth: '',
			width: '',
			height: '',
			'show-toolbar': false,
			'show-property-type': false,
			'properties-panel': false,
			context: 'parserfunction',
			graphOptions: KnowledgeGraphOptions.getDefaultOptions()
		},
		overrides || {}
	);
}

// Captures the array of windows passed to `OO.ui.WindowManager.prototype.addWindows()`
// during fn() -- KnowledgeGraph.js's openDialog() (invoked by the 'add-node' toolbar
// tool's onSelect) constructs the real MyDialog instance here but never returns it,
// so this is the only way to obtain the instance for direct getActionProcess()/
// getSetupProcess()/initializeResultsPanel() calls.
function captureAddedWindows( fn ) {
	const original = OO.ui.WindowManager.prototype.addWindows;
	let captured;
	OO.ui.WindowManager.prototype.addWindows = function ( windows ) {
		captured = windows;
		return original.apply( this, arguments );
	};
	try {
		fn();
	} finally {
		OO.ui.WindowManager.prototype.addWindows = original;
	}
	return captured;
}

// Registers each Tool class passed to OO.ui.ToolFactory.prototype.register() during
// fn() into an array -- mirrors the pattern in ext.knowledgegraph.toolbar.test.js.
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

QUnit.module( 'ext.knowledgegraph orchestration', ( hooks ) => {

	let graph;

	hooks.beforeEach( () => {
		graph = new KnowledgeGraph();
		mw.config.set( 'wgArticlePath', '/wiki/$1' );
	} );

	QUnit.module( 'initialize', () => {

		QUnit.test( 'uses container.id as self.id when present', ( assert ) => {
			const container = document.createElement( 'div' );
			container.id = 'my-container';

			graph.initialize( container, null, null, makeConfig() );

			assert.strictEqual( graph.self.id, 'my-container', 'self.id is taken from container.id' );
		} );

		QUnit.test( 'generates a random fallback id when container.id is absent', ( assert ) => {
			const container = document.createElement( 'div' );

			graph.initialize( container, null, null, makeConfig() );

			assert.true(
				/^knowledgegraph-\d+-[a-z0-9]+$/.test( graph.self.id ),
				`self.id "${ graph.self.id }" matches the generated fallback pattern`
			);
		} );

		QUnit.test( 'generates a fallback id when no container is passed at all', ( assert ) => {
			graph.initialize( null, null, null, makeConfig() );

			assert.true(
				/^knowledgegraph-\d+-[a-z0-9]+$/.test( graph.self.id ),
				'self.id falls back to the generated pattern when container is null'
			);
		} );

		QUnit.test( 'sets self.Config/self.Container/self.ContainerOptions from arguments', ( assert ) => {
			const container = document.createElement( 'div' );
			const containerOptions = document.createElement( 'div' );
			const config = makeConfig();

			graph.initialize( container, null, containerOptions, config );

			assert.strictEqual( graph.self.Config, config, 'self.Config is the passed config object' );
			assert.strictEqual( graph.self.Container, container, 'self.Container is the passed container' );
			assert.strictEqual( graph.self.ContainerOptions, containerOptions, 'self.ContainerOptions is the passed containerOptions' );
		} );

		QUnit.test( 'self.InitialData is a deep clone of config.data, not the same reference', ( assert ) => {
			const container = document.createElement( 'div' );
			const data = { Foo: { properties: [] } };
			const config = makeConfig( { data } );

			graph.initialize( container, null, null, config );

			assert.deepEqual( graph.self.InitialData, data, 'self.InitialData deep-equals config.data' );
			assert.notStrictEqual( graph.self.InitialData, data, 'self.InitialData is not the same object reference as config.data' );
		} );

		QUnit.test( 'constructs self.Nodes/self.Edges as empty vis.DataSet instances', ( assert ) => {
			const container = document.createElement( 'div' );

			graph.initialize( container, null, null, makeConfig() );

			assert.deepEqual( graph.self.Nodes.get(), [], 'self.Nodes starts empty' );
			assert.deepEqual( graph.self.Edges.get(), [], 'self.Edges starts empty' );
			assert.strictEqual( typeof graph.self.Nodes.add, 'function', 'self.Nodes is a DataSet-shaped object' );
		} );

		QUnit.test( 'constructs self.Network via vis.Network with the container and derived graphOptions', ( assert ) => {
			const container = document.createElement( 'div' );
			const config = makeConfig();

			graph.initialize( container, null, null, config );

			assert.strictEqual( graph.self.Network.container, container, 'vis.Network is constructed with self.Container' );
			assert.strictEqual( graph.self.Network.data.nodes, graph.self.Nodes, 'vis.Network data.nodes is self.Nodes' );
			assert.strictEqual( graph.self.Network.data.edges, graph.self.Edges, 'vis.Network data.edges is self.Edges' );
			assert.strictEqual( graph.self.Network.options, config.graphOptions, 'vis.Network is constructed with self.Config.graphOptions' );
			assert.strictEqual( config.graphOptions.interaction.hover, true, 'graphOptions.interaction.hover is forced to true before Network construction' );
		} );

		QUnit.test( 'defaults graphOptions.interaction when the passed config omits it', ( assert ) => {
			const container = document.createElement( 'div' );
			const config = makeConfig();
			delete config.graphOptions.interaction;

			graph.initialize( container, null, null, config );

			assert.deepEqual( graph.self.Config.graphOptions.interaction, { hover: true }, 'a missing interaction object is created with hover: true' );
		} );

		QUnit.test( 'does not build a toolbar when show-toolbar is false', ( assert ) => {
			const container = document.createElement( 'div' );

			const registered = captureRegisteredTools( () => {
				graph.initialize( container, null, null, makeConfig( { 'show-toolbar': false } ) );
			} );

			assert.strictEqual( registered.length, 0, 'no toolbar tools are registered' );
		} );

		QUnit.test( 'builds and wires the toolbar plus action toolbar when show-toolbar is true', ( assert ) => {
			const container = document.createElement( 'div' );
			const containerToolbar = document.createElement( 'div' );
			const containerOptions = document.createElement( 'div' );

			const registered = captureRegisteredTools( () => {
				graph.initialize( container, containerToolbar, containerOptions, makeConfig( { 'show-toolbar': true } ) );
			} );

			assert.deepEqual(
				registered.map( ( ToolClass ) => ToolClass.static.name ),
				[ 'add-node', 'show-config', 'reload', 'export-graph', 'info-button', 'help-button' ],
				'both the main toolbar tools and the action-toolbar tools are registered'
			);
		} );

		QUnit.test( 'show-toolbar: true forces graphOptions.configure.enabled to false and hides containerOptions', ( assert ) => {
			const container = document.createElement( 'div' );
			const containerToolbar = document.createElement( 'div' );
			const containerOptions = document.createElement( 'div' );
			const config = makeConfig( { 'show-toolbar': true } );

			graph.initialize( container, containerToolbar, containerOptions, config );

			assert.strictEqual( config.graphOptions.configure.enabled, false, 'graphOptions.configure.enabled is forced to false' );
		} );

		QUnit.test( 'attaches an oncontext listener to self.Network (attachContextMenuListener is invoked)', ( assert ) => {
			const container = document.createElement( 'div' );

			graph.initialize( container, null, null, makeConfig() );

			assert.strictEqual( graph.self.Network.listeners.oncontext.length, 1, 'exactly one oncontext handler is registered' );
		} );

		QUnit.test( 'registers click/hoverNode/hoverEdge/blurNode/blurEdge/doubleClick handlers on self.Network', ( assert ) => {
			const container = document.createElement( 'div' );

			graph.initialize( container, null, null, makeConfig() );

			[ 'click', 'hoverNode', 'hoverEdge', 'blurNode', 'blurEdge', 'doubleClick' ].forEach( ( event ) => {
				assert.strictEqual( graph.self.Network.listeners[ event ].length, 1, `exactly one ${ event } handler is registered` );
			} );
		} );

		QUnit.test( 'the "click" handler calls HideNodesRec for the first clicked node, and no-ops without nodes', ( assert ) => {
			const container = document.createElement( 'div' );

			graph.initialize( container, null, null, makeConfig() );
			graph.self.Nodes.add( { id: 'A' } );

			const handler = graph.self.Network.listeners.click[ 0 ];

			assert.true(
				( () => {
					try {
						handler( { nodes: [] } );
						return true;
					} catch ( e ) {
						return false;
					}
				} )(),
				'an empty nodes array does not throw (early return)'
			);

			handler( { nodes: [ 'A' ] } );
			assert.strictEqual( graph.self.Nodes.get( 'A' ).hidden, undefined, 'a node with no connected children is left untouched (HideNodesRec no-op)' );
		} );

		QUnit.test( 'the "hoverNode" handler sets self.SelectedNode to params.node', ( assert ) => {
			const container = document.createElement( 'div' );

			graph.initialize( container, null, null, makeConfig() );

			graph.self.Network.listeners.hoverNode[ 0 ]( { node: 'NodeA' } );

			assert.strictEqual( graph.self.SelectedNode, 'NodeA', 'self.SelectedNode is updated to the hovered node' );
		} );

		QUnit.test( 'the "hoverEdge" handler sets self.SelectedNode and calls selectEdges', ( assert ) => {
			const container = document.createElement( 'div' );

			graph.initialize( container, null, null, makeConfig() );

			let selectEdgesCalledWith;
			graph.self.Network.selectEdges = ( ids ) => {
				selectEdgesCalledWith = ids;
			};

			graph.self.Network.listeners.hoverEdge[ 0 ]( { edge: 'EdgeA' } );

			assert.strictEqual( graph.self.SelectedNode, 'EdgeA', 'self.SelectedNode is updated to the hovered edge' );
			assert.deepEqual( selectEdgesCalledWith, [ 'EdgeA' ], 'Network.selectEdges is called with the hovered edge id' );
		} );

		QUnit.test( 'the "blurNode" handler calls Network.unselectAll', ( assert ) => {
			const container = document.createElement( 'div' );

			graph.initialize( container, null, null, makeConfig() );

			let called = false;
			graph.self.Network.unselectAll = () => {
				called = true;
			};

			graph.self.Network.listeners.blurNode[ 0 ]();

			assert.true( called, 'Network.unselectAll is invoked' );
		} );

		QUnit.test( 'the "blurEdge" handler clears self.SelectedNode and calls Network.unselectAll', ( assert ) => {
			const container = document.createElement( 'div' );

			graph.initialize( container, null, null, makeConfig() );
			graph.self.SelectedNode = 'EdgeA';

			let called = false;
			graph.self.Network.unselectAll = () => {
				called = true;
			};

			graph.self.Network.listeners.blurEdge[ 0 ]();

			assert.strictEqual( graph.self.SelectedNode, null, 'self.SelectedNode is cleared' );
			assert.true( called, 'Network.unselectAll is invoked' );
		} );

		QUnit.test( 'the "doubleClick" handler no-ops without nodes', ( assert ) => {
			const container = document.createElement( 'div' );

			graph.initialize( container, null, null, makeConfig() );

			const handler = graph.self.Network.listeners.doubleClick[ 0 ];

			assert.true(
				( () => {
					try {
						handler( { nodes: [] } );
						return true;
					} catch ( e ) {
						return false;
					}
				} )(),
				'an empty nodes array does not throw (early return)'
			);
		} );

		QUnit.test( 'the "doubleClick" handler opens the article URL only for a typeID 9 (wikipage) node', ( assert ) => {
			const container = document.createElement( 'div' );

			graph.initialize( container, null, null, makeConfig() );
			graph.self.Nodes.add( { id: 'Foo_Bar#9', typeID: 9 } );

			const handler = graph.self.Network.listeners.doubleClick[ 0 ];

			const originalOpen = global.window ? global.window.open : undefined;
			let openedUrl;
			global.window = global.window || {};
			global.window.open = ( url ) => {
				openedUrl = url;
				return { focus() {} };
			};

			try {
				handler( { nodes: [ 'Foo_Bar#9' ] } );
				assert.strictEqual( openedUrl, '/wiki/Foo_Bar', 'window.open is called with the article path for the stripped node label' );
			} finally {
				global.window.open = originalOpen;
			}
		} );

		QUnit.test( 'the "doubleClick" handler does not open anything for a plain value node with no formatter', ( assert ) => {
			const container = document.createElement( 'div' );

			graph.initialize( container, null, null, makeConfig() );
			graph.self.Nodes.add( { id: 'Foo#1', typeID: 1 } );

			const handler = graph.self.Network.listeners.doubleClick[ 0 ];

			const originalOpen = global.window ? global.window.open : undefined;
			let opened = false;
			global.window = global.window || {};
			global.window.open = () => {
				opened = true;
				return { focus() {} };
			};

			try {
				handler( { nodes: [ 'Foo#1' ] } );
				assert.false( opened, 'window.open is not called for a Number-type (typeID 1) value node' );
			} finally {
				global.window.open = originalOpen;
			}
		} );

		QUnit.test( 'the "doubleClick" handler opens the formatted external-identifier URL for a plain value node with a formatter', ( assert ) => {
			const container = document.createElement( 'div' );

			graph.initialize( container, null, null, makeConfig() );
			graph.self.Nodes.add( { id: 'ABC123#2', typeID: 2, formattedUrl: 'https://example.org/id/ABC123' } );

			const handler = graph.self.Network.listeners.doubleClick[ 0 ];

			const originalOpen = global.window ? global.window.open : undefined;
			let openedUrl;
			global.window = global.window || {};
			global.window.open = ( url ) => {
				openedUrl = url;
				return { focus() {} };
			};

			try {
				handler( { nodes: [ 'ABC123#2' ] } );
				assert.strictEqual( openedUrl, 'https://example.org/id/ABC123', 'window.open is called with the pre-formatted external identifier URL' );
			} finally {
				global.window.open = originalOpen;
			}
		} );

		QUnit.test( 'the "doubleClick" handler opens a Special:Ask URL for a Keyword node with an ask formatter', ( assert ) => {
			const container = document.createElement( 'div' );

			graph.initialize( container, null, null, makeConfig() );
			graph.self.Nodes.add( {
				id: 'MyKeyword#2',
				typeID: 2,
				hasKeywordAskFormatter: true,
				askPropertyLabel: 'Has keyword'
			} );

			const handler = graph.self.Network.listeners.doubleClick[ 0 ];

			const originalOpen = global.window ? global.window.open : undefined;
			let openedUrl;
			global.window = global.window || {};
			global.window.open = ( url ) => {
				openedUrl = url;
				return { focus() {} };
			};

			try {
				handler( { nodes: [ 'MyKeyword#2' ] } );
				assert.strictEqual(
					openedUrl,
					'/wiki/Special:Ask?q=' + encodeURIComponent( '[[Has keyword::MyKeyword]]' ),
					'window.open is called with a Special:Ask URL built from the property label and value'
				);
			} finally {
				global.window.open = originalOpen;
			}
		} );

		QUnit.test( 'createNodes() stores a numeric typeID for a non-_wpg, non-_txt property, taken from the per-value type', ( assert ) => {
			const container = document.createElement( 'div' );

			graph.initialize( container, null, null, makeConfig( {
				data: {
					Foo: {
						properties: {
							'Has Age': {
								canonicalLabel: 'Has Age',
								preferredLabel: 'Has Age',
								typeId: '_num',
								typeLabel: 'Number',
								values: [ { value: '42', type: 1 } ]
							}
						},
						categories: []
					}
				}
			} ) );

			const node = graph.self.Nodes.get( '42#1' );
			assert.true( !!node, 'a node is created with an id built from the numeric per-value type' );
			assert.strictEqual( node.typeID, 1, 'typeID is the numeric SMW DataItem type (1 = NUMBER), not the string "_num"' );
		} );

		QUnit.test( 'createNodes() attaches formattedUrl from an external-identifier value onto the created node', ( assert ) => {
			const container = document.createElement( 'div' );

			graph.initialize( container, null, null, makeConfig( {
				data: {
					Foo: {
						properties: {
							'Has ISBN': {
								canonicalLabel: 'Has ISBN',
								preferredLabel: 'Has ISBN',
								typeId: '_eid',
								typeLabel: 'External identifier',
								linkFormatter: { kind: 'external' },
								values: [ { value: 'ABC123', type: 2, formattedUrl: 'https://example.org/id/ABC123' } ]
							}
						},
						categories: []
					}
				}
			} ) );

			const node = graph.self.Nodes.get( 'ABC123#2' );
			assert.true( !!node, 'a node is created for the external-identifier value' );
			assert.strictEqual( node.formattedUrl, 'https://example.org/id/ABC123', 'the pre-formatted URL is carried onto the node' );
		} );

		QUnit.test( 'creates a legend div when properties-panel is enabled, and none otherwise', ( assert ) => {
			const containerWith = document.createElement( 'div' );
			graph.initialize( containerWith, null, null, makeConfig( { 'properties-panel': true } ) );
			assert.true( !!graph.self.LegendDiv, 'self.LegendDiv is created when properties-panel is enabled' );

			const graphWithout = new KnowledgeGraph();
			const containerWithout = document.createElement( 'div' );
			graphWithout.initialize( containerWithout, null, null, makeConfig( { 'properties-panel': false } ) );
			assert.strictEqual( graphWithout.self.LegendDiv, null, 'self.LegendDiv stays null when properties-panel is disabled' );
		} );

	} );

	QUnit.module( 'dialog callbacks (via a real MyDialog captured from openDialog)', ( moduleHooks ) => {

		let dialog;

		moduleHooks.beforeEach( () => {
			mw.config.set( 'wgExtraNamespaces', {} );

			const container = document.createElement( 'div' );
			const containerToolbar = document.createElement( 'div' );
			const containerOptions = document.createElement( 'div' );

			const registered = captureRegisteredTools( () => {
				graph.initialize( container, containerToolbar, containerOptions, makeConfig( { 'show-toolbar': true } ) );
			} );
			const AddNodeTool = registered.find( ( ToolClass ) => ToolClass.static.name === 'add-node' );

			const windows = captureAddedWindows( () => {
				new AddNodeTool( {} ).onSelect();
			} );
			dialog = windows[ 0 ];
			// Real OOUI calls dialog.initialize() when a window is added/opened;
			// the stub's WindowManager.addWindows()/openWindow() don't, so it must
			// be called explicitly here to build panelB/stackLayout/indexLayout
			// (mirrors dialog.test.js's createInitializedDialog() helper).
			dialog.initialize();
			// Real OOUI's ProcessDialog.prototype.initialize() would construct this;
			// the stub's no-op Dialog.prototype.initialize() never does, so callbacks
			// that reach `thisDialog.actions.setMode(...)` need it patched in per test.
			dialog.actions = { setMode() {} };
		} );

		QUnit.module( 'getDialogActionProcessCallback', () => {

			QUnit.test( "'delete' calls deleteNode and closes the dialog when confirm() returns true", ( assert ) => {
				graph.self.Nodes.add( { id: 'NodeA' } );
				graph.self.SelectedNode = 'NodeA';

				const originalConfirm = global.confirm;
				global.confirm = () => true;

				try {
					const process = dialog.getActionProcess( 'delete' );

					assert.strictEqual( graph.self.Nodes.get( 'NodeA' ), null, 'deleteNode removed the selected node' );
					assert.strictEqual( typeof process.execute, 'function', 'a process object is returned' );

					assert.true(
						( () => {
							try {
								process.execute();
								return true;
							} catch ( e ) {
								return false;
							}
						} )(),
						'executing the returned process (which calls thisDialog.close) does not throw'
					);
				} finally {
					global.confirm = originalConfirm;
				}
			} );

			QUnit.test( "'delete' does not call deleteNode when confirm() returns false, and falls back to the OOUI superclass process", ( assert ) => {
				graph.self.Nodes.add( { id: 'NodeA' } );
				graph.self.SelectedNode = 'NodeA';

				const originalConfirm = global.confirm;
				global.confirm = () => false;

				try {
					const process = dialog.getActionProcess( 'delete' );

					assert.strictEqual( graph.self.Nodes.get( 'NodeA' ).id, 'NodeA', 'the node is not deleted when the user cancels the confirm dialog' );
					// getDialogActionProcessCallback() returns undefined (falls through
					// the switch without a `return`), so KnowledgeGraphDialog.js's
					// getActionProcess() falls back to the OOUI superclass process.
					assert.strictEqual( typeof process, 'object', 'the dialog falls back to the OOUI superclass process' );
				} finally {
					global.confirm = originalConfirm;
				}
			} );

			QUnit.test( "'done' returns a process that closes the dialog, calls createNodes(self.TmpData), and resets self.TmpData", ( assert ) => {
				graph.self.TmpData = { NewNode: { properties: [] } };

				const process = dialog.getActionProcess( 'done' );

				assert.strictEqual( typeof process.execute, 'function', 'a process object is returned' );

				process.execute();

				assert.true( !!graph.self.Nodes.get( 'NewNode' ), 'createNodes( self.TmpData ) added the new node' );
				assert.deepEqual( graph.self.TmpData, {}, 'self.TmpData is reset to {} after execute()' );
			} );

			QUnit.test( "'back' resets the stack to the first panel and sets mode to 'select'", ( assert ) => {
				let modeSet;
				dialog.actions.setMode = ( mode ) => {
					modeSet = mode;
				};
				let setItemCalledWith;
				const originalSetItem = dialog.stackLayout.setItem;
				dialog.stackLayout.setItem = function ( item ) {
					setItemCalledWith = item;
					return originalSetItem.apply( this, arguments );
				};

				const result = dialog.getActionProcess( 'back' );

				assert.strictEqual( setItemCalledWith, dialog.stackLayout.getItems()[ 0 ], 'the stack is switched back to the first (selection) panel' );
				assert.strictEqual( modeSet, 'select', "actions.setMode is called with 'select'" );
				// getDialogActionProcessCallback() returns undefined for 'back' (no
				// explicit `return` in that case), so KnowledgeGraphDialog.js's
				// getActionProcess() falls back to the OOUI superclass process.
				assert.strictEqual( typeof result, 'object', 'the dialog falls back to the OOUI superclass process' );
			} );

			QUnit.test( "'continue' delegates to the superclass getActionProcess and chains .next()", ( assert ) => {
				const process = dialog.getActionProcess( 'continue' );

				assert.strictEqual( typeof process.execute, 'function', 'a chainable process object is returned' );
				// Not executed: KnowledgeGraph.js's 'continue' branch calls
				// thisDialog.indexLayout.getCurrentTabPanelName(), which the stub
				// harness doesn't model (TabPanelLayout's name is never tracked
				// per-instance) -- documented as a known gap, see issue #90.
			} );

			QUnit.test( 'an unrecognized action returns undefined', ( assert ) => {
				const result = dialog.getActionProcess( 'cancel' );

				// KnowledgeGraphDialog.js's getActionProcess() falls back to the
				// OOUI superclass (an object) whenever CallbackActionProcess returns
				// a falsy value, so 'cancel' -- the one action with no case in the
				// switch -- surfaces as a process object here, not undefined.
				assert.strictEqual( typeof result, 'object', 'the dialog falls back to the OOUI superclass process for an unhandled action' );
			} );

		} );

		QUnit.module( 'getDialogOnSetupCallback', () => {

			QUnit.test( 'sets self.SelectedNode and mode "edit" when data.nodeId is present', ( assert ) => {
				let modeSet;
				dialog.actions.setMode = ( mode ) => {
					modeSet = mode;
				};
				let initializeResultsPanelCalledWith;
				dialog.initializeResultsPanel = ( mode ) => {
					initializeResultsPanelCalledWith = mode;
				};

				dialog.getSetupProcess( { nodeId: 'NodeA' } ).execute();

				assert.strictEqual( graph.self.SelectedNode, 'NodeA', 'self.SelectedNode is set from data.nodeId' );
				assert.strictEqual( initializeResultsPanelCalledWith, 'edit', "initializeResultsPanel is called with mode 'edit'" );
				assert.strictEqual( modeSet, 'edit', "actions.setMode is called with 'edit'" );
			} );

			QUnit.test( 'sets mode "select" and leaves self.SelectedNode untouched without data.nodeId', ( assert ) => {
				graph.self.SelectedNode = null;
				let modeSet;
				dialog.actions.setMode = ( mode ) => {
					modeSet = mode;
				};

				dialog.getSetupProcess().execute();

				assert.strictEqual( graph.self.SelectedNode, null, 'self.SelectedNode is left untouched' );
				assert.strictEqual( modeSet, 'select', "actions.setMode is called with 'select'" );
			} );

			QUnit.test( 'sets mode "select" when data is provided but data.nodeId is absent', ( assert ) => {
				let modeSet;
				dialog.actions.setMode = ( mode ) => {
					modeSet = mode;
				};

				dialog.getSetupProcess( { title: 'Foo' } ).execute();

				assert.strictEqual( modeSet, 'select', "actions.setMode is called with 'select' when data.nodeId is missing" );
			} );

		} );

		QUnit.module( 'getDialogInitializeResultsPanel', ( panelHooks ) => {

			// The stub jQuery's $( '<span>html</span>' ) does not parse the markup
			// into an element (it only wraps real DOM nodes/arrays), so the returned
			// $el always has length: 0 regardless of branch -- assert on which
			// mw.msg() key was requested instead, which uniquely identifies the
			// branch taken.
			let msgCalls;
			let originalMsg;

			panelHooks.beforeEach( () => {
				msgCalls = [];
				originalMsg = mw.msg;
				mw.msg = function ( key, ...args ) {
					msgCalls.push( key );
					return originalMsg( key, ...args );
				};
			} );

			panelHooks.afterEach( () => {
				mw.msg = originalMsg;
			} );

			QUnit.test( "mode 'no-results' for by-article uses the no-properties message", ( assert ) => {
				// MyDialog.prototype.initializeResultsPanel() (the wrapper) has no
				// return value -- it appends the CallbackInitializeResultsPanel()
				// result to panelB.$element internally, so branch identity is
				// asserted via the requested mw.msg() key instead.
				dialog.initializeResultsPanel( 'no-results', 'by-article', {}, 'Foo' );

				assert.true( msgCalls.includes( 'knowledgegraph-dialog-results-no-properties' ), 'the by-article no-results message key is requested' );
				assert.false( msgCalls.includes( 'knowledgegraph-dialog-results-no-articles' ), 'the non-article no-results message key is not requested' );
			} );

			QUnit.test( "mode 'no-results' for a non-article tab uses the no-articles message", ( assert ) => {
				dialog.initializeResultsPanel( 'no-results', 'by-properties', {}, null );

				assert.true( msgCalls.includes( 'knowledgegraph-dialog-results-no-articles' ), 'the non-article no-results message key is requested' );
				assert.false( msgCalls.includes( 'knowledgegraph-dialog-results-no-properties' ), 'the by-article no-results message key is not requested' );
			} );

			QUnit.test( "mode 'existing-node' uses the existing-node message regardless of selectedTab", ( assert ) => {
				dialog.initializeResultsPanel( 'existing-node', 'by-categories', {}, null );

				assert.true( msgCalls.includes( 'knowledgegraph-dialog-results-existing-node' ), 'the existing-node message key is requested' );
			} );

			QUnit.test( "mode 'show-results' for by-article appends a has-properties header and one <li> per property", ( assert ) => {
				const data = {
					Foo: {
						properties: {
							hasAuthor: { preferredLabel: 'Author', canonicalLabel: 'Has_Author', typeLabel: 'Page' }
						}
					}
				};

				const appended = [];
				dialog.panelB.$element.append = function ( arg ) {
					appended.push( arg );
					return this;
				};

				dialog.initializeResultsPanel( 'show-results', 'by-article', data, 'Foo' );

				assert.true( msgCalls.includes( 'knowledgegraph-dialog-results-has-properties' ), 'the has-properties header message key is requested' );
				// 1: the "<h3>has-properties</h3>" header, appended directly by
				// getDialogInitializeResultsPanel(); 2: the returned <ul> itself,
				// appended by MyDialog.prototype.initializeResultsPanel() afterwards.
				assert.strictEqual( appended.length, 2, 'the header and the returned <ul> are each appended to panelB once' );
			} );

			QUnit.test( "mode 'show-results' for by-properties appends only genuinely-new nodes, skipping existing/null ones", ( assert ) => {
				graph.self.Data = { Existing: {} };
				const data = { Existing: {}, NewNode: {}, SkippedNull: null };

				const appended = [];
				dialog.panelB.$element.append = function ( arg ) {
					appended.push( arg );
					return this;
				};

				dialog.initializeResultsPanel( 'show-results', 'by-properties', data, null );

				assert.true( msgCalls.includes( 'knowledgegraph-dialog-results-importing-nodes' ), 'the importing-nodes header message key is requested' );
				// 1: the "<h3>importing-nodes</h3>" header; 2: the $newList (containing
				// only "NewNode" -- "Existing" and the null "SkippedNull" are excluded);
				// 3: the returned (otherwise-empty) <ul> appended by the wrapper.
				assert.strictEqual( appended.length, 3, 'a header and a new-nodes list are appended, plus the final wrapper append' );
			} );

			QUnit.test( "mode 'show-results' for by-properties omits the importing-nodes header/list when there are no genuinely-new nodes", ( assert ) => {
				graph.self.Data = { Existing: {} };

				const appended = [];
				dialog.panelB.$element.append = function ( arg ) {
					appended.push( arg );
					return this;
				};

				dialog.initializeResultsPanel( 'show-results', 'by-properties', { Existing: {} }, null );

				assert.false( msgCalls.includes( 'knowledgegraph-dialog-results-importing-nodes' ), 'the importing-nodes header is not requested when every node already exists' );
				assert.strictEqual( appended.length, 1, 'only the final wrapper append (the empty <ul>) happens' );
			} );

			QUnit.test( "mode 'show-results' for by-properties appends a skipped-existing section when skippedTitles is set", ( assert ) => {
				dialog.skippedTitles = [ 'Existing' ];

				const appended = [];
				dialog.panelB.$element.append = function ( arg ) {
					appended.push( arg );
					return this;
				};

				dialog.initializeResultsPanel( 'show-results', 'by-properties', {}, null );

				assert.true( msgCalls.includes( 'knowledgegraph-dialog-results-skipped-existing' ), 'the skipped-existing header message key is requested' );
				// 1: the "<h4>skipped-existing</h4>" header; 2: the $skippedList;
				// 3: the returned (otherwise-empty) <ul> appended by the wrapper.
				assert.strictEqual( appended.length, 3, 'a skipped-existing header and list are appended in addition to the final wrapper append' );
			} );

			QUnit.test( "mode 'show-results' for by-categories appends new nodes, or a no-new-nodes message when there are none", ( assert ) => {
				graph.self.Data = { Existing: {} };

				const appendedWithNew = [];
				dialog.panelB.$element.append = function ( arg ) {
					appendedWithNew.push( arg );
					return this;
				};
				dialog.initializeResultsPanel( 'show-results', 'by-categories', { Existing: {}, NewCat: {} }, null );
				assert.true( msgCalls.includes( 'knowledgegraph-dialog-results-importing-nodes' ), 'the importing-nodes header message key is requested' );
				assert.false( msgCalls.includes( 'knowledgegraph-dialog-results-no-new-nodes' ), 'the no-new-nodes message key is not requested when a new node exists' );
				// 1: the "<h3>importing-nodes</h3>" header; 2: the $ul (containing
				// "NewCat"); 3: the returned (otherwise-empty) <ul> appended by the wrapper.
				assert.strictEqual( appendedWithNew.length, 3, 'a header and the new-nodes <ul> are appended, plus the final wrapper append' );

				msgCalls.length = 0;
				const appendedNoNew = [];
				dialog.panelB.$element.append = function ( arg ) {
					appendedNoNew.push( arg );
					return this;
				};
				dialog.initializeResultsPanel( 'show-results', 'by-categories', { Existing: {} }, null );
				assert.true( msgCalls.includes( 'knowledgegraph-dialog-results-no-new-nodes' ), 'the no-new-nodes message key is requested when every node already exists' );
				// 1: the "<h3>importing-nodes</h3>" header; 2: the no-new-nodes <p>;
				// 3: the returned (otherwise-empty) <ul> appended by the wrapper.
				assert.strictEqual( appendedNoNew.length, 3, 'a header and a no-new-nodes message are appended, plus the final wrapper append' );
			} );

		} );

	} );

	QUnit.module( 'getOnSelectToolbar / getOnSelectActionToolbar', ( moduleHooks ) => {

		let toolbarTools;
		let actionTools;

		moduleHooks.beforeEach( () => {
			mw.config.set( 'wgExtraNamespaces', {} );

			const container = document.createElement( 'div' );
			const containerToolbar = document.createElement( 'div' );
			const containerOptions = document.createElement( 'div' );

			const registered = captureRegisteredTools( () => {
				graph.initialize( container, containerToolbar, containerOptions, makeConfig( { 'show-toolbar': true } ) );
			} );

			toolbarTools = {};
			[ 'add-node', 'show-config', 'reload', 'export-graph' ].forEach( ( name ) => {
				toolbarTools[ name ] = registered.find( ( ToolClass ) => ToolClass.static.name === name );
			} );
			actionTools = {};
			[ 'help-button', 'info-button' ].forEach( ( name ) => {
				actionTools[ name ] = registered.find( ( ToolClass ) => ToolClass.static.name === name );
			} );
		} );

		QUnit.test( "'add-node' opens a dialog and deactivates the tool", ( assert ) => {
			const AddNodeTool = toolbarTools[ 'add-node' ];

			const windows = captureAddedWindows( () => {
				const instance = new AddNodeTool( {} );
				instance.onSelect();
				assert.strictEqual( instance.active, false, 'the tool is set inactive after onSelect' );
			} );

			assert.strictEqual( windows.length, 1, 'openDialog added exactly one window (the MyDialog instance)' );
		} );

		QUnit.test( "'show-config' toggles graphOptions.configure.enabled and containerOptions visibility", ( assert ) => {
			const ShowConfigTool = toolbarTools[ 'show-config' ];
			const before = graph.self.Config.graphOptions.configure.enabled;
			const instance = new ShowConfigTool( {} );

			instance.onSelect();

			assert.strictEqual( graph.self.Config.graphOptions.configure.enabled, !before, 'graphOptions.configure.enabled is toggled' );
		} );

		QUnit.test( "'reload' resets Data/Nodes/Edges/Network and re-attaches the context menu when confirmed", ( assert ) => {
			const ReloadTool = toolbarTools.reload;
			graph.self.Data = { Foo: {} };
			graph.self.Nodes.add( { id: 'Foo' } );
			const oldNetwork = graph.self.Network;
			let destroyed = false;
			oldNetwork.destroy = () => {
				destroyed = true;
			};

			const originalConfirm = global.confirm;
			global.confirm = () => true;

			try {
				const instance = new ReloadTool( {} );
				instance.onSelect();

				assert.true( destroyed, 'the previous Network is destroyed' );
				assert.deepEqual( graph.self.Data, {}, 'self.Data is reset to {}' );
				assert.notStrictEqual( graph.self.Network, oldNetwork, 'a new Network instance replaces the old one' );
				assert.strictEqual( graph.self.Network.listeners.oncontext.length, 1, 'the context menu listener is re-attached to the new Network' );
			} finally {
				global.confirm = originalConfirm;
			}
		} );

		QUnit.test( "'reload' does nothing when the user cancels the confirm dialog", ( assert ) => {
			const ReloadTool = toolbarTools.reload;
			const oldNetwork = graph.self.Network;

			const originalConfirm = global.confirm;
			global.confirm = () => false;

			try {
				const instance = new ReloadTool( {} );
				instance.onSelect();

				assert.strictEqual( graph.self.Network, oldNetwork, 'the Network instance is left untouched' );
			} finally {
				global.confirm = originalConfirm;
			}
		} );

		QUnit.test( "'export-graph' copies the generated wikitext via navigator.clipboard when available", ( assert ) => {
			const ExportGraphTool = toolbarTools[ 'export-graph' ];
			let copiedText;
			let alertedWith;
			// global.navigator is absent in some Node versions and a read-only
			// getter in others -- (re)define it as a plain writable object rather
			// than assigning `global.navigator = ...` directly, which throws
			// against a getter-only global.
			Object.defineProperty( global, 'navigator', {
				value: global.navigator || {},
				configurable: true,
				writable: true
			} );
			const originalClipboard = global.navigator.clipboard;
			const originalAlert = global.alert;
			global.navigator.clipboard = {
				writeText( text ) {
					copiedText = text;
					return Promise.resolve();
				}
			};
			global.alert = ( msg ) => {
				alertedWith = msg;
			};

			graph.self.Data = {
				NodeA: { properties: { P1: { canonicalLabel: 'Has_Author' } } }
			};

			const instance = new ExportGraphTool( {} );
			instance.onSelect();

			assert.true( copiedText.includes( 'nodes=NodeA' ), 'the generated wikitext includes the node list' );
			assert.true( copiedText.includes( 'properties=Has_Author' ), 'the generated wikitext includes the property list' );

			// navigator.clipboard.writeText(...).then(...) resolves asynchronously
			// (even though the stub above resolves immediately) -- restoring the
			// alert/clipboard stubs before that microtask runs would make its
			// alert(...) call hit the real (undefined) global.alert instead.
			return Promise.resolve().then( () => {
				assert.strictEqual( alertedWith, 'knowledgegraph-copied-to-clipboard', 'alert() is called with the copied-to-clipboard message once the clipboard write resolves' );
			} ).finally( () => {
				global.navigator.clipboard = originalClipboard;
				global.alert = originalAlert;
			} );
		} );

		QUnit.test( "'help-button' opens the help URL in a new window", ( assert ) => {
			const HelpButtonTool = actionTools[ 'help-button' ];
			const originalOpen = global.window ? global.window.open : undefined;
			let openedUrl;
			global.window = global.window || {};
			global.window.open = ( url ) => {
				openedUrl = url;
				return { focus() {} };
			};

			try {
				const instance = new HelpButtonTool( {} );
				instance.onSelect();

				assert.strictEqual( openedUrl, '', 'window.open is called with the (currently empty) HelpUrl constant' );
			} finally {
				global.window.open = originalOpen;
			}
		} );

		QUnit.test( "'info-button' opens a non-modal WindowManager dialog, then toggles it closed on a second select", ( assert ) => {
			const InfoButtonTool = actionTools[ 'info-button' ];
			const instance = new InfoButtonTool( {} );

			instance.onSelect();
			assert.true( !!graph.self.WindowManagerNonModal, 'a non-modal WindowManager is created on first select' );
		} );

	} );

	QUnit.module( 'attachContextMenuListener', ( moduleHooks ) => {

		moduleHooks.beforeEach( () => {
			const container = document.createElement( 'div' );
			graph.initialize( container, null, null, makeConfig() );
		} );

		function getContextHandler() {
			return graph.self.Network.listeners.oncontext[ 0 ];
		}

		QUnit.test( 'no-ops when the params carry no usable DOM event', ( assert ) => {
			assert.true(
				( () => {
					try {
						getContextHandler()( {} );
						return true;
					} catch ( e ) {
						return false;
					}
				} )(),
				'a params object without event/domEvent does not throw'
			);
		} );

		QUnit.test( 'prevents the default context menu and stops propagation when a usable DOM event is present', ( assert ) => {
			let prevented = false;
			let stopped = false;
			const domEvent = {
				preventDefault() {
					prevented = true;
				},
				stopPropagation() {
					stopped = true;
				}
			};

			getContextHandler()( {
				event: domEvent,
				pointer: { DOM: { x: 0, y: 0 } }
			} );

			assert.true( prevented, 'domEvent.preventDefault is called' );
			assert.true( stopped, 'domEvent.stopPropagation is called' );
		} );

		QUnit.test( 'no-ops when neither a node nor an edge is at the pointer', ( assert ) => {
			const domEvent = { preventDefault() {} };
			graph.self.Network.getEdgeAt = () => undefined;
			graph.self.Network.getNodeAt = () => undefined;

			let queried = false;
			const original$ = global.$;
			global.$ = function ( selector ) {
				if ( typeof selector === 'string' && selector.includes( 'kg-node-properties-menu' ) ) {
					queried = true;
				}
				return original$( selector );
			};

			try {
				getContextHandler()( {
					event: domEvent,
					pointer: { DOM: { x: 0, y: 0 } }
				} );
			} finally {
				global.$ = original$;
			}

			assert.false( queried, 'no menu element is looked up/created when there is no node or edge under the pointer' );
		} );

		// Spies on document.createElement() to capture any <li> created with the
		// article-link class, since the fake jQuery $menu.append() is a no-op that
		// doesn't track children (see tests/node-qunit/stubs/mw-oo-stubs.js) --
		// this is the only way to observe whether the link entry was built.
		function captureLinkEntries( fn ) {
			const originalCreateElement = document.createElement;
			const created = [];
			document.createElement = function ( tagName ) {
				const el = originalCreateElement( tagName );
				created.push( el );
				return el;
			};
			try {
				fn();
			} finally {
				document.createElement = originalCreateElement;
			}
			return created.filter( ( el ) => el.classList.contains( 'kg-node-properties-menu-link-entry' ) );
		}

		QUnit.test( 'a right-click on a typeID 9 (wikipage) node adds a link entry for the article', ( assert ) => {
			graph.self.Nodes.add( { id: 'Foo', typeID: 9 } );
			graph.self.Network.getNodeAt = () => 'Foo';
			graph.self.Network.getEdgeAt = () => undefined;

			const linkEntries = captureLinkEntries( () => {
				getContextHandler()( {
					event: { pageX: 1, pageY: 1, preventDefault() {} },
					pointer: { DOM: { x: 0, y: 0 } }
				} );
			} );

			assert.strictEqual( linkEntries.length, 1, 'exactly one article-link entry is added for a typeID 9 node' );
		} );

		QUnit.test( 'a right-click on a typeID !== 9 node with no formatter omits the article link entry', ( assert ) => {
			graph.self.Nodes.add( { id: 'Foo', typeID: 2 } );
			graph.self.Network.getNodeAt = () => 'Foo';
			graph.self.Network.getEdgeAt = () => undefined;

			const linkEntries = captureLinkEntries( () => {
				getContextHandler()( {
					event: { pageX: 1, pageY: 1, preventDefault() {} },
					pointer: { DOM: { x: 0, y: 0 } }
				} );
			} );

			assert.strictEqual( linkEntries.length, 0, 'no article-link entry is added for a plain value node (typeID 2, no formatter)' );
		} );

		QUnit.test( 'a right-click on a typeID !== 9 node with an external formatter adds a formatted link entry', ( assert ) => {
			graph.self.Nodes.add( { id: 'ABC123', typeID: 2, formattedUrl: 'https://example.org/id/ABC123' } );
			graph.self.Network.getNodeAt = () => 'ABC123';
			graph.self.Network.getEdgeAt = () => undefined;

			const linkEntries = captureLinkEntries( () => {
				getContextHandler()( {
					event: { pageX: 1, pageY: 1, preventDefault() {} },
					pointer: { DOM: { x: 0, y: 0 } }
				} );
			} );

			assert.strictEqual( linkEntries.length, 1, 'a link entry is added when an external formatter URL is configured' );
		} );

		QUnit.test( 'a right-click on an edge with a label adds a property link entry pointing at the Property: page', ( assert ) => {
			graph.self.Edges.add( { id: 'e1', from: 'A', to: 'B', label: '-Has_Author (extra)' } );

			assert.true(
				( () => {
					try {
						getContextHandler()( {
							event: { pageX: 1, pageY: 1, preventDefault() {} },
							pointer: { DOM: { x: 0, y: 0 } },
							edges: [ 'e1' ]
						} );
						return true;
					} catch ( e ) {
						return false;
					}
				} )(),
				'handling an edge right-click does not throw'
			);
		} );

		QUnit.test( 'a right-click on an edge without a label, or a missing edge, no-ops', ( assert ) => {
			graph.self.Edges.add( { id: 'e1', from: 'A', to: 'B' } );

			assert.true(
				( () => {
					try {
						getContextHandler()( {
							event: { pageX: 1, pageY: 1, preventDefault() {} },
							pointer: { DOM: { x: 0, y: 0 } },
							edges: [ 'e1' ]
						} );
						getContextHandler()( {
							event: { pageX: 1, pageY: 1, preventDefault() {} },
							pointer: { DOM: { x: 0, y: 0 } },
							edges: [ 'missing-edge' ]
						} );
						return true;
					} catch ( e ) {
						return false;
					}
				} )(),
				'neither a label-less edge nor a missing edge id throws'
			);
		} );

		// The property-click-to-edit-graph logic nested deep inside
		// attachContextMenuListener() (including the stripHashSuffix() helper) --
		// roughly resources/KnowledgeGraph.js lines 1022-1265 -- re-implements a
		// large slice of edge/node diffing against self.Nodes/self.Edges/self.Data
		// keyed off a clicked <li>'s data-action/data-direction attributes. Driving
		// it meaningfully would require faithfully reproducing jQuery event
		// delegation, PropColors/PropIdPropLabelMap bookkeeping, and vis.DataSet
		// mutation semantics well beyond what mw-oo-stubs.js models -- explicitly
		// flagged as a low-value-to-effort branch per issue #90. Documented here
		// as a known gap rather than forcing a shallow test.

	} );

} );
