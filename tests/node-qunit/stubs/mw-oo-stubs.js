/**
 * Hand-rolled stubs for `mw`, `OO`, `$`/`jQuery`, `document`, and `vis`.
 *
 * These exist so the production files under resources/ can be require()'d
 * by the node-qunit harness without throwing at module-load time. They are
 * not meant to faithfully reproduce MediaWiki/OOUI/jQuery/vis-network
 * behaviour -- only the minimal surface actually touched by call sites in
 * resources/*.js. Extend incrementally as later coverage issues need more
 * surface; keep a one-line comment on any addition noting which file/call
 * site needs it.
 *
 * @see https://github.com/SemanticMediaWiki/KnowledgeGraph/issues/82
 */
'use strict';

// Registry of fake elements by id, populated on append/appendChild so
// document.getElementById() can find elements added to document.body
// (KnowledgeGraphContextMenu.js relies on this for its remove-if-present check).
const elementsById = {};

function makeFakeElement( tagName ) {
	const el = {
		tagName: String( tagName || '' ).toUpperCase(),
		id: '',
		className: '',
		innerHTML: '',
		style: {},
		// Real DOMStringMap coerces every assigned value to a string (e.g.
		// `el.dataset.active = true` reads back as `'true'`, not the boolean);
		// mirror that here since KnowledgeGraph.js's dispatchLegendClickEvent
		// compares `container.dataset.active === 'true'`.
		dataset: new Proxy( {}, {
			set( target, key, value ) {
				target[ key ] = String( value );
				return true;
			}
		} ),
		children: [],
		attributes: {},
		listeners: {},
		classList: {
			add( cls ) {
				const list = el.className.split( ' ' ).filter( Boolean );
				if ( !list.includes( cls ) ) {
					list.push( cls );
					el.className = list.join( ' ' );
				}
			},
			remove( cls ) {
				el.className = el.className.split( ' ' ).filter( Boolean ).filter( ( c ) => c !== cls ).join( ' ' );
			},
			contains( cls ) {
				return el.className.split( ' ' ).filter( Boolean ).includes( cls );
			},
			toggle( cls, force ) {
				const has = el.classList.contains( cls );
				const shouldAdd = force === undefined ? !has : force;
				if ( shouldAdd ) {
					el.classList.add( cls );
				} else {
					el.classList.remove( cls );
				}
			}
		},
		append( ...nodes ) {
			el.children.push( ...nodes );
			nodes.forEach( ( node ) => {
				if ( node && node.id ) {
					elementsById[ node.id ] = node;
				}
				if ( node ) {
					node.parentNode = el;
				}
			} );
		},
		appendChild( node ) {
			el.children.push( node );
			if ( node && node.id ) {
				elementsById[ node.id ] = node;
			}
			if ( node ) {
				node.parentNode = el;
			}
			return node;
		},
		// Detaches from both the id registry and the parent's children list
		// (needed so a caller of `querySelector( '#id' )` on the parent stops
		// finding a removed node, e.g. KnowledgeGraph.js's removeLegendEntry).
		remove() {
			if ( el.id && elementsById[ el.id ] === el ) {
				delete elementsById[ el.id ];
			}
			if ( el.parentNode ) {
				el.parentNode.children = el.parentNode.children.filter( ( child ) => child !== el );
				el.parentNode = null;
			}
		},
		addEventListener( type, handler ) {
			el.listeners[ type ] = el.listeners[ type ] || [];
			el.listeners[ type ].push( handler );
		},
		removeEventListener( type, handler ) {
			if ( !el.listeners[ type ] ) {
				return;
			}
			el.listeners[ type ] = el.listeners[ type ].filter( ( h ) => h !== handler );
		},
		setAttribute( name, value ) {
			el.attributes[ name ] = value;
		},
		getAttribute( name ) {
			return el.attributes[ name ] === undefined ? null : el.attributes[ name ];
		},
		// Supports the `#id` selector form only, matched against direct
		// children -- needed by KnowledgeGraph.js's legend entry lookups
		// (addLegendEntry/removeLegendEntry/dispatchLegendClickEvent use
		// `LegendDiv.querySelector( '#' + CSS.escape( id ) )`).
		querySelector( selector ) {
			const match = /^#(.+)$/.exec( selector || '' );
			if ( !match ) {
				return null;
			}
			const id = match[ 1 ].replace( /\\(.)/g, '$1' );
			return el.children.find( ( child ) => child && child.id === id ) || null;
		},
		querySelectorAll() {
			return [];
		}
	};
	return el;
}

