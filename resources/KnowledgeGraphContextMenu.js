/**
 * KnowledgeGraph
 *
 * @license GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

KnowledgeGraphNonContextMenu = ( function () {
	const PopupMenuId = 'knowledgegraphp-popup-menu';

	function ContextMenu( config ) {
		const existingEl = document.getElementById( PopupMenuId );
		if ( existingEl ) {
			existingEl.remove();
		}
		const el = document.createElement( 'div' );
		el.id = PopupMenuId;
		el.className = config.className;

		const ul = document.createElement( 'ul' );
		el.append( ul );

		for ( const item of config.items ) {
			const li = document.createElement( 'li' );
			const span = document.createElement( 'span' );
			span.className =
				'oo-ui-iconElement oo-ui-iconElement-icon oo-ui-labelElement-invisible oo-ui-iconWidget oo-ui-icon-' +
				item.icon;
			li.append( span );
			const textNode = document.createTextNode( item.label );
			li.append( textNode );
			li.addEventListener( 'click', item.onClick );
			ul.append( li );
		}

		$( document ).click( () => {
			const menuEl = document.getElementById( PopupMenuId );
			if ( menuEl ) {
				menuEl.remove();
			}
		} );

		$( '#' + PopupMenuId ).click( ( e ) => {
			e.stopPropagation();
			return false;
		} );
		this.el = el;
	}

	ContextMenu.prototype.showAt = function ( x, y ) {
		this.el.style.left = x + 'px';
		this.el.style.top = y + 'px';
		document.body.appendChild( this.el );
	};

	return {
		ContextMenu
	};
}() );
