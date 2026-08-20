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
		// Needed by KnowledgeGraph.js's legacyCopy() clipboard fallback, which
		// appends then removes a temporary textarea via document.body.
		removeChild( node ) {
			el.children = el.children.filter( ( child ) => child !== node );
			if ( node && node.id && elementsById[ node.id ] === node ) {
				delete elementsById[ node.id ];
			}
			if ( node ) {
				node.parentNode = null;
			}
			return node;
		},
		// Only the 'afterend' position is modeled -- the one KnowledgeGraph.js's
		// initialize() uses to insert the per-instance legend div right after
		// the graph container. Falls back to a no-op (register-by-id only) when
		// `el` has no tracked parent, since the fixture containers used in tests
		// are typically freestanding document.createElement() results.
		insertAdjacentElement( position, node ) {
			if ( node && node.id ) {
				elementsById[ node.id ] = node;
			}
			if ( position === 'afterend' && el.parentNode ) {
				const siblings = el.parentNode.children;
				siblings.splice( siblings.indexOf( el ) + 1, 0, node );
			}
			if ( node ) {
				node.parentNode = el.parentNode || null;
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
		// No-ops -- needed by KnowledgeGraph.js's legacyCopy() clipboard fallback,
		// which calls textarea.focus()/textarea.select() before document.execCommand().
		focus() {},
		select() {},
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
		// Supports the `#id` form (matched against direct children -- needed
		// by KnowledgeGraph.js's legend entry lookups, e.g.
		// `LegendDiv.querySelector( '#' + CSS.escape( id ) )`) and the
		// `tag[attr="value"]` form (matched against direct children -- needed
		// by the context-menu property-entry tests to find the rendered
		// `input[type="checkbox"]`).
		querySelector( selector ) {
			const idMatch = /^#(.+)$/.exec( selector || '' );
			if ( idMatch ) {
				const id = idMatch[ 1 ].replace( /\\(.)/g, '$1' );
				return el.children.find( ( child ) => child && child.id === id ) || null;
			}
			const tagAttrMatch = /^([a-zA-Z]+)\[([a-zA-Z-]+)="([^"]*)"\]$/.exec( selector || '' );
			if ( tagAttrMatch ) {
				const [ , tag, attr, value ] = tagAttrMatch;
				return el.children.find( ( child ) => child &&
					child.tagName === tag.toUpperCase() &&
					( attr === 'type' ? child.type === value : child.attributes[ attr ] === value )
				) || null;
			}
			return null;
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

// Registry of fake elements created via an HTML-string `$( '<tag ...>...</tag>' )`
// call, keyed by the exact markup string, so a later lookup-by-selector call for
// the same element (e.g. KnowledgeGraph.js's per-instance
// `.kg-node-properties-menu[data-instance-id="..."]` re-lookup on a second
// `oncontext` event) finds the element created on the first call instead of
// building an unrelated, empty wrapper.
const elementsByMarkup = {};

// Very small subset of an HTML parser: only handles the single self-contained
// `<tag class="..." data-x="y">...</tag>` shape KnowledgeGraph.js actually
// constructs for its per-instance context menu (`$menu`) and menu `<li>`
// entries. Returns null for anything else so callers fall back to elements: [].
function parseSingleElementMarkup( markup ) {
	const match = /^<([a-z]+)((?:\s+[^\s=>]+(?:="[^"]*")?)*)\s*>([\s\S]*)<\/\1>$/i.exec( markup.trim() );
	if ( !match ) {
		return null;
	}
	const [ , tagName, attrsStr, innerHtml ] = match;
	const el = makeFakeElement( tagName );
	el.innerHTML = innerHtml;
	const attrRegex = /([^\s=]+)(?:="([^"]*)")?/g;
	let attrMatch;
	while ( ( attrMatch = attrRegex.exec( attrsStr ) ) !== null ) {
		const [ , name, value ] = attrMatch;
		if ( name === 'class' ) {
			( value || '' ).split( /\s+/ ).filter( Boolean ).forEach( ( cls ) => el.classList.add( cls ) );
		} else if ( name.startsWith( 'data-' ) ) {
			el.dataset[ name.slice( 5 ).replace( /-([a-z])/g, ( m, c ) => c.toUpperCase() ) ] = value || '';
		} else if ( name ) {
			el.setAttribute( name, value || '' );
		}
	}
	return el;
}

// Matches a simple `tag.class1.class2[data-x="y"]` selector (as used by
// KnowledgeGraph.js's per-instance menu re-lookup) against elements registered
// in elementsByMarkup, so a second `oncontext` call finds the menu the first
// call created instead of creating a fresh, disconnected one.
function findByCssLikeSelector( selector ) {
	const attrMatch = /^([a-z.\-_]*)(?:\[data-([a-z-]+)="([^"]*)"])?$/i.exec( selector.trim() );
	if ( !attrMatch ) {
		return [];
	}
	const [ , classPart, dataName, dataValue ] = attrMatch;
	const classes = classPart.split( '.' ).filter( Boolean );
	const dataKey = dataName ? dataName.replace( /-([a-z])/g, ( m, c ) => c.toUpperCase() ) : null;

	return Object.values( elementsByMarkup ).filter( ( el ) => {
		if ( classes.some( ( cls ) => !el.classList.contains( cls ) ) ) {
			return false;
		}
		if ( dataKey && el.dataset[ dataKey ] !== dataValue ) {
			return false;
		}
		return true;
	} );
}

function makeJQueryWrapper( selectorOrElements ) {
	let elements;
	if ( Array.isArray( selectorOrElements ) ) {
		elements = selectorOrElements;
	} else if ( selectorOrElements && typeof selectorOrElements === 'object' ) {
		elements = [ selectorOrElements ];
	} else if ( typeof selectorOrElements === 'string' && /^\s*</.test( selectorOrElements ) ) {
		if ( !elementsByMarkup[ selectorOrElements ] ) {
			const el = parseSingleElementMarkup( selectorOrElements );
			if ( el ) {
				elementsByMarkup[ selectorOrElements ] = el;
			}
		}
		elements = elementsByMarkup[ selectorOrElements ] ? [ elementsByMarkup[ selectorOrElements ] ] : [];
	} else if ( typeof selectorOrElements === 'string' ) {
		elements = findByCssLikeSelector( selectorOrElements );
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
		// Appends real (fake) elements to each wrapped element's .children, so a
		// later `.find()` on the wrapper can see them -- needed by
		// KnowledgeGraph.js's attachContextMenuListener(), which builds each menu
		// <li> via document.createElement() and `$menu.append( li )`. Plain
		// strings (e.g. `.append( '<p></p>' )`, `.append( mw.msg( ... ) )`, as used
		// by KnowledgeGraphNonModalDialog.js) are not fake elements and carry no
		// observable child-tracking behaviour worth modeling here, so they are
		// dropped rather than passed into a fake element's own append(), which
		// expects to set properties (e.g. .parentNode) on each argument.
		append( ...nodes ) {
			const rawNodes = nodes
				.map( ( n ) => ( n && n.get ? n.get() : n ) )
				.filter( ( n ) => n && typeof n === 'object' );
			elements.forEach( ( el ) => {
				if ( el && el.append ) {
					el.append( ...rawNodes );
				}
			} );
			return wrapper;
		},
		appendTo() {
			return wrapper;
		},
		prepend() {
			return wrapper;
		},
		// Removes every tracked child from each wrapped element -- needed so a
		// re-opened context menu (`$menu.empty()`) doesn't accumulate stale <li>s
		// across `oncontext` invocations.
		empty() {
			elements.forEach( ( el ) => {
				if ( el && el.children ) {
					el.children.slice().forEach( ( child ) => child.remove && child.remove() );
				}
			} );
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
		// Supports simple `tag.class` / `.class` selectors against each wrapped
		// element's tracked .children -- needed by KnowledgeGraph.js's
		// `$menu.find( 'li.kg-node-properties-menu-property-entry' )`.
		find( selector ) {
			const classMatch = /^[a-z]*\.(.+)$/i.exec( selector || '' );
			const wantedClass = classMatch ? classMatch[ 1 ] : null;
			const found = [];
			elements.forEach( ( el ) => {
				( el && el.children || [] ).forEach( ( child ) => {
					if ( !wantedClass || ( child.classList && child.classList.contains( wantedClass ) ) ) {
						found.push( child );
					}
				} );
			} );
			return makeJQueryWrapper( found );
		},
		not() {
			return wrapper;
		},
		on( event, handler ) {
			elements.forEach( ( el ) => getOnHandlers( el, event ).push( handler ) );
			return wrapper;
		},
		// Clears previously-.on()-registered handlers for the given event on each
		// wrapped element -- needed by `$menu.find( ... ).off( 'click' ).on( 'click', fn )`,
		// which would otherwise stack a duplicate handler on every re-opened menu.
		off( event ) {
			elements.forEach( ( el ) => {
				getOnHandlers( el, event ).length = 0;
			} );
			return wrapper;
		},
		one() {
			return wrapper;
		},
		// Fires handlers registered via .on( event, fn ) on each wrapped element,
		// invoking them with `this` bound to the element and a jQuery-style event
		// object (`currentTarget: el`) as the first argument -- needed by
		// KnowledgeGraph.js's property-entry click handler, which reads
		// `ev.currentTarget` to recover the clicked <li>.
		trigger( event ) {
			elements.forEach( ( el ) => {
				getOnHandlers( el, event ).forEach( ( handler ) => handler.call( el, { currentTarget: el } ) );
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
		// Reads a wrapped element's `.dataset` (mirrors jQuery's camelCase
		// `data-*` -> key convention) -- needed by KnowledgeGraph.js's
		// `$li.data( 'action' )` / `$li.data( 'direction' )` reads, backed by
		// `li.dataset.action = ...` / `li.dataset.direction = ...` writes.
		data( key ) {
			return elements.length ? elements[ 0 ].dataset[ key ] : undefined;
		},
		// Delegates to the wrapped element's real classList -- needed by
		// KnowledgeGraph.js's `$li.hasClass( '...-selected' )` check.
		hasClass( cls ) {
			return elements.some( ( el ) => el.classList && el.classList.contains( cls ) );
		},
		// Clears the (never-simulated) jQuery animation queue -- needed by
		// KnowledgeGraph.js's attachContextMenuListener(), which calls
		// `$menu.finish().toggle( 100 ).css( {...} )` before showing the menu.
		finish() {
			return wrapper;
		},
		// Delegates to the wrapped element's real classList -- needed so a
		// later `.hasClass()` (or a direct `el.classList.contains()` check)
		// observes the toggle KnowledgeGraph.js's property-entry click handler
		// applies to the clicked `<li>`.
		addClass( cls ) {
			elements.forEach( ( el ) => el.classList && el.classList.add( cls ) );
			return wrapper;
		},
		removeClass( cls ) {
			elements.forEach( ( el ) => el.classList && el.classList.remove( cls ) );
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
	// Reset click-handler bindings and any HTML-string-created elements so a
	// previous test/installStubs() call doesn't leak state into this one.
	clickHandlersByTarget.clear();
	onHandlersByElement.clear();
	Object.keys( elementsByMarkup ).forEach( ( key ) => delete elementsByMarkup[ key ] );

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
	Widget.prototype.setSelected = function ( selected ) {
		this.config.selected = selected;
		return this;
	};
	Widget.prototype.isSelected = function () {
		return this.config.selected;
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
	// Returns a thenable (not just `this`) since KnowledgeGraph.js's
	// getDialogActionProcessCallback() 'done' branch calls `.close(...).then(...)`.
	OO.ui.Dialog.prototype.close = function () {
		return { then( fn ) {
			if ( fn ) {
				fn();
			}
			return this;
		} };
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
	// KnowledgeGraph.js's getDialogActionProcessCallback() constructs these
	// directly (`new OO.ui.Process( fn )`) rather than via the dialog's chained
	// getActionProcess()/makeProcess() helper above -- needs its own execute().
	OO.ui.Process.prototype.execute = function () {
		this.fn.call( this.context );
		return Promise.resolve();
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
	// $actions holds the action-toolbar's $element when `actions: true`
	// (KnowledgeGraph.js's initialize() appends the action toolbar into it via
	// `toolbar.$actions.append( actionToolbar.$element )`).
	OO.ui.Toolbar.prototype.$actions = null;
	const originalToolbarConstructor = OO.ui.Toolbar;
	OO.ui.Toolbar = function ( ...args ) {
		originalToolbarConstructor.apply( this, args );
		this.$actions = makeJQueryWrapper( makeFakeElement( 'div' ) );
	};
	OO.ui.Toolbar.prototype = originalToolbarConstructor.prototype;
	OO.ui.Toolbar.static = originalToolbarConstructor.static;
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
	// KnowledgeGraph.js's getOnSelectToolbar()/getOnSelectActionToolbar() switch
	// on `selfTool.getName()` (bound to `this` inside Tool.prototype.onSelect).
	OO.ui.Tool.prototype.getName = function () {
		return this.constructor.static.name;
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
		},
		util: {
			getUrl( pageName, params ) {
				const query = params ?
					'?' + Object.keys( params ).map( ( k ) => `${ k }=${ encodeURIComponent( params[ k ] ) }` ).join( '&' ) :
					'';
				return `/wiki/${ pageName }${ query }`;
			}
		}
	};

	mw.Api = function () {};
	mw.Api.prototype.get = function () {
		return makeResolvedThenable( {} );
	};
	mw.Api.prototype.post = function () {
		return makeResolvedThenable( {} );
	};
	// Default for loadNodes()'s postWithToken() call site (e.g. the
	// context-menu property-toggle handler, invoked on every node right-click) --
	// resolves with an empty body so loadNodes() cleanly rejects (missing
	// `data` key) instead of throwing, for tests that right-click a node
	// without caring about its properties. Tests that DO care override this
	// via their own mw.Api stub.
	mw.Api.prototype.postWithToken = function () {
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
		// Captures the 3rd constructor argument (`options`, e.g. self.Config.graphOptions
		// in KnowledgeGraph.js's initialize()) as this.options -- needed so a test can
		// assert what options a `new vis.Network(...)` call was constructed with.
		Network: function ( container, data, options ) {
			this.container = container;
			this.data = data;
			this.options = options;
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
	// Needed by KnowledgeGraph.js's attachContextMenuListener() (pointer hit-testing
	// on right-click) and its Network 'hoverEdge'/'blurNode'/'blurEdge' handlers.
	global.vis.Network.prototype.getEdgeAt = function () {
		return undefined;
	};
	global.vis.Network.prototype.getNodeAt = function () {
		return undefined;
	};
	global.vis.Network.prototype.selectEdges = function () {};
	global.vis.Network.prototype.unselectAll = function () {};
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
