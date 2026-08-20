/**
 * KnowledgeGraph
 *
 * @license GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

// Shared OO.ui.Tool/ToolGroup construction, extracted out of KnowledgeGraphToolbar.js
// and KnowledgeGraphActionToolbar.js, which previously each carried a byte-for-byte
// identical copy of createTool()/createToolGroup() (see issue #94).
KnowledgeGraphToolbarFactory = ( function () {
	function createTool( obj ) {
		const Tool = function () {
			Tool.super.call( this, arguments[ 0 ] );

			this.toggled = false;
		};

		OO.inheritClass( Tool, OO.ui.Tool );

		Tool.prototype.onSelect = function () {
			if ( obj.onSelect ) {
				obj.onSelect.call( this );
			} else {
				this.toggled = !this.toggled;
				this.setActive( this.toggled );
			}
		};

		Tool.prototype.onUpdateState = function () {};

		for ( const i in obj ) {
			Tool.static[ i ] = obj[ i ];
		}

		Tool.static.displayBothIconAndLabel = true;

		return Tool;
	}

	function createToolGroup( toolFactory, groupName, tools ) {
		tools.forEach( ( tool ) => {
			const obj = jQuery.extend( {}, tool );
			obj.group = groupName;
			toolFactory.register( createTool( obj ) );
		} );
	}

	return {
		createTool,
		createToolGroup
	};
}() );
