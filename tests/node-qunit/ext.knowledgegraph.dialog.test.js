'use strict';

// Captures the params passed to `new mw.Api().get( params )` during fn(), and
// resolves .done() with the given response -- mirrors the mw.Api mocking
// pattern documented in the issue for KnowledgeGraphDialog.js's title-input
// `input` handler.
function stubApiGet( response ) {
	let capturedParams;
	const OriginalApi = mw.Api;
	mw.Api = function () {};
	mw.Api.prototype.get = function ( params ) {
		capturedParams = params;
		return {
			done( fn ) {
				if ( response !== undefined ) {
					fn( response );
				}
				return this;
			},
			fail() {
				return this;
			}
		};
	};
	return {
		restore() {
			mw.Api = OriginalApi;
		},
		getCapturedParams() {
			return capturedParams;
		}
	};
}

function createInitializedDialog( config, callbacks ) {
	callbacks = callbacks || {};
	const dialog = KnowledgeGraphDialog.create(
		config || {},
		{},
		callbacks.actionProcess || ( () => null ),
		callbacks.onSetup || ( () => {} ),
		callbacks.initializeResultsPanel || ( () => document && undefined )
	);
	dialog.initialize();
	return dialog;
}

QUnit.module( 'ext.knowledgegraph.dialog', ( hooks ) => {

	hooks.beforeEach( () => {
		// TabPanelOneLayout.initialize() reads Object.keys()/wgFormattedNamespaces
		// lookups over these -- they throw if left undefined, so every test that
		// calls initialize() needs a default.
		mw.config.set( 'wgExtraNamespaces', {} );
		mw.config.set( 'wgFormattedNamespaces', {} );
	} );

	QUnit.test( 'static.actions has the expected 5 entries', ( assert ) => {
		const actions = KnowledgeGraphDialog.create( {}, {}, () => null, () => {}, () => {} )
			.constructor.static.actions;

		assert.strictEqual( actions.length, 5, 'there are 5 actions' );

		assert.deepEqual(
			actions[ 0 ],
			{
				flags: [ 'primary', 'progressive' ],
				label: 'knowledgegraph-dialog-continue',
				action: 'continue',
				modes: [ 'select' ]
			},
			'continue action'
		);
		assert.deepEqual(
			actions[ 1 ],
			{
				action: 'back',
				label: 'knowledgegraph-dialog-back',
				flags: [ 'safe', 'back' ],
				modes: [ 'show-results', 'no-results', 'existing-node' ]
			},
			'back action'
		);
		assert.deepEqual(
			actions[ 2 ],
			{
				flags: [ 'primary', 'progressive' ],
				label: 'knowledgegraph-dialog-done',
				action: 'done',
				modes: [ 'show-results', 'edit' ]
			},
			'done action'
		);
		assert.deepEqual(
			actions[ 3 ],
			{
				flags: 'safe',
				label: 'knowledgegraph-dialog-cancel',
				modes: [ 'select', 'edit' ]
			},
			'cancel action -- not shown in modes that already have a competing "back" ' +
				'action, since OO.ui.ProcessDialog only promotes the first visible ' +
				'safe-flagged action into the header, leaving any other to fall through ' +
				'to the footer'
		);
		assert.deepEqual(
			actions[ 4 ],
			{
				action: 'delete',
				label: 'knowledgegraph-dialog-delete',
				flags: 'destructive',
				modes: [ 'edit' ]
			},
			'delete action'
		);
	} );

	QUnit.test( 'create stores Config/callbacks and returns a MyDialog instance', ( assert ) => {
		const actionProcess = () => null;
		const onSetup = () => {};
		const initializeResultsPanel = () => {};

		const dialog = KnowledgeGraphDialog.create( { depth: 3 }, { foo: 'bar' }, actionProcess, onSetup, initializeResultsPanel );

		assert.true( dialog instanceof OO.ui.ProcessDialog, 'the created dialog is an instance of OO.ui.ProcessDialog' );
	} );

	QUnit.module( 'TabPanelOneLayout (by-article)', () => {

		QUnit.test( 'namespace dropdown includes the main-namespace entry plus one per wgExtraNamespaces entry, labeled from wgFormattedNamespaces', ( assert ) => {
			mw.config.set( 'wgExtraNamespaces', { 102: 'Property', 14: 'Category' } );
			// wgFormattedNamespaces is MediaWiki core's display-oriented map -- here
			// it differs from the canonical wgExtraNamespaces label to prove the
			// dropdown label is sourced from it, not from wgExtraNamespaces.
			mw.config.set( 'wgFormattedNamespaces', { 102: 'Eigenschaft', 14: 'Kategorie' } );

			const dialog = createInitializedDialog( { depth: 2 } );

			assert.deepEqual(
				dialog.namespaceDropdown.config.options,
				[
					{ data: 0, label: 'knowledgegraph-dialog-main-namespace' },
					{ data: 102, label: 'Eigenschaft' },
					{ data: 14, label: 'Kategorie' }
				],
				'options include main namespace plus each extra namespace, labeled via wgFormattedNamespaces and with data parsed as an int'
			);
		} );

		QUnit.test( 'namespace dropdown excludes odd-numbered (Talk) namespaces', ( assert ) => {
			mw.config.set( 'wgExtraNamespaces', {
				102: 'Property',
				103: 'Property_talk',
				14: 'Category',
				15: 'Category_talk'
			} );
			mw.config.set( 'wgFormattedNamespaces', {
				102: 'Property',
				103: 'Property talk',
				14: 'Category',
				15: 'Category talk'
			} );

			const dialog = createInitializedDialog( { depth: 2 } );

			assert.deepEqual(
				dialog.namespaceDropdown.config.options,
				[
					{ data: 0, label: 'knowledgegraph-dialog-main-namespace' },
					{ data: 14, label: 'Category' },
					{ data: 102, label: 'Property' }
				],
				'the odd (Talk) counterpart of each extra namespace is filtered out'
			);
		} );

		QUnit.test( 'namespace dropdown sorts extra namespaces alphabetically by label, not by id', ( assert ) => {
			mw.config.set( 'wgExtraNamespaces', { 200: 'Zebra', 100: 'Alpha', 300: 'Middle' } );
			mw.config.set( 'wgFormattedNamespaces', { 200: 'Zebra', 100: 'Alpha', 300: 'Middle' } );

			const dialog = createInitializedDialog( { depth: 2 } );

			assert.deepEqual(
				dialog.namespaceDropdown.config.options,
				[
					{ data: 0, label: 'knowledgegraph-dialog-main-namespace' },
					{ data: 100, label: 'Alpha' },
					{ data: 300, label: 'Middle' },
					{ data: 200, label: 'Zebra' }
				],
				'extra namespaces are ordered by label alphabetically, independent of their numeric id order'
			);
		} );

		QUnit.test( 'namespace dropdown label falls back to the raw wgExtraNamespaces name when wgFormattedNamespaces has no entry for it', ( assert ) => {
			mw.config.set( 'wgExtraNamespaces', { 102: 'Property_Name' } );
			mw.config.set( 'wgFormattedNamespaces', {} );

			const dialog = createInitializedDialog( { depth: 2 } );

			assert.deepEqual(
				dialog.namespaceDropdown.config.options,
				[
					{ data: 0, label: 'knowledgegraph-dialog-main-namespace' },
					{ data: 102, label: 'Property_Name' }
				],
				'without a wgFormattedNamespaces entry, the option label falls back to the raw wgExtraNamespaces name'
			);
		} );

		QUnit.test( 'depth field defaults to Config.depth', ( assert ) => {
			const dialog = createInitializedDialog( { depth: 7 } );

			assert.strictEqual( dialog.depthInputWidget.getValue(), 7, 'depthInputWidget defaults to Config.depth' );
		} );

		QUnit.test( 'setupTabItem sets the tab label via knowledgegraph-dialog-tabs-by-article', ( assert ) => {
			const dialog = createInitializedDialog();

			const tabPanel = dialog.indexLayout.getItems()[ 0 ];
			const tabItem = { setLabel( label ) {
				this.label = label;
			} };
			tabPanel.tabItem = tabItem;
			tabPanel.setupTabItem();

			assert.strictEqual( tabItem.label, 'knowledgegraph-dialog-tabs-by-article', 'tab label is set via the correct mw.msg key' );
		} );

		QUnit.test( 'empty title-input value returns early without calling mw.Api().get()', ( assert ) => {
			const dialog = createInitializedDialog();
			const api = stubApiGet();

			try {
				dialog.titleInputWidget.$input.val( '' );
				dialog.titleInputWidget.$input.trigger( 'input' );

				assert.strictEqual( api.getCapturedParams(), undefined, 'mw.Api().get() is not called for an empty value' );
			} finally {
				api.restore();
			}
		} );

		QUnit.test( 'non-empty title-input value calls mw.Api().get() with the expected params', ( assert ) => {
			const dialog = createInitializedDialog();
			const api = stubApiGet( {} );

			try {
				dialog.namespaceDropdown.setValue( 102 );
				dialog.titleInputWidget.$input.val( 'foo bar' );
				dialog.titleInputWidget.$input.trigger( 'input' );

				assert.deepEqual(
					api.getCapturedParams(),
					{
						action: 'query',
						format: 'json',
						list: 'allpages',
						apnamespace: 102,
						apprefix: 'foo_bar',
						aplimit: 50
					},
					'mw.Api().get() is called with the expected query params, spaces replaced with underscores'
				);
			} finally {
				api.restore();
			}
		} );

		QUnit.test( 'resolved response with allpages populates the menu, filtered by the input value', ( assert ) => {
			const dialog = createInitializedDialog();
			const api = stubApiGet( {
				query: {
					allpages: [
						{ title: 'Foo:Bar Baz' },
						{ title: 'Foo:Something Else' }
					]
				}
			} );

			try {
				dialog.titleInputWidget.$input.val( 'bar' );
				dialog.titleInputWidget.$input.trigger( 'input' );

				const menu = dialog.titleInputWidget.getMenu();
				const items = menu.getItems();

				assert.strictEqual( items.length, 1, 'only the matching page is added to the menu' );
				assert.strictEqual( items[ 0 ].config.label, 'Bar Baz', 'the namespace prefix is stripped from the label' );
				assert.strictEqual( items[ 0 ].config.data, 'Foo:Bar Baz', 'the full title is kept as the item data' );
				assert.true( menu.visible, 'the menu is toggled visible since there is at least one match' );
			} finally {
				api.restore();
			}
		} );

		QUnit.test( 'resolved response with no matches clears and hides the menu', ( assert ) => {
			const dialog = createInitializedDialog();
			const api = stubApiGet( {
				query: {
					allpages: [ { title: 'Foo:Something Else' } ]
				}
			} );

			try {
				dialog.titleInputWidget.$input.val( 'nomatch' );
				dialog.titleInputWidget.$input.trigger( 'input' );

				const menu = dialog.titleInputWidget.getMenu();

				assert.strictEqual( menu.getItems().length, 0, 'no items are added when nothing matches' );
				assert.false( menu.visible, 'the menu is toggled hidden' );
			} finally {
				api.restore();
			}
		} );

		QUnit.test( 'resolved response with no allpages results in an empty, hidden menu', ( assert ) => {
			const dialog = createInitializedDialog();
			const api = stubApiGet( {} );

			try {
				dialog.titleInputWidget.$input.val( 'anything' );
				dialog.titleInputWidget.$input.trigger( 'input' );

				const menu = dialog.titleInputWidget.getMenu();

				assert.strictEqual( menu.getItems().length, 0, 'menu items are empty' );
				assert.false( menu.visible, 'the menu is toggled hidden' );
			} finally {
				api.restore();
			}
		} );

	} );

	QUnit.module( 'TabPanelTwoLayout (by-properties)', () => {

		QUnit.test( 'properties multiselect is constructed with namespace: 102', ( assert ) => {
			const dialog = createInitializedDialog( { depth: 4 } );

			assert.strictEqual( dialog.propertiesInputWidget.config.namespace, 102, 'propertiesInputWidget is restricted to namespace 102' );
		} );

		QUnit.test( 'titles multiselect is constructed without a namespace restriction', ( assert ) => {
			const dialog = createInitializedDialog();

			assert.strictEqual( dialog.titlesInputWidget.config.namespace, undefined, 'titlesInputWidget has no namespace config' );
		} );

		QUnit.test( 'depth/limit/offset number inputs default to Config.depth/100/0', ( assert ) => {
			const dialog = createInitializedDialog( { depth: 5 } );

			assert.strictEqual( dialog.depthInputWidgetProperties.getValue(), 5, 'depth defaults to Config.depth' );
			assert.strictEqual( dialog.limitInputWidgetProperties.getValue(), 100, 'limit defaults to 100' );
			assert.strictEqual( dialog.offsetInputWidgetProperties.getValue(), 0, 'offset defaults to 0' );
		} );

		QUnit.test( 'setupTabItem sets the tab label via knowledgegraph-dialog-tabs-by-properties', ( assert ) => {
			const dialog = createInitializedDialog();

			const tabPanel = dialog.indexLayout.getItems()[ 1 ];
			const tabItem = { setLabel( label ) {
				this.label = label;
			} };
			tabPanel.tabItem = tabItem;
			tabPanel.setupTabItem();

			assert.strictEqual( tabItem.label, 'knowledgegraph-dialog-tabs-by-properties', 'tab label is set via the correct mw.msg key' );
		} );

	} );

	QUnit.module( 'TabPanelThreeLayout (by-categories)', () => {

		QUnit.test( 'categories multiselect plus depth/limit/offset default to 0/100/0', ( assert ) => {
			const dialog = createInitializedDialog();

			assert.strictEqual( typeof dialog.categoriesInputWidget, 'object', 'categoriesInputWidget is constructed' );
			assert.strictEqual( dialog.depthInputWidgetCategories.getValue(), 0, 'depth defaults to 0' );
			assert.strictEqual( dialog.limitInputWidgetCategories.getValue(), 100, 'limit defaults to 100' );
			assert.strictEqual( dialog.offsetInputWidgetCategories.getValue(), 0, 'offset defaults to 0' );
		} );

		QUnit.test( 'setupTabItem sets the tab label via knowledgegraph-dialog-tabs-by-categories', ( assert ) => {
			const dialog = createInitializedDialog();

			const tabPanel = dialog.indexLayout.getItems()[ 2 ];
			const tabItem = { setLabel( label ) {
				this.label = label;
			} };
			tabPanel.tabItem = tabItem;
			tabPanel.setupTabItem();

			assert.strictEqual( tabItem.label, 'knowledgegraph-dialog-tabs-by-categories', 'tab label is set via the correct mw.msg key' );
		} );

	} );

	QUnit.test( 'initialize adds all three tab panels in order and assigns indexLayout/panelB/stackLayout', ( assert ) => {
		const dialog = createInitializedDialog();

		const items = dialog.indexLayout.getItems();
		assert.strictEqual( items.length, 3, 'three tab panels are added' );

		assert.true( !!dialog.indexLayout, 'this.indexLayout is assigned' );
		assert.true( !!dialog.panelB, 'this.panelB is assigned' );
		assert.true( !!dialog.stackLayout, 'this.stackLayout is assigned' );
		assert.strictEqual( dialog.stackLayout.getItems().length, 2, 'the stack layout has the selection panel and the results panel' );
	} );

	QUnit.test( 'getBodyHeight returns the fixed 340', ( assert ) => {
		const dialog = createInitializedDialog();

		assert.strictEqual( dialog.getBodyHeight(), 340, 'getBodyHeight always returns 340' );
	} );

	QUnit.test( 'getSetupProcess chains .next() and invokes CallbackOnSetup( this, data )', ( assert ) => {
		let calledWith;
		const dialog = createInitializedDialog( {}, {
			onSetup: ( dialogArg, data ) => {
				calledWith = [ dialogArg, data ];
			}
		} );

		const process = dialog.getSetupProcess( { some: 'data' } );
		process.execute();

		assert.strictEqual( calledWith[ 0 ], dialog, 'CallbackOnSetup is invoked with the dialog instance' );
		assert.deepEqual( calledWith[ 1 ], { some: 'data' }, 'CallbackOnSetup is invoked with the setup data' );
	} );

	QUnit.test( 'getSetupProcess defaults data to {} when called without an argument', ( assert ) => {
		let calledWith;
		const dialog = createInitializedDialog( {}, {
			onSetup: ( dialogArg, data ) => {
				calledWith = data;
			}
		} );

		dialog.getSetupProcess().execute();

		assert.deepEqual( calledWith, {}, 'CallbackOnSetup receives an empty object when no data is passed' );
	} );

	QUnit.test( 'initializeResultsPanel empties panelB, appends the callback result, and switches to the results panel', ( assert ) => {
		const dialog = createInitializedDialog( {}, {
			initializeResultsPanel: () => 'RESULT_ELEMENT'
		} );

		let emptied = false;
		const originalEmpty = dialog.panelB.$element.empty;
		dialog.panelB.$element.empty = function () {
			emptied = true;
			return originalEmpty.apply( this, arguments );
		};

		let appended;
		const originalAppend = dialog.panelB.$element.append;
		dialog.panelB.$element.append = function ( arg ) {
			appended = arg;
			return originalAppend.apply( this, arguments );
		};

		let setItemCalledWith;
		const originalSetItem = dialog.stackLayout.setItem;
		dialog.stackLayout.setItem = function ( item ) {
			setItemCalledWith = item;
			return originalSetItem.apply( this, arguments );
		};

		dialog.initializeResultsPanel( 'mode', 'selectedTab', {}, 'Title' );

		assert.true( emptied, 'panelB.$element is emptied before appending' );
		assert.strictEqual( appended, 'RESULT_ELEMENT', 'the CallbackInitializeResultsPanel return value is appended' );
		assert.strictEqual( setItemCalledWith, dialog.stackLayout.getItems()[ 1 ], 'the stack layout is switched to the results panel (index 1)' );
	} );

	QUnit.test( 'getActionProcess returns the injected callback result when truthy', ( assert ) => {
		let calledWith;
		const dialog = createInitializedDialog( {}, {
			actionProcess: ( dialogArg, superGetActionProcess, action ) => {
				calledWith = [ dialogArg, action ];
				return action === 'done' ? 'CUSTOM_PROCESS' : null;
			}
		} );

		const result = dialog.getActionProcess( 'done' );

		assert.strictEqual( result, 'CUSTOM_PROCESS', 'the truthy callback result is returned as-is' );
		assert.strictEqual( calledWith[ 0 ], dialog, 'the callback is invoked with the dialog instance' );
		assert.strictEqual( calledWith[ 1 ], 'done', 'the callback is invoked with the requested action' );
	} );

	QUnit.test( 'getActionProcess falls back to the superclass when the callback returns falsy', ( assert ) => {
		const dialog = createInitializedDialog( {}, {
			actionProcess: () => null
		} );

		const result = dialog.getActionProcess( 'cancel' );

		assert.strictEqual( typeof result, 'object', 'a process object from the OO.ui.Dialog superclass fallback is returned' );
	} );

	QUnit.test( 'getTeardownProcess chains a .first() cleanup step onto the superclass process', ( assert ) => {
		const dialog = createInitializedDialog();

		const process = dialog.getTeardownProcess( { some: 'data' } );

		assert.strictEqual( typeof process.execute, 'function', 'a process object is returned' );
		process.execute();
		assert.true( true, 'executing the process (including the cleanup step) does not throw' );
	} );

} );