function installDocumentStub() {
	// Reset the id registry so elements from a previous test/installStubs()
	// call don't leak into this one via getElementById().
	Object.keys( elementsById ).forEach( ( id ) => delete elementsById[ id ] );

	const body = makeFakeElement( 'body' );

	const documentStub = {
		body,
		createElement( tagName ) {
			return makeFakeElement( tagName );
		},
		createTextNode( text ) {
			return { nodeType: 3, textContent: text };
		},
		getElementById( id ) {
			return elementsById[ id ] || null;
		},
		querySelector() {
			return null;
		},
		querySelectorAll() {
			return [];
		},
		addEventListener() {},
		removeEventListener() {},
		execCommand() {
			return false;
		}
	};

	global.document = documentStub;

	global.CSS = global.CSS || {
		escape( value ) {
			return String( value ).replace( /[^a-zA-Z0-9_-]/g, '\\$&' );
		}
	};
}

// click handlers bound via $( target ).click( fn ), keyed by target identity
// (the `document` singleton, or a '#id' selector string) so a later, separate
// $( target ).click() call -- e.g. from a test -- triggers the same handlers
// that were registered earlier (mirrors jQuery's bind/trigger overload).
// Needed by KnowledgeGraphContextMenu.js's $( document ).click( ... ) and
// $( '#' + PopupMenuId ).click( ... ) listeners.
const clickHandlersByTarget = new Map();

function getClickHandlers( selectorOrElements ) {
	if ( !clickHandlersByTarget.has( selectorOrElements ) ) {
		clickHandlersByTarget.set( selectorOrElements, [] );
	}
	return clickHandlersByTarget.get( selectorOrElements );
}

// Generic on()/trigger() handlers keyed by element identity, so
// KnowledgeGraphDialog.js's `self.titleInputWidget.$input.on( 'input', fn )`
// can be exercised via `.trigger( 'input' )` in tests. Kept separate from
// clickHandlersByTarget (which is keyed by selector/element and backs the
// jQuery-overload click() method used elsewhere).
const onHandlersByElement = new Map();

function getOnHandlers( element, event ) {
	if ( !onHandlersByElement.has( element ) ) {
		onHandlersByElement.set( element, {} );
	}
	const byEvent = onHandlersByElement.get( element );
	byEvent[ event ] = byEvent[ event ] || [];
	return byEvent[ event ];
}

function makeJQueryWrapper( selectorOrElements ) {
	let elements;
	if ( Array.isArray( selectorOrElements ) ) {
		elements = selectorOrElements;
	} else if ( selectorOrElements && typeof selectorOrElements === 'object' ) {
		elements = [ selectorOrElements ];
	} else {
		elements = [];
	}

	const clickHandlers = getClickHandlers( selectorOrElements );

	const wrapper = {
		length: elements.length,
		get( i ) {
			return i === undefined ? elements : elements[ i ];
		},
		each( fn ) {
			elements.forEach( ( el, i ) => fn.call( el, i, el ) );
			return wrapper;
		},
		append() {
			return wrapper;
		},
		appendTo() {
			return wrapper;
		},
		prepend() {
			return wrapper;
		},
		empty() {
			return wrapper;
		},
		remove() {
			return wrapper;
		},
		replaceWith() {
			return wrapper;
		},
		clone() {
			return makeJQueryWrapper( elements );
		},
		find() {
			return makeJQueryWrapper( [] );
		},
		not() {
			return wrapper;
		},
		on( event, handler ) {
			elements.forEach( ( el ) => getOnHandlers( el, event ).push( handler ) );
			return wrapper;
		},
		off() {
			return wrapper;
		},
		one() {
			return wrapper;
		},
		// Fires handlers registered via .on( event, fn ) on each wrapped element,
		// invoking them with `this` bound to the element (mirrors jQuery so
		// `$( this ).val()` inside the handler reads back the same element).
		trigger( event ) {
			elements.forEach( ( el ) => {
				getOnHandlers( el, event ).forEach( ( handler ) => handler.call( el ) );
			} );
			return wrapper;
		},
		// $( document ).ready( fn ) at the top of KnowledgeGraph.js -- invoke
		// immediately since there is no real load event to wait for here.
		ready( fn ) {
			if ( fn ) {
				fn();
			}
			return wrapper;
		},
		click( handlerOrEvent ) {
			if ( typeof handlerOrEvent === 'function' ) {
				clickHandlers.push( handlerOrEvent );
				return wrapper;
			}
			const event = handlerOrEvent || { stopPropagation() {} };
			clickHandlers.forEach( ( handler ) => handler( event ) );
			return wrapper;
		},
		// Reads/writes a `.value` property on each wrapped element, so a fake
		// <input> element's value survives a `.val( x )` / later `.val()` round
		// trip -- needed by KnowledgeGraphDialog.js's `$( this ).val()` read
		// inside its title-input `input` handler.
		val( value ) {
			if ( value === undefined ) {
				return elements.length ? elements[ 0 ].value || '' : '';
			}
			elements.forEach( ( el ) => {
				el.value = value;
			} );
			return wrapper;
		},
		text() {
			return wrapper;
		},
		html() {
			return wrapper;
		},
		attr() {
			return wrapper;
		},
		css() {
			return wrapper;
		},
		hide() {
			return wrapper;
		},
		show() {
			return wrapper;
		},
		toggle() {
			return wrapper;
		},
		addClass() {
			return wrapper;
		},
		removeClass() {
			return wrapper;
		},
		outerHeight() {
			return 0;
		},
		outerWidth() {
			return 0;
		}
	};

	return wrapper;
}

