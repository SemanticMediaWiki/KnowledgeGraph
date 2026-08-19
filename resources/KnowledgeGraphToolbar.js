/**
 * KnowledgeGraph
 *
 * @license GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

KnowledgeGraphToolbar = ( function () {
	function createToolbar( onSelect ) {
		const toolFactory = new OO.ui.ToolFactory();
		const toolGroupFactory = new OO.ui.ToolGroupFactory();

		const toolbar = new OO.ui.Toolbar( toolFactory, toolGroupFactory, {
			actions: true
		} );

		const toolGroup = [
			{
				name: 'add-node',
				icon: 'add',
				title: mw.msg( 'knowledgegraph-toolbar-add-node' ),
				onSelect
			},
			{
				name: 'show-config',
				icon: 'settings',
				title: mw.msg( 'knowledgegraph-toolbar-toggle-config' ),
				onSelect
			},
			{
				name: 'export-graph',
				icon: 'eye',
				title: mw.msg( 'knowledgegraph-toolbar-export-graph' ),
				onSelect
			}
		];

		// if (Config.context === 'parserfunction') {
		// eslint-disable-next-line no-constant-condition
		if ( true ) {
			toolGroup.splice( 2, 0, {
				name: 'reload',
				icon: 'reload',
				title: mw.msg( 'knowledgegraph-toolbar-reset-network' ),
				onSelect
			} );
		}

		createToolGroup( toolFactory, 'group', toolGroup );

		toolbar.setup( [
			{
				name: 'my-group',
				// type: "bar",
				// label: "Create property",
				include: [ { group: 'group' } ]
			}
		] );

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
		create: createToolbar
	};
}() );
