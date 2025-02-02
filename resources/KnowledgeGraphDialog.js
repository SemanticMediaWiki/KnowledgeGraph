/**
 * KnowledgeGraph
 *
 * @licence GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

KnowledgeGraphDialog = (function () {
	var Config, CallbackActionProcess, CallbackOnSetup, CallbackInitializeResultsPanel;

	function MyDialog(config) {
		MyDialog.super.call(this, config);
	}

	OO.inheritClass(MyDialog, OO.ui.ProcessDialog);
	// OO.inheritClass(MyDialog, OO.ui.Dialog);

	// Specify a name for .addWindows()
	MyDialog.static.name = 'myDialog';
	// Specify the static configurations: title and action set
	MyDialog.static.actions = [
		{
			flags: ['primary', 'progressive'],
			label: mw.msg('knowledgegraph-dialog-continue'),
			action: 'continue',
			modes: ['select'],
		},
		{
			action: 'back',
			label: mw.msg('knowledgegraph-dialog-back'),
			flags: ['safe', 'back'],
			modes: ['show-results', 'no-results', 'existing-node'],
		},
		{
			flags: ['primary', 'progressive'],
			label: mw.msg('knowledgegraph-dialog-done'),
			action: 'done',
			modes: ['show-results', 'edit'],
		},
		{
			flags: 'safe',
			label: mw.msg('knowledgegraph-dialog-cancel'),
			modes: ['select', 'no-results', 'show-results', 'existing-node', 'edit'],
		},
		{
			action: 'delete',
			label: mw.msg('knowledgegraph-dialog-delete'),
			flags: 'destructive',
			modes: ['edit'],
		},
	];

	// Customize the initialize() function to add content and layouts:
	MyDialog.prototype.initialize = function () {
		MyDialog.super.prototype.initialize.call(this);

		var self = this;

		var panelA = new OO.ui.PanelLayout({
			padded: true,
			expanded: true,
		});

		var indexLayout = new OO.ui.IndexLayout({
			framed: true,
			showMenu: false,
			expanded: true,
			padded: false,
			autoFocus: false,
		});

		function TabPanelOneLayout(name, config) {
			TabPanelOneLayout.super.call(this, name, config);
			var fieldsetLayout = new OO.ui.FieldsetLayout();
			var items = [];

			self.titleInputWidget = new mw.widgets.TitleInputWidget({
				autocomplete: true,
				// suggestions: true,
				// addQueryInput: true,
				// $overlay: true,
				// allowSuggestionsWhenEmpty: true,
			});

			items.push(
				new OO.ui.FieldLayout(self.titleInputWidget, {
					label: mw.msg('knowledgegraph-dialog-select-article'),
					align: 'top',
				})
			);

			self.depthInputWidget = new OO.ui.NumberInputWidget({
				value: Config.depth,
			});

			items.push(
				new OO.ui.FieldLayout(self.depthInputWidget, {
					label: mw.msg('knowledgegraph-dialog-edit-depth'),
					align: 'top',
				})
			);

			fieldsetLayout.addItems(items);

			this.$element.append(fieldsetLayout.$element);
		}
		OO.inheritClass(TabPanelOneLayout, OO.ui.TabPanelLayout);
		TabPanelOneLayout.prototype.setupTabItem = function () {
			this.tabItem.setLabel(mw.msg('knowledgegraph-dialog-tabs-by-article'));
		};

		function TabPanelTwoLayout(name, config) {
			TabPanelTwoLayout.super.call(this, name, config);
			var fieldsetLayout = new OO.ui.FieldsetLayout();

			self.propertiesInputWidget = new mw.widgets.TitlesMultiselectWidget({
				autocomplete: true,
				namespace: 102,
				// suggestions: true,
				// addQueryInput: true,
				// $overlay: true,
				// allowSuggestionsWhenEmpty: true,
			});

			var items = [];
			items.push(
				new OO.ui.FieldLayout(self.propertiesInputWidget, {
					label: mw.msg('knowledgegraph-dialog-select-properties'),
					align: 'top',
					// helpInline: true,
					// help: 'Type an article title in the "MediaWiki" namespace',
				})
			);

			self.depthInputWidgetProperties = new OO.ui.NumberInputWidget({
				value: Config.depth,
			});

			items.push(
				new OO.ui.FieldLayout(self.depthInputWidgetProperties, {
					label: mw.msg('knowledgegraph-dialog-edit-depth'),
					align: 'top',
				})
			);

			self.limitInputWidgetProperties = new OO.ui.NumberInputWidget({
				value: 100,
			});

			items.push(
				new OO.ui.FieldLayout(self.limitInputWidgetProperties, {
					label: mw.msg('knowledgegraph-dialog-edit-limit'),
					align: 'top',
				})
			);

			self.offsetInputWidgetProperties = new OO.ui.NumberInputWidget({
				value: 0,
			});

			items.push(
				new OO.ui.FieldLayout(self.offsetInputWidgetProperties, {
					label: mw.msg('knowledgegraph-dialog-edit-offset'),
					align: 'top',
				})
			);

			fieldsetLayout.addItems(items);

			this.$element.append(fieldsetLayout.$element);
		}
		OO.inheritClass(TabPanelTwoLayout, OO.ui.TabPanelLayout);
		TabPanelTwoLayout.prototype.setupTabItem = function () {
			this.tabItem.setLabel(mw.msg('knowledgegraph-dialog-tabs-by-properties'));
		};

		function TabPanelThreeLayout(name, config) {
			TabPanelThreeLayout.super.call(this, name, config);
			var fieldsetLayout = new OO.ui.FieldsetLayout();

			self.categoriesInputWidget = new mw.widgets.CategoryMultiselectWidget({
				autocomplete: true,
				// suggestions: true,
				// addQueryInput: true,
				// $overlay: true,
				// allowSuggestionsWhenEmpty: true,
			});

			var items = [];
			items.push(
				new OO.ui.FieldLayout(self.categoriesInputWidget, {
					label: mw.msg('knowledgegraph-dialog-select-categories'),
					align: 'top',
					// helpInline: true,
					// help: 'Type an article title in the "MediaWiki" namespace',
				})
			);

			self.depthInputWidgetCategories = new OO.ui.NumberInputWidget({
				value: 0,
			});

			items.push(
				new OO.ui.FieldLayout(self.depthInputWidgetCategories, {
					label: mw.msg('knowledgegraph-dialog-edit-depth'),
					align: 'top',
				})
			);

			self.limitInputWidgetCategories = new OO.ui.NumberInputWidget({
				value: 100,
			});

			items.push(
				new OO.ui.FieldLayout(self.limitInputWidgetCategories, {
					label: mw.msg('knowledgegraph-dialog-edit-limit'),
					align: 'top',
				})
			);

			self.offsetInputWidgetCategories = new OO.ui.NumberInputWidget({
				value: 0,
			});

			items.push(
				new OO.ui.FieldLayout(self.offsetInputWidgetCategories, {
					label: mw.msg('knowledgegraph-dialog-edit-offset'),
					align: 'top',
				})
			);

			fieldsetLayout.addItems(items);

			this.$element.append(fieldsetLayout.$element);
		}
		OO.inheritClass(TabPanelThreeLayout, OO.ui.TabPanelLayout);
		TabPanelThreeLayout.prototype.setupTabItem = function () {
			this.tabItem.setLabel(mw.msg('knowledgegraph-dialog-tabs-by-categories'));
		};
		var tabPanel1 = new TabPanelOneLayout('by-article'),
			tabPanel2 = new TabPanelTwoLayout('by-properties');
		tabPanel3 = new TabPanelThreeLayout('by-categories');

		indexLayout.addTabPanels([tabPanel1, tabPanel2, tabPanel3]);

		this.indexLayout = indexLayout;

		panelA.$element.append(indexLayout.$element);

		var panelB = new OO.ui.PanelLayout({
			padded: true,
			expanded: false,
		});

		// this.fieldset = new OO.ui.FieldsetLayout({
		// 	label:
		// 		'toggle the properties that you would like to display on the network',
		// });
		// panelB.$element.append(this.fieldset.$element);

		this.panelB = panelB;

		this.stackLayout = new OO.ui.StackLayout({
			items: [panelA, panelB],
			continuous: false, // !hasMultiplePanels(),
			expanded: true,
			padded: false,
			// The following classes are used here:
			// * PanelPropertiesStack
			// * PanelPropertiesStack-empty
			// classes: classes
		});

		this.$body.append(this.stackLayout.$element);

		// this.urlInput.connect(this, { change: "onUrlInputChange" });
	};

	MyDialog.prototype.getBodyHeight = function () {
		// Note that "expanded: false" must be set in the panel's configuration for this to work.
		// When working with a stack layout, you can use:
		//   return this.panels.getCurrentItem().$element.outerHeight( true );
		//return this.stackLayout.getCurrentItem().$element.outerHeight(true);
		return 280;
	};

	MyDialog.prototype.getSetupProcess = function (data) {
		data = data || {};
		return MyDialog.super.prototype.getSetupProcess
			.call(this, data)
			.next(function() {
				CallbackOnSetup(this, data);
			}, this);
	};

	MyDialog.prototype.initializeResultsPanel = function (
		mode,
		selectedTab,
		data,
		titleFullText
	) {
		// 	ModelProperties = {};
		// 	var items = [];
		// 	for (var i in Properties) {
		// 		var toggleInput = new OO.ui.ToggleSwitchWidget({
		// 			value: true,
		// 		});
		// 		ModelProperties[i] = toggleInput;
		// 		var field = new OO.ui.FieldLayout(toggleInput, {
		// 			label: i,
		// 			help: '',
		// 			helpInline: true,
		// 			align: 'top',
		// 		});
		// 		items.push(field);
		// 	}
		// 	this.fieldset.addItems(items);

		this.panelB.$element.empty();

		var $el = CallbackInitializeResultsPanel(
			this,
			mode,
			selectedTab,
			data,
			titleFullText
		);

		this.panelB.$element.append($el);
		var panel = this.stackLayout.getItems()[1];
		this.stackLayout.setItem(panel);
	};

	// Specify processes to handle the actions.
	MyDialog.prototype.getActionProcess = function (action) {
		var selfDialog = this;

		var ret = CallbackActionProcess(this, MyDialog.super.prototype.getActionProcess, action);
		if ( ret ) {
			return ret;
		}

		return MyDialog.super.prototype.getActionProcess.call(this, action);
	};

	MyDialog.prototype.getTeardownProcess = function (data) {
		return MyDialog.super.prototype.getTeardownProcess
			.call(this, data)
			.first(function () {
				// Perform any cleanup as needed
			}, this);
	};
	
	function create( config, params, callbackActionProcess, callbackOnSetup, callbackInitializeResultsPanel ) {
		Config = config;
		CallbackActionProcess = callbackActionProcess;
		CallbackOnSetup = callbackOnSetup;
		CallbackInitializeResultsPanel = callbackInitializeResultsPanel;

		return new MyDialog(params);
	}
	
	return {
		create
	}
})();