function installJQueryStub() {
	// Reset click-handler bindings so a previous test/installStubs() call
	// doesn't leak handlers into this one.
	clickHandlersByTarget.clear();

	function $( selector ) {
		return makeJQueryWrapper( selector );
	}

	$.extend = function ( target, ...sources ) {
		return Object.assign( target, ...sources );
	};

	// eslint-disable-next-line no-jquery/variable-pattern
	global.$ = $;
	// eslint-disable-next-line no-jquery/variable-pattern
	global.jQuery = $;
}

function inheritClass( ChildClass, ParentClass ) {
	ChildClass.super = ParentClass;
	ChildClass.parent = ParentClass;
	ChildClass.static = Object.create( ParentClass.static || null );
	ChildClass.prototype = Object.create( ParentClass.prototype );
	ChildClass.prototype.constructor = ChildClass;
}

function mixinClass( TargetClass, MixinClass ) {
	Object.assign( TargetClass.prototype, MixinClass.prototype );
}

// Base constructor shared by every hand-rolled OO.ui.* stub widget below.
function makeWidgetBase( name ) {
	function Widget( config ) {
		this.config = config || {};
		this.$element = makeJQueryWrapper( makeFakeElement( 'div' ) );
		this.$input = makeJQueryWrapper( makeFakeElement( 'input' ) );
		// Dialog subclasses (KnowledgeGraphDialog.js/KnowledgeGraphNonModalDialog.js)
		// append content to this.$body inside initialize().
		this.$body = makeJQueryWrapper( makeFakeElement( 'div' ) );
		// StackLayout is constructed with `{ items: [...] }` in
		// KnowledgeGraphDialog.js -- seed this.items from it so
		// getItems()/getCurrentItem() see the panels passed at construction time.
		this.items = ( this.config.items || [] ).slice();
		this.disabled = false;
		this.listeners = {};
	}
	Widget.static = { name, tagName: 'div' };
	Widget.prototype.on = function ( event, handler ) {
		this.listeners[ event ] = this.listeners[ event ] || [];
		this.listeners[ event ].push( handler );
		return this;
	};
	Widget.prototype.off = function () {
		return this;
	};
	Widget.prototype.emit = function ( event, ...args ) {
		( this.listeners[ event ] || [] ).forEach( ( handler ) => handler( ...args ) );
	};
	Widget.prototype.connect = function () {
		return this;
	};
	Widget.prototype.setDisabled = function ( disabled ) {
		this.disabled = disabled;
		return this;
	};
	Widget.prototype.isDisabled = function () {
		return this.disabled;
	};
	Widget.prototype.getValue = function () {
		return this.config.value;
	};
	Widget.prototype.setValue = function ( value ) {
		this.config.value = value;
		return this;
	};
	// A stable per-instance menu (not a fresh object each call) so a test can
	// call getMenu() once, then observe clearItems()/addItems()/toggle() calls
	// made later by production code, e.g. KnowledgeGraphDialog.js's title-input
	// `input` handler populating self.titleInputWidget.getMenu().
	Widget.prototype.getMenu = function () {
		if ( !this.menu ) {
			this.menu = {
				items: [],
				visible: false,
				clearItems() {
					this.items = [];
				},
				addItems( items ) {
					this.items.push( ...items );
				},
				toggle( show ) {
					this.visible = show;
				},
				getItems() {
					return this.items;
				}
			};
		}
		return this.menu;
	};
	Widget.prototype.addItems = function ( items ) {
		this.items.push( ...items );
		return this;
	};
	Widget.prototype.clearItems = function () {
		this.items = [];
		return this;
	};
	Widget.prototype.getItems = function () {
		return this.items;
	};
	Widget.prototype.setLabel = function ( label ) {
		this.label = label;
		return this;
	};
	Widget.prototype.toggle = function () {
		return this;
	};
	return Widget;
}

