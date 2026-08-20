/**
 * KnowledgeGraph
 *
 * @license GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

KnowledgeGraphActionToolbar = ( function () {
	function createActionToolbar( onSelect ) {
		// see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/refs/tags/v0.40.4/demos/pages/toolbars.js
		const toolFactory = new OO.ui.ToolFactory();
		const toolGroupFactory = new OO.ui.ToolGroupFactory();

		const toolbar = new OO.ui.Toolbar( toolFactory, toolGroupFactory, {
			actions: false
		} );

		const toolGroup = [
			{
				name: 'info-button',
				icon: 'info',
				// title: mw.msg('knowledgegraph-toolbar-info'),
				onSelect: onSelect
			},
			{
				name: 'help-button',
				icon: 'helpNotice',
				// title: mw.msg('knowledgegraph-toolbar-help'),
				onSelect: onSelect
			}
		];

		const include = [];
		if ( mw.config.get( 'KnowledgeGraphDisableCredits' ) === false ) {
			include.push( 'info-button' );
		}

		// this should be required only when the toolbar
		// is not rendered in the special page and the
		// extension page has been published
		// eslint-disable-next-line no-constant-condition
		if ( false ) {
			include.push( 'info-button' );
		}

		// @see https://www.mediawiki.org/wiki/OOUI/Toolbars
		toolbar.setup( [
			{
				type: 'bar',
				include
			}
		] );

		createToolGroup( toolFactory, 'selectSwitch', toolGroup );

		return toolbar;
	}

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
		create: createActionToolbar
	};
}() );
