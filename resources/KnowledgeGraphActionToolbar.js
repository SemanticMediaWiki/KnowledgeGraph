/**
 * KnowledgeGraph
 *
 * @licence GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

KnowledgeGraphActionToolbar = (function () {
	function createActionToolbar(onSelect) {
		// see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/refs/tags/v0.40.4/demos/pages/toolbars.js
		var toolFactory = new OO.ui.ToolFactory();
		var toolGroupFactory = new OO.ui.ToolGroupFactory();

		var toolbar = new OO.ui.Toolbar(toolFactory, toolGroupFactory, {
			actions: false,
		});

		var toolGroup = [
			{
				name: 'info-button',
				icon: 'info',
				// title: mw.msg('knowledgegraph-toolbar-info'),
				onSelect: onSelect,
			},
			{
				name: 'help-button',
				icon: 'helpNotice',
				// title: mw.msg('knowledgegraph-toolbar-help'),
				onSelect: onSelect,
			},
		];

		var include = [];
		if (mw.config.get('KnowledgeGraphDisableCredits') === false) {
			include.push('info-button');
		}

		// this should be required only when the toolbar
		// is not rendered in the special page and the
		// extension page has been published
		if (false) {
			include.push('info-button');
		}

		// @see https://www.mediawiki.org/wiki/OOUI/Toolbars
		toolbar.setup([
			{
				type: 'bar',
				include,
			},
		]);

		createToolGroup(toolFactory, 'selectSwitch', toolGroup);

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
		create: createActionToolbar,
	};
})();