// Layouts that manage a set of tab panels / stack items (IndexLayout, StackLayout).
function makePanelSetBase( name ) {
	const Base = makeWidgetBase( name );
	Base.prototype.addTabPanels = function ( panels ) {
		this.items.push( ...panels );
		return this;
	};
	Base.prototype.setItem = function ( item ) {
		this.currentItem = item;
		return this;
	};
	Base.prototype.getCurrentItem = function () {
		return this.currentItem || this.items[ 0 ];
	};
	return Base;
}

function installOoStub() {
	const OO = {
		inheritClass,
		mixinClass,
		ui: {}
	};

	const widgetNames = [
		'Dialog',
		'ProcessDialog',
		'PanelLayout',
		'ButtonWidget',
		'ToolFactory',
		'ToolGroupFactory',
		'Toolbar',
		'Tool',
		'Process',
		'WindowManager',
		'MessageWidget',
		'HtmlSnippet',
		'FieldsetLayout',
		'FieldLayout',
		'DropdownInputWidget',
		'ComboBoxInputWidget',
		'NumberInputWidget',
		'CheckboxInputWidget',
		'ToggleSwitchWidget',
		'TabPanelLayout',
		'MenuOptionWidget'
	];

	widgetNames.forEach( ( name ) => {
		OO.ui[ name ] = makeWidgetBase( name );
	} );

	// IndexLayout/StackLayout manage a collection of panels (KnowledgeGraphDialog.js).
	OO.ui.IndexLayout = makePanelSetBase( 'IndexLayout' );
	OO.ui.StackLayout = makePanelSetBase( 'StackLayout' );

	// ProcessDialog action set + process chaining (KnowledgeGraphDialog.js).
	OO.ui.ProcessDialog.static.actions = [];
	OO.ui.Dialog.prototype.close = function () {
		return this;
	};
	OO.ui.Dialog.prototype.setElementId = function ( id ) {
		this.elementId = id;
		return this;
	};

	function makeProcess() {
		const process = {
			next( fn, context ) {
				this.steps = this.steps || [];
				this.steps.push( { fn, context } );
				return process;
			},
			first( fn, context ) {
				this.steps = this.steps || [];
				this.steps.unshift( { fn, context } );
				return process;
			},
			execute() {
				( this.steps || [] ).forEach( ( step ) => step.fn.call( step.context ) );
				return Promise.resolve();
			}
		};
		return process;
	}

	OO.ui.Dialog.prototype.getSetupProcess = function () {
		return makeProcess();
	};
	OO.ui.Dialog.prototype.getTeardownProcess = function () {
		return makeProcess();
	};
	OO.ui.Dialog.prototype.getActionProcess = function () {
		return makeProcess();
	};
	OO.ui.Dialog.prototype.initialize = function () {};
	OO.ui.ProcessDialog.prototype = Object.create( OO.ui.Dialog.prototype );
	OO.ui.ProcessDialog.prototype.constructor = OO.ui.ProcessDialog;

	OO.ui.Process = function ( fn, context ) {
		this.fn = fn;
		this.context = context;
	};

	// mixin.PendingElement is applied via OO.mixinClass, e.g. in
	// KnowledgeGraphToolbar.js / KnowledgeGraphActionToolbar.js createTool().
	OO.ui.mixin = {
		PendingElement: function () {
			this.pending = 0;
		}
	};
	OO.ui.mixin.PendingElement.prototype.pushPending = function () {
		this.pending++;
		return this;
	};
	OO.ui.mixin.PendingElement.prototype.popPending = function () {
		this.pending = Math.max( 0, this.pending - 1 );
		return this;
	};

	// ToolFactory/ToolGroupFactory/Toolbar: registration + setup only, no rendering.
	OO.ui.ToolFactory.prototype.register = function ( ToolClass ) {
		this.tools = this.tools || [];
		this.tools.push( ToolClass );
		return this;
	};
	OO.ui.Toolbar.prototype.setup = function ( groups ) {
		this.groups = groups;
		return this;
	};
	OO.ui.Toolbar.prototype.initialize = function () {
		return this;
	};

	// Tool: base constructor used via OO.inheritClass in
	// KnowledgeGraphToolbar.js/KnowledgeGraphActionToolbar.js createTool().
	OO.ui.Tool.prototype.setActive = function ( active ) {
		this.active = active;
		return this;
	};
	OO.ui.Tool.prototype.setDisabled = function ( disabled ) {
		this.disabled = disabled;
		return this;
	};

	// WindowManager: addWindows()/openWindow() only referenced, never rendered.
	OO.ui.WindowManager.prototype.addWindows = function () {
		return this;
	};
	OO.ui.WindowManager.prototype.openWindow = function () {
		return { closed: Promise.resolve() };
	};

	OO.ui.msg = function ( key ) {
		return key;
	};

	global.OO = OO;
}

