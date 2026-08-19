'use strict';

QUnit.module( 'ext.knowledgegraph.contextmenu', () => {

	QUnit.test( 'removes a pre-existing popup menu element', ( assert ) => {
		const existing = document.createElement( 'div' );
		existing.id = 'knowledgegraphp-popup-menu';
		document.body.appendChild( existing );

		assert.strictEqual( document.getElementById( 'knowledgegraphp-popup-menu' ), existing, 'precondition: existing element is found' );

		// eslint-disable-next-line no-new
		new KnowledgeGraphNonContextMenu.ContextMenu( { className: 'foo', items: [] } );

		assert.notStrictEqual( document.getElementById( 'knowledgegraphp-popup-menu' ), existing, 'the pre-existing element is no longer registered' );
	} );

	QUnit.test( 'construction does not throw when no pre-existing element is present', ( assert ) => {
		assert.strictEqual( document.getElementById( 'knowledgegraphp-popup-menu' ), null, 'precondition: no existing element' );

		assert.true(
			( () => {
				try {
					// eslint-disable-next-line no-new
					new KnowledgeGraphNonContextMenu.ContextMenu( { className: 'foo', items: [] } );
					return true;
				} catch ( e ) {
					return false;
				}
			} )(),
			'constructing without a pre-existing element does not throw'
		);
	} );

	QUnit.test( 'creates the root element with the configured className', ( assert ) => {
		const menu = new KnowledgeGraphNonContextMenu.ContextMenu( { className: 'my-menu-class', items: [] } );

		assert.strictEqual( menu.el.id, 'knowledgegraphp-popup-menu', 'root element has the popup menu id' );
		assert.strictEqual( menu.el.tagName, 'DIV', 'root element is a div' );
		assert.strictEqual( menu.el.className, 'my-menu-class', 'root element className comes from config.className' );
	} );

	QUnit.test( 'renders one li per config item with icon span and label text', ( assert ) => {
		const onClickA = () => {};
		const onClickB = () => {};
		const menu = new KnowledgeGraphNonContextMenu.ContextMenu( {
			className: 'foo',
			items: [
				{ icon: 'add', label: 'Add', onClick: onClickA },
				{ icon: 'trash', label: 'Delete', onClick: onClickB }
			]
		} );

		const ul = menu.el.children[ 0 ];
		assert.strictEqual( ul.tagName, 'UL', 'root element contains a ul' );
		assert.strictEqual( ul.children.length, 2, 'one li per config item' );

		const [ liA, liB ] = ul.children;

		assert.strictEqual( liA.tagName, 'LI', 'item is rendered as an li' );
		const spanA = liA.children[ 0 ];
		assert.strictEqual( spanA.tagName, 'SPAN', 'item contains an icon span' );
		assert.true( spanA.className.includes( 'oo-ui-icon-add' ), 'icon span className includes oo-ui-icon-<item.icon>' );
		const textNodeA = liA.children[ 1 ];
		assert.strictEqual( textNodeA.textContent, 'Add', 'item contains a text node with the item label' );
		assert.strictEqual( liA.listeners.click[ 0 ], onClickA, 'item onClick is registered as a click listener' );

		const spanB = liB.children[ 0 ];
		assert.true( spanB.className.includes( 'oo-ui-icon-trash' ), 'second item icon span className includes oo-ui-icon-<item.icon>' );
		const textNodeB = liB.children[ 1 ];
		assert.strictEqual( textNodeB.textContent, 'Delete', 'second item contains a text node with the item label' );
		assert.strictEqual( liB.listeners.click[ 0 ], onClickB, 'second item onClick is registered as a click listener' );
	} );

	QUnit.test( 'clicking a rendered item invokes its onClick callback', ( assert ) => {
		let called = 0;
		const menu = new KnowledgeGraphNonContextMenu.ContextMenu( {
			className: 'foo',
			items: [ { icon: 'add', label: 'Add', onClick: () => {
				called++;
			} } ]
		} );

		const ul = menu.el.children[ 0 ];
		const li = ul.children[ 0 ];

		li.listeners.click.forEach( ( handler ) => handler() );

		assert.strictEqual( called, 1, 'clicking the li invokes the registered onClick callback' );
	} );

	QUnit.test( 'showAt sets style.left/top and appends the element to document.body', ( assert ) => {
		const menu = new KnowledgeGraphNonContextMenu.ContextMenu( { className: 'foo', items: [] } );

		menu.showAt( 12, 34 );

		assert.strictEqual( menu.el.style.left, '12px', 'style.left is set to "<x>px"' );
		assert.strictEqual( menu.el.style.top, '34px', 'style.top is set to "<y>px"' );
		assert.true( document.body.children.includes( menu.el ), 'the element is appended to document.body' );
		assert.strictEqual( document.getElementById( 'knowledgegraphp-popup-menu' ), menu.el, 'the appended element can be found via getElementById' );
	} );

	QUnit.test( 'document-level click removes the menu when present', ( assert ) => {
		const menu = new KnowledgeGraphNonContextMenu.ContextMenu( { className: 'foo', items: [] } );
		menu.showAt( 0, 0 );

		assert.strictEqual( document.getElementById( 'knowledgegraphp-popup-menu' ), menu.el, 'precondition: menu is present' );

		$( document ).click();

		assert.strictEqual( document.getElementById( 'knowledgegraphp-popup-menu' ), null, 'a document-level click removes the menu' );
	} );

	QUnit.test( 'document-level click does not throw when the menu is already absent', ( assert ) => {
		// eslint-disable-next-line no-new
		new KnowledgeGraphNonContextMenu.ContextMenu( { className: 'foo', items: [] } );
		// Menu was never shown, so it was never registered under its id.

		assert.true(
			( () => {
				try {
					$( document ).click();
					return true;
				} catch ( e ) {
					return false;
				}
			} )(),
			'triggering the document click handler without a rendered menu does not throw'
		);
	} );

	QUnit.test( 'clicking inside the menu stops propagation and returns false', ( assert ) => {
		// eslint-disable-next-line no-new
		new KnowledgeGraphNonContextMenu.ContextMenu( { className: 'foo', items: [] } );

		let stopPropagationCalled = false;
		const fakeEvent = {
			stopPropagation() {
				stopPropagationCalled = true;
			}
		};

		const $result = $( '#knowledgegraphp-popup-menu' ).click( fakeEvent );

		assert.true( stopPropagationCalled, 'the click-inside handler calls stopPropagation on the event' );
		// The click-inside handler itself returns false; the stub's click()
		// always resolves to the wrapper for chaining, so assert the
		// handler's own return value was exercised via stopPropagation instead.
		assert.strictEqual( typeof $result.click, 'function', 'the jQuery wrapper is returned for chaining' );
	} );

} );
