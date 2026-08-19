'use strict';

QUnit.module( 'ext.knowledgegraph.nonmodaldialog', () => {

	QUnit.test( 'create returns a NonModalDialog instance', ( assert ) => {
		const dialog = KnowledgeGraphNonModalDialog.create( {} );

		assert.true( dialog instanceof OO.ui.Dialog, 'the created dialog is an instance of OO.ui.Dialog' );
	} );

	QUnit.test( 'initialize sets the element id to knowledgegraph-credits', ( assert ) => {
		const dialog = KnowledgeGraphNonModalDialog.create( {} );

		dialog.initialize();

		assert.strictEqual( dialog.elementId, 'knowledgegraph-credits', 'setElementId is called with knowledgegraph-credits' );
	} );

	QUnit.test( 'initialize appends the credits message content to this.content.$element', ( assert ) => {
		const dialog = KnowledgeGraphNonModalDialog.create( {} );

		const appended = [];
		const OriginalPanelLayout = OO.ui.PanelLayout;
		OO.ui.PanelLayout = function ( config ) {
			const panel = new OriginalPanelLayout( config );
			const originalAppend = panel.$element.append;
			panel.$element.append = function ( ...args ) {
				appended.push( ...args );
				return originalAppend.apply( this, args );
			};
			return panel;
		};

		try {
			dialog.initialize();
		} finally {
			OO.ui.PanelLayout = OriginalPanelLayout;
		}

		assert.true(
			appended.some( ( arg ) => typeof arg === 'string' && arg.includes( 'knowledgegraph-credits' ) ),
			'content includes the knowledgegraph-credits message'
		);
		assert.true(
			appended.includes( 'knowledgegraph-credits-list' ),
			'content includes the knowledgegraph-credits-list message'
		);
	} );

	QUnit.test( 'initialize creates a close button labeled via OO.ui.msg and wires it to dialog.close()', ( assert ) => {
		const dialog = KnowledgeGraphNonModalDialog.create( {} );

		const createdButtons = [];
		const OriginalButtonWidget = OO.ui.ButtonWidget;
		OO.ui.ButtonWidget = function ( config ) {
			const button = new OriginalButtonWidget( config );
			createdButtons.push( button );
			return button;
		};

		let closeCalled = 0;
		dialog.close = function () {
			closeCalled++;
		};

		try {
			dialog.initialize();
		} finally {
			OO.ui.ButtonWidget = OriginalButtonWidget;
		}

		assert.strictEqual( createdButtons.length, 1, 'exactly one close button is created' );
		assert.strictEqual( createdButtons[ 0 ].config.label, 'ooui-dialog-process-dismiss', 'the button is labeled via OO.ui.msg( "ooui-dialog-process-dismiss" )' );

		createdButtons[ 0 ].emit( 'click' );

		assert.strictEqual( closeCalled, 1, 'clicking the close button calls dialog.close()' );
	} );

	QUnit.test( 'getBodyHeight delegates to this.content.$element.outerHeight( true )', ( assert ) => {
		const dialog = KnowledgeGraphNonModalDialog.create( {} );

		let calledWith;
		dialog.content = {
			$element: {
				outerHeight( withMargin ) {
					calledWith = withMargin;
					return 123;
				}
			}
		};

		const height = dialog.getBodyHeight();

		assert.strictEqual( calledWith, true, 'outerHeight is called with true' );
		assert.strictEqual( height, 123, 'getBodyHeight returns the value from this.content.$element.outerHeight( true )' );
	} );

} );