function makeResolvedThenable( value ) {
	return {
		done( fn ) {
			if ( fn ) {
				fn( value );
			}
			return this;
		},
		fail() {
			return this;
		},
		then( fn ) {
			return Promise.resolve( fn ? fn( value ) : value );
		}
	};
}

function installMwStub() {
	// KnowledgeGraph.js reads this at the top-level $( document ).ready()
	// handler and JSON.parses it unconditionally -- default to an empty
	// list so requiring the file doesn't throw before a test overrides it.
	const configValues = { knowledgegraphs: '[]' };

	const mw = {
		msg( key, ...args ) {
			return args.length ? `${ key }:${ args.join( ',' ) }` : key;
		},
		config: {
			get( key ) {
				return configValues[ key ];
			},
			set( key, value ) {
				configValues[ key ] = value;
			}
		},
		loader: {
			// Supports both call styles used across resources/*.js:
			// mw.loader.using( mod ).then( fn ) and mw.loader.using( mod, fn ).
			using( modules, callback ) {
				if ( callback ) {
					callback();
				}
				return Promise.resolve();
			}
		},
		Title: {
			newFromText( text ) {
				return text ? { getPrefixedText: () => text } : null;
			}
		},
		widgets: {
			TitlesMultiselectWidget: makeWidgetBase( 'TitlesMultiselectWidget' ),
			CategoryMultiselectWidget: makeWidgetBase( 'CategoryMultiselectWidget' )
		}
	};

	mw.Api = function () {};
	mw.Api.prototype.get = function () {
		return makeResolvedThenable( {} );
	};
	mw.Api.prototype.post = function () {
		return makeResolvedThenable( {} );
	};

	global.mw = mw;
}

function makeDataSetStub( initial ) {
	let items = Array.isArray( initial ) ? initial.slice() : [];
	return {
		get( id ) {
			if ( id === undefined ) {
				return items.slice();
			}
			if ( Array.isArray( id ) ) {
				return items.filter( ( item ) => id.includes( item.id ) );
			}
			return items.find( ( item ) => item.id === id ) || null;
		},
		add( toAdd ) {
			const list = Array.isArray( toAdd ) ? toAdd : [ toAdd ];
			items.push( ...list );
		},
		update( toUpdate ) {
			const list = Array.isArray( toUpdate ) ? toUpdate : [ toUpdate ];
			list.forEach( ( update ) => {
				const existing = items.find( ( item ) => item.id === update.id );
				if ( existing ) {
					Object.assign( existing, update );
				} else {
					items.push( update );
				}
			} );
		},
		remove( id ) {
			const ids = Array.isArray( id ) ? id : [ id ];
			items = items.filter( ( item ) => !ids.includes( item.id ) );
		},
		forEach( fn ) {
			items.forEach( fn );
		},
		getIds() {
			return items.map( ( item ) => item.id );
		}
	};
}

function installVisStub() {
	global.vis = {
		DataSet: function ( initial ) {
			return makeDataSetStub( initial );
		},
		Network: function ( container, data ) {
			this.container = container;
			this.data = data;
			this.listeners = {};
		}
	};

	global.vis.Network.prototype.on = function ( event, handler ) {
		this.listeners[ event ] = this.listeners[ event ] || [];
		this.listeners[ event ].push( handler );
	};
	global.vis.Network.prototype.getConnectedNodes = function () {
		return [];
	};
	global.vis.Network.prototype.getConnectedEdges = function () {
		return [];
	};
	global.vis.Network.prototype.setOptions = function () {};
	global.vis.Network.prototype.fit = function () {};
	global.vis.Network.prototype.destroy = function () {};
}

function installStubs() {
	installDocumentStub();
	installJQueryStub();
	installOoStub();
	installMwStub();
	installVisStub();
}

module.exports = { installStubs };
