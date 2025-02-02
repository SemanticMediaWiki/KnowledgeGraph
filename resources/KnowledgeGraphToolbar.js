/**
 * KnowledgeGraph
 *
 * @licence GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

KnowledgeGraphToolbar = (function () {
	function createToolbar(onSelect) {
		var toolFactory = new OO.ui.ToolFactory();
		var toolGroupFactory = new OO.ui.ToolGroupFactory();

		var toolbar = new OO.ui.Toolbar(toolFactory, toolGroupFactory, {
			actions: true,
		});

		var toolGroup = [
			{
				name: 'add-node',
				icon: 'add',
				title: mw.msg('knowledgegraph-toolbar-add-node'),
				onSelect,
			},
			{
				name: 'show-config',
				icon: 'settings',
				title: mw.msg('knowledgegraph-toolbar-toggle-config'),
				onSelect,
			},
			{
				name: 'export-graph',
				icon: 'eye',
				title: mw.msg('knowledgegraph-toolbar-export-graph'),
				onSelect,
			},
		];

		// if (Config.context === 'parserfunction') {
		if (true) {
			toolGroup.splice(2, 0, {
				name: 'reload',
				icon: 'reload',
				title: mw.msg('knowledgegraph-toolbar-reset-network'),
				onSelect,
			});
		}

		createToolGroup(toolFactory, 'group', toolGroup);

		toolbar.setup([
			{
				name: 'my-group',
				// type: "bar",
				// label: "Create property",
				include: [{ group: 'group' }],
			},
		]);

		return toolbar;
	}

	function createTool(obj, config) {
		var Tool = function () {
			// Tool.super.apply( this, arguments );
			Tool.super.call(this, arguments[0], config);

			OO.ui.mixin.PendingElement.call(this, {});

			if (KnowledgeGraphFunctions.getNestedProp(['data', 'disabled'], config)) {
				// this.setPendingElement(this.$element)
				// this.pushPending();
				this.setDisabled(true);
			}

			if (KnowledgeGraphFunctions.getNestedProp(['data', 'pending'], config)) {
				// this.setPendingElement(this.$element)
				this.pushPending();
			}

			// @see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/c2805c7e9e83e2f3a857451d46c80231d1658a0f/demos/pages/toolbars.js
			this.toggled = false;
			if (config.init) {
				config.init.call(this);
			}
		};

		OO.inheritClass(Tool, OO.ui.Tool);
		OO.mixinClass(Tool, OO.ui.mixin.PendingElement);

		Tool.prototype.onSelect = function () {
			if (obj.onSelect) {
				obj.onSelect.call(this);
			} else {
				this.toggled = !this.toggled;
				this.setActive(this.toggled);
			}
			// Tool.emit( 'updateState' );
		};

		Tool.prototype.onUpdateState = function () {
			this.popPending();
			this.setDisabled(false);
		};

		for (var i in obj) {
			Tool.static[i] = obj[i];
		}

		Tool.static.displayBothIconAndLabel = true;

		return Tool;
	}

	function createToolGroup(toolFactory, groupName, tools) {
		tools.forEach(function (tool) {
			var obj = jQuery.extend({}, tool);
			obj.group = groupName;
			var config = tool.config ? tool.config : {};
			delete obj.config;
			toolFactory.register(createTool(obj, config));
		});
	}

	return {
		create: createToolbar,
	};
})();
