/**
 * KnowledgeGraph
 *
 * @licence GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 * @credits https://github.com/OpenSemanticLab/mediawiki-extensions-InteractiveSemanticGraph
 */

KnowledgeGraph = function () {
	var Nodes;
	var Edges;
	var Data = {};
	var maxPropValueLength = 20;
	var Config;
	var Container;
	var Properties = {};
	// var ModelProperties = {};
	var SelectedNode = null;
	var TmpData;
	var Network;
	var PopupMenuId = 'knowledgegraphp-popup-menu';
	var InitialData;
	var ContainerOptions;
	var WindowManagerNonModal;
	var DialogCredits = 'dialog-credits';
	var PropColors = {};
	var Categories = {};
	var LegendDiv;
	var PropIdPropLabelMap = {};

	function addLegendEntry(id, label, color) {
		if ($(LegendDiv).find('#' + id.replace(/ /g, '_')).length) {
			return;
		}

		var container = document.createElement('button');
		container.className = 'legend-element-container';
		container.classList.add('btn', 'btn-outline-light');
		container.id = id.replace(/ /g, '_');
		container.style.color = 'black';
		container.style.background = color;
		container.innerHTML = label;

		container.dataset.active = true;
		container.dataset.active_color = color;

		container.addEventListener('click', (event) =>
			dispatchEvent_LegendClick(event, id)
		);

		LegendDiv.append(container);
	}

	function dispatchEvent_LegendClick(event, id) {
		var container = $(LegendDiv).find('#' + id.replace(/ /g, '_'))[0];
		if (container.dataset.active === 'true') {
			container.dataset.active = false;
			container.style.background = '#FFFFFF';
		} else {
			container.dataset.active = true;
			container.style.background = container.dataset.active_color;
		}
		var updateNodes = [];
		var visited = [];

		function toggleConnectedNodes(nodeId) {
			if (visited.indexOf(nodeId) !== -1) {
				return;
			}
			visited.push(nodeId);

			var connectedNodes = Network.getConnectedNodes(nodeId);

			for (var nodeId_ of connectedNodes) {
				var connectedEdgesIds = Network.getConnectedEdges(nodeId_);
				var connectedEdges = Edges.get(connectedEdgesIds);

				var found = false;
				connectedEdges.forEach((edge) => {
					if (edge.to === nodeId) {
						found = true;
					}
				});

				if (!found) {
					updateNodes.push({
						id: nodeId_,
						hidden: container.dataset.active === 'true' ? false : true,
					});
					toggleConnectedNodes(nodeId_);
				}
			}
		}

		Nodes.forEach((node) => {
		
			if (PropIdPropLabelMap[id].indexOf(node.id) !== -1) {
				updateNodes.push({
					id: node.id,
					hidden: container.dataset.active === 'true' ? false : true,
				});
				toggleConnectedNodes(node.id);
			}
		});

		Nodes.update(updateNodes);
	}

	function deleteNode(nodeId) {
		var children = Network.getConnectedNodes(nodeId);
		children = children.filter(
			(x) => !(x in Data) || Network.getConnectedNodes(x).length === 1
		);
		children.push(nodeId);

		for (var nodeId of children) {
			Edges.remove(Network.getConnectedEdges(nodeId));
		}
		Nodes.remove(children);
		for (var nodeId of children) {
			delete Data[nodeId];
		}
	}

	function loadNodes(obj) {
		if (obj.title !== null) {
			var payload = {
				action: 'knowledgegraph-load-nodes',
				titles: obj.title,
				depth: obj.depth,
				properties: JSON.stringify(Config['properties']),
			};
		} else if (obj.properties !== null) {
			var payload = {
				action: 'knowledgegraph-load-properties',
				properties: obj.properties.join('|'),
				depth: obj.depth,
				limit: obj.limit,
				offset: obj.offset,
			};
		} else if (obj.categories !== null) {
			var payload = {
				action: 'knowledgegraph-load-categories',
				categories: obj.categories.join('|'),
				depth: obj.depth,
				limit: obj.limit,
				offset: obj.offset,
			};
		}

		// console.log('payload', payload);

		return new Promise((resolve, reject) => {
			mw.loader.using('mediawiki.api', function () {
				new mw.Api()
					.postWithToken('csrf', payload)
					.done(function (thisRes) {
						if ('data' in thisRes[payload.action]) {
							// console.log('data', data);
							var data_ = JSON.parse(thisRes[payload.action].data);
							resolve(data_);
						} else {
							reject();
						}
					})
					.fail(function (thisRes) {
						// eslint-disable-next-line no-console
						console.error(payload.action, thisRes);
						reject(thisRes);
					});
			});
		});
	}

	function createHTMLTitle(label) {
		var fieldset = new OO.ui.FieldsetLayout({
			label: label,
		});

		var items = [];

		var linkButton = new OO.ui.ButtonWidget({
			label: 'open',
			icon: 'link',
			flags: [],
		});

		items.push(linkButton);

		var deleteButton = new OO.ui.ButtonWidget({
			label: 'open',
			icon: 'trash',
			flags: ['destructive'],
		});

		items.push(deleteButton);

		fieldset.addItems(items);

		var panel = new OO.ui.PanelLayout({
			padded: true,
			expanded: false,
		});

		panel.$element.append(fieldset.$element);

		return panel.$element.get(0);
	}

	function addArticleNode(data, label, options) {
		if (Nodes.get(label) !== null) {
			return;
		}

		var nodeConfig = jQuery.extend(
			JSON.parse(JSON.stringify(Config.graphOptions.nodes)),
			label in Config.propertyOptions ? Config.propertyOptions[label] : {},
			{
				id: label,
				label:
					label.length <= maxPropValueLength
						? label
						: label.substring(0, maxPropValueLength) + '…',
				shape: 'box',
				font: { size: 30 },

				// https://visjs.github.io/vis-network/examples/network/other/popups.html
				// title: createHTMLTitle(label),
			},
			options || {}
		);

		if (!(label in data)) {
			nodeConfig.color.border = 'red';
			nodeConfig.font.color = 'red';
			nodeConfig.color.background = 'white';
		}

		if (data[label] === null) {
			nodeConfig.opacity = 0.5;
			nodeConfig.shapeProperties.borderDashes = [5, 5];
		}

		if (
			data[label] &&
			data[label].src &&
			mw.config.get('KnowledgeGraphShowImages') === true
		) {
			nodeConfig.shape = 'image';
			nodeConfig.image = data[label].src;
		}

		Nodes.add(nodeConfig);
	}

	function createNodes(data) {
		for (var label in data) {
			if (label in Data && Data[label] !== null) {
				continue;
			}

			addArticleNode(data, label);

			// not loaded
			if (data[label] === null) {
				continue;
			}

			if (!(label in Categories)) {
				Categories[label] = [];
			}

			for (var i in data[label].categories) {
				var category = data[label].categories[i];
				if (Categories[label].indexOf(category) === -1) {
					Categories[label].push(category);
				}
			}

			// i is property Article title
			for (var i in data[label].properties) {
				// if (
				// 	propLabel in ModelProperties &&
				// 	ModelProperties[propLabel].getValue() === false
				// ) {
				// 	continue;
				// }
				var property = data[label].properties[i];

				if (!(property.canonicalLabel in PropColors)) {
					var color_;
					function colorExists() {
						for ( var j in PropColors ) {
							if ( PropColors[j] === color_ ) {
								return true;
							}
						}
						return false;
					}
					do {
						color_ = randomHSL();
					} while (colorExists());

					PropColors[property.canonicalLabel] = color_;
				}

				var options =
					property.preferredLabel in Config.propertyOptions
						? Config.propertyOptions[property.preferredLabel]
						: property.canonicalLabel in Config.propertyOptions
							? Config.propertyOptions[property.canonicalLabel]
							: {};

				if ('nodes' in options) {
					options = options.nodes;
				}

				if (!('color' in options)) {
					options.color = PropColors[property.canonicalLabel];
				}

				var legendLabel =
					property.preferredLabel !== ''
						? property.preferredLabel
						: property.canonicalLabel;

				if ( !(legendLabel in PropIdPropLabelMap ) ) {
					PropIdPropLabelMap[legendLabel] = [];
				}

				var propLabel =
					legendLabel +
					(!Config['show-property-type']
						? ''
						: ' (' + property.typeLabel + ')');

				if (Config['properties-panel']) {
					addLegendEntry(
						property.canonicalLabel,
						legendLabel,
						PropColors[property.canonicalLabel]
					);
				}

				switch (property.typeId) {
					case '_wpg':
						for (var ii in property.values) {
							PropIdPropLabelMap[legendLabel].push(property.values[ii].value);

							var edgeConfig = jQuery.extend(
								JSON.parse(JSON.stringify(Config.graphOptions.edges)),
								{
									from: label,
									to: property.values[ii].value,
									label: propLabel,
									group: label,
								}
							);

							edgeConfig.arrows.to.enabled = true;
							Edges.add(edgeConfig);
							if (
								property.values[ii].src &&
								mw.config.get('KnowledgeGraphShowImages') === true
							) {
								options.shape = 'image';
								options.image = property.values[ii].src;
							}

							addArticleNode(data, property.values[ii].value, options);
						}

						break;
					// @TODO complete with other property types
					default:
						var valueId = `${i}#${uuidv4()}`;

						PropIdPropLabelMap[legendLabel].push(valueId);

						Edges.add({
							from: label,
							to: valueId,
							label: propLabel,
							group: label,
						});

						var propValue = property.values.map((x) => x.value).join(', ');

						Nodes.add(
							jQuery.extend(options, {
								id: valueId,
								label:
									propValue.length <= maxPropValueLength
										? propValue
										: propValue.substring(0, maxPropValueLength) + '…',
							})
						);
				}
			}
		}

		Data = jQuery.extend(Data, data);
	}

	function ContextMenu(config) {
		var el = document.getElementById(PopupMenuId);
		if (el) {
			el.remove();
		}
		var el = document.createElement('div');
		el.id = PopupMenuId;
		el.className = config.className;

		var html = '';
		var ul = document.createElement('ul');
		el.append(ul);

		for (var item of config.items) {
			var li = document.createElement('li');
			var span = document.createElement('span');
			span.className =
				'oo-ui-iconElement oo-ui-iconElement-icon oo-ui-labelElement-invisible oo-ui-iconWidget oo-ui-icon-' +
				item.icon;
			li.append(span);
			var textNode = document.createTextNode(item.label);
			li.append(textNode);
			li.addEventListener('click', item.onClick);
			ul.append(li);
		}

		$(document).click(function () {
			var el = document.getElementById(PopupMenuId);
			if (el) {
				el.remove();
			}
		});

		$('#' + PopupMenuId).click(function (e) {
			e.stopPropagation();
			return false;
		});
		this.el = el;
	}

	ContextMenu.prototype.showAt = function (x, y) {
		this.el.style.left = x + 'px';
		this.el.style.top = y + 'px';
		document.body.appendChild(this.el);
	};

	function isObject(obj) {
		return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
	}

	function NonModalDialog(config) {
		NonModalDialog.super.call(this, config);
	}
	OO.inheritClass(NonModalDialog, OO.ui.Dialog);

	// NonModalDialog.static.name = 'myDialogNonModal';
	NonModalDialog.prototype.initialize = function () {
		const dialog = this;

		NonModalDialog.super.prototype.initialize.apply(this, arguments);
		this.content = new OO.ui.PanelLayout({ padded: true, expanded: false });

		this.content.$element.append(
			'<p>' + mw.msg('knowledgegraph-credits') + '</p>'
		);
		this.content.$element.append(mw.msg('knowledgegraph-credits-list'));
		this.content.$element.append('<p></p><br />');
		const closeButton = new OO.ui.ButtonWidget({
			label: OO.ui.msg('ooui-dialog-process-dismiss'),
		});
		closeButton.on('click', function () {
			dialog.close();
		});

		this.content.$element.append(closeButton.$element);
		this.$body.append(this.content.$element);
	};
	NonModalDialog.prototype.getBodyHeight = function () {
		return this.content.$element.outerHeight(true);
	};

	function createActionToolbar() {
		// see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/refs/tags/v0.40.4/demos/pages/toolbars.js
		var toolFactory = new OO.ui.ToolFactory();
		var toolGroupFactory = new OO.ui.ToolGroupFactory();

		var toolbar = new OO.ui.Toolbar(toolFactory, toolGroupFactory, {
			actions: false,
		});

		var onSelect = function () {
			var toolName = this.getName();

			switch (toolName) {
				case 'help-button':
					window.open(HelpUrl, '_blank').focus();
					break;
				case 'info-button':
					try {
						WindowManagerNonModal.destroy();
					} catch (exceptionVar) {}

					WindowManagerNonModal = new OO.ui.WindowManager({
						modal: false,
						classes: ['OOUI-dialogs-non-modal'],
					});

					$(document.body).append(WindowManagerNonModal.$element);

					// @see https://www.mediawiki.org/wiki/OOUI/Windows/Process_Dialogs
					var myDialog = new NonModalDialog({
						size: 'medium',
					});

					// WindowManagerNonModal.addWindows([myDialog]);
					// WindowManagerNonModal.openWindow(myDialog, {});

					var windows = {
						[DialogCredits]: new NonModalDialog({
							size: 'medium',
						}),
					};

					WindowManagerNonModal.addWindows(windows);
					WindowManagerNonModal.openWindow(DialogCredits, {});

					break;
			}
			this.setActive(false);
		};

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

	function HideNodesRec(nodeId) {
		var children = Network.getConnectedNodes(nodeId);
		// children = children.filter((x) => excludedIds.indexOf(x) === -1);
		console.log('children', children);
		var updateNodes = [];
		for (var nodeId_ of children) {
			if (!(nodeId_ in Data)) {
				updateNodes.push({
					id: nodeId_,
					hidden: !Nodes.get(nodeId_).hidden,
				});
			}
		}
		Nodes.update(updateNodes);
	}

	function initialize(container, containerToolbar, containerOptions, config) {
		// console.log('config', config);

		InitialData = JSON.parse(JSON.stringify(config.data));
		Config = config;
		Container = container;
		ContainerOptions = containerOptions;

		// $(container).width(config.width);
		// $(container).height(config.width);

		if (config['show-toolbar']) {
			var toolbar = createToolbar();
			// toolbar.$element.insertBefore(container);
			var actionToolbar = createActionToolbar();
			toolbar.$actions.append(actionToolbar.$element);
			toolbar.$element.appendTo(containerToolbar);
			$(ContainerOptions).toggle(false);
		}

		Data = {};
		Nodes = new vis.DataSet([]);
		Edges = new vis.DataSet([]);

		Network = new vis.Network(
			Container,
			{ nodes: Nodes, edges: Edges },
			Config.graphOptions
		);

		if (config['show-toolbar']) {
			Config.graphOptions.configure.enabled = false;

			var messageWidget = new OO.ui.MessageWidget({
				type: 'info',
				label: new OO.ui.HtmlSnippet(
					mw.msg(
						'knowledgegraph-graph-options-message',
						mw.config
							.get('wgArticlePath')
							.replace('$1', 'MediaWiki:KnowledgeGraphOptions')
					)
				),
				invisibleLabel: false,
				// classes:
			});

			$(containerOptions)
				.find('.vis-configuration.vis-config-option-container')
				.prepend(messageWidget.$element);
		}

		if (Config['properties-panel']) {
			LegendDiv = document.createElement('div');

			LegendDiv.style.position = 'relative';
			LegendDiv.id = 'legendContainer';
			// var legendColors = {};
			container.parentElement.append(LegendDiv);
			// *** attention!! this generates absolute values
			// when used in conjunction with Chameleon !!
			// $(LegendDiv).width(Config.width);
			// $(LegendDiv).height(Config.height);
			LegendDiv.style.width = Config.width;
			LegendDiv.style.height = Config.height;
		}

		createNodes(Config.data);

		Network.on('oncontext', function (params) {
			params.event.preventDefault();

			var nodeId = params.nodes[0];
			//  && nodeId in Data
			if (nodeId !== undefined) {
				// console.log('params', params);

				var menuObj = {
					items: [
						{
							label: mw.msg('knowledgegraph-menu-open-article'),
							icon: 'link',
							onClick: function () {
								var hashIndex = nodeId.indexOf('#');
								var url = mw.config
									.get('wgArticlePath')
									.replace(
										'$1',
										hashIndex !== -1 ? nodeId.substring(0, hashIndex) : nodeId
									);
								window.open(url, '_blank').focus();
							},
						},
					],
					className: 'KnowledgeGraphPopupMenu',
				};

				if (Config['show-toolbar'] === true) {
					menuObj.items.push({
						label: mw.msg('knowledgegraph-menu-delete-node'),
						icon: 'trash',
						onClick: function () {
							if (confirm(mw.msg('knowledgegraph-delete-node-confirm'))) {
								deleteNode(nodeId);
							}
						},
					});
				}

				PopupMenu = new ContextMenu(menuObj);
				PopupMenu.showAt(params.event.pageX, params.event.pageY);
			}
		});

		Network.on('click', function (params) {
			if (!params.nodes.length) {
				return;
			}

			if (SelectedNode !== params.nodes[0]) {
				SelectedNode = params.nodes[0];
				return;
			}

			// var excludedIds = [params.nodes[0]];

			HideNodesRec(params.nodes[0]);
		});

		Network.on('doubleClick', function (params) {
			if (!params.nodes.length) {
				return;
			}
			var nodeId = params.nodes[0];

			if (!(nodeId in Data) || Data[nodeId] === null) {
				loadNodes({
					title: params.nodes[0],
					depth: parseInt(Config.depth),
				}).then(function (data) {
					// console.log('data', data);
					createNodes(data);
					Nodes.update([
						{
							id: nodeId,
							opacity: 1,
							shapeProperties: {
								borderDashes: false,
							},
						},
					]);
				});
			}
		});
	}

	function openDialog(nodeId) {
		Properties = {};
		TmpData = {};

		// Create and append a window manager.
		var windowManager = new OO.ui.WindowManager();
		$(document.body).append(windowManager.$element);

		// @see https://www.mediawiki.org/wiki/OOUI/Windows/Process_Dialogs
		var myDialog = new MyDialog({
			size: 'medium',
		});

		windowManager.addWindows([myDialog]);
		windowManager.openWindow(myDialog, { nodeId, title: nodeId });
	}

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
			.next(function () {
				if (data && data.nodeId) {
					SelectedNode = data.nodeId;
					var mode = 'edit';
					this.initializeResultsPanel(mode);
					this.actions.setMode(mode);
				} else {
					this.actions.setMode('select');
				}
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

		if (mode === 'no-results') {
			var msg = mw.msg(
				selectedTab === 'by-article'
					? 'knowledgegraph-dialog-results-no-properties'
					: 'knowledgegraph-dialog-results-no-articles'
			);

			$el = $('<span>' + msg + '</span>');
		} else if (mode === 'existing-node') {
			$el = $(
				'<span>' +
					mw.msg('knowledgegraph-dialog-results-existing-node') +
					'</span>'
			);
		} else {
			$el = $('<ul>');
			switch (selectedTab) {
				case 'by-article':
					this.panelB.$element.append(
						'<h3>' +
							mw.msg('knowledgegraph-dialog-results-has-properties') +
							'</h3>'
					);
					var properties = data[titleFullText].properties;
					for (var i in properties) {
						var url = mw.config.get('wgArticlePath').replace('$1', i);

						$el.append(
							$(
								'<li><a target="_blank" href="' +
									url +
									'">' +
									(properties[i].preferredLabel !== ''
										? properties[i].preferredLabel
										: properties[i].canonicalLabel) +
									'</a> (' +
									properties[i].typeLabel +
									')' +
									'</li>'
							)
						);
					}
					break;

				case 'by-properties':
				case 'by-categories':
					// mw.msg
					this.panelB.$element.append(
						'<h3>' +
							mw.msg('knowledgegraph-dialog-results-importing-nodes') +
							'</h3>'
					);
					// @TODO display a message if all nodes exist

					for (var i in data) {
						if (!(i in Data) && data[i] !== null) {
							var url = mw.config.get('wgArticlePath').replace('$1', i);

							$el.append(
								$(
									'<li><a target="_blank" href="' +
										url +
										'">' +
										i +
										'</a> </li>'
								)
							);
						}
					}
			}
		}
		this.panelB.$element.append($el);
		var panel = this.stackLayout.getItems()[1];
		this.stackLayout.setItem(panel);
	};

	// Specify processes to handle the actions.
	MyDialog.prototype.getActionProcess = function (action) {
		var selfDialog = this;
		switch (action) {
			case 'delete':
				if (confirm(mw.msg('knowledgegraph-delete-node-confirm'))) {
					deleteNode(SelectedNode);
					return new OO.ui.Process(function () {
						selfDialog.close({ action: action });
					});
				}
				break;
			case 'done':
				return new OO.ui.Process(function () {
					selfDialog.close({ action: action }).then(function () {
						// createNodes(TmpData);
					});
					createNodes(TmpData);
					TmpData = {};
				});
			case 'continue':
				return MyDialog.super.prototype.getActionProcess
					.call(this, action)
					.next(function () {
						return new Promise((resolve, reject) => {
							var selectedTab = selfDialog.indexLayout.getCurrentTabPanelName();
							var titleValue = null;
							var properties = null;
							var categories = null;
							var depth, limit, offset;

							switch (selectedTab) {
								case 'by-article':
									titleValue = selfDialog.titleInputWidget.getValue();

									if (titleValue === '') {
										resolve();
										return;
									}
									var titleFullText = selfDialog.titleInputWidget
										.getMWTitle()
										.getPrefixedText();

									if (titleFullText in Data) {
										selfDialog.actions.setMode('existing-node');
										selfDialog.initializeResultsPanel('existing-node');
										resolve();
										return;
									}
									depth = selfDialog.depthInputWidget.getValue();
									break;

								case 'by-properties':
									properties = selfDialog.propertiesInputWidget.getValue();

									if (!properties.length) {
										resolve();
										return;
									}
									depth = selfDialog.depthInputWidgetProperties.getValue();
									limit = selfDialog.limitInputWidgetProperties.getValue();
									offset = selfDialog.offsetInputWidgetProperties.getValue();
									break;

								case 'by-categories':
									categories = selfDialog.categoriesInputWidget.getValue();

									if (!categories.length) {
										resolve();
										return;
									}
									depth = selfDialog.depthInputWidgetCategories.getValue();
									limit = selfDialog.limitInputWidgetCategories.getValue();
									offset = selfDialog.offsetInputWidgetCategories.getValue();
									break;

								// console.log('properties', properties);
							}

							loadNodes({
								title: titleValue,
								properties,
								categories,
								depth: parseInt(depth),
								limit: parseInt(limit),
								offset: parseInt(offset),
							})
								.then(function (data) {
									// console.log('data', data);
									// Properties = data[titleFullText];
									TmpData = data;
									if (selectedTab === 'by-article') {
										var properties = data[titleFullText];
										var mode = Object.keys(properties).length
											? 'show-results'
											: 'no-results';
									} else {
										var mode = Object.keys(data).length
											? 'show-results'
											: 'no-results';
									}
									selfDialog.initializeResultsPanel(
										mode,
										selectedTab,
										data,
										selectedTab === 'by-article' ? titleFullText : null
									);
									selfDialog.actions.setMode(mode);
									resolve();
								})
								.catch((err) => {
									console.log('err loadNodes', err);
								});
						});
					});
				break;

			case 'back':
				this.stackLayout.setItem(this.stackLayout.getItems()[0]);
				this.actions.setMode('select');
				break;
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

	function createToolbar() {
		var toolFactory = new OO.ui.ToolFactory();
		var toolGroupFactory = new OO.ui.ToolGroupFactory();

		var toolbar = new OO.ui.Toolbar(toolFactory, toolGroupFactory, {
			actions: true,
		});

		var onSelect = function () {
			var toolName = this.getName();

			switch (toolName) {
				case 'add-node':
					openDialog(null);
					break;

				case 'export-graph':
					// console.log('Data', Data);
					var nodes = [];
					var properties = [];
					var propertyOptions = '';
					for (var i in Data) {
						if (nodes.indexOf(i) === -1) {
							nodes.push(i);
						}
						if (Data[i] === null) {
							continue;
						}
						for (var ii in Data[i].properties) {
							var property = Data[i].properties[ii];
							if (properties.indexOf(property.canonicalLabel) === -1) {
								properties.push(property.canonicalLabel);
								propertyOptions += `|property-options?${property.canonicalLabel}=\n`;
							}
						}
					}

					var text = `{{#knowledgegraph:
nodes=${nodes.join(', ')}
|properties=${properties.join(', ')}
|depth=0
|graph-options=
${propertyOptions}|show-property-type=true
|width=400px
|height=400px
|properties-panel=false
|categories-panel=false
}}`;
					if ( navigator.clipboard ) {
						navigator.clipboard.writeText(text).then(function () {
							alert(mw.msg('knowledgegraph-copied-to-clipboard'));
						});
					} else {
						alert( 'clipboard not available');
					}

					break;

				case 'show-config':
					Config.graphOptions.configure.enabled =
						!Config.graphOptions.configure.enabled;
					$(ContainerOptions).toggle(Config.graphOptions.configure.enabled);
					break;

				case 'reload':
					if (confirm(mw.msg('knowledgegraph-toolbar-reset-network-confirm'))) {
						Data = {};
						Nodes = new vis.DataSet([]);
						Edges = new vis.DataSet([]);

						Network.setData({ nodes: Nodes, edges: Edges });

						createNodes(InitialData);

						// Network.destroy();
						// initializeNetwork(InitialData);
					}
			}

			this.setActive(false);
		};

		var toolGroup = [
			{
				name: 'add-node',
				icon: 'add',
				title: mw.msg('knowledgegraph-toolbar-add-node'),
				onSelect: onSelect,
			},
			{
				name: 'show-config',
				icon: 'settings',
				title: mw.msg('knowledgegraph-toolbar-toggle-config'),
				onSelect: onSelect,
			},
			{
				name: 'export-graph',
				icon: 'eye',
				title: mw.msg('knowledgegraph-toolbar-export-graph'),
				onSelect: onSelect,
			},
		];

		// if (Config.context === 'parserfunction') {
		if (true) {
			toolGroup.splice(2, 0, {
				name: 'reload',
				icon: 'reload',
				title: mw.msg('knowledgegraph-toolbar-reset-network'),
				onSelect: onSelect,
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

	function getNestedProp(path, obj) {
		return path.reduce((xs, x) => (xs && xs[x] ? xs[x] : null), obj);
	}

	function createTool(obj, config) {
		var Tool = function () {
			// Tool.super.apply( this, arguments );
			Tool.super.call(this, arguments[0], config);

			OO.ui.mixin.PendingElement.call(this, {});

			if (getNestedProp(['data', 'disabled'], config)) {
				// this.setPendingElement(this.$element)
				// this.pushPending();
				this.setDisabled(true);
			}

			if (getNestedProp(['data', 'pending'], config)) {
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

	function getDefaultOptions() {
		var options = {
			autoResize: true,
			height: '100%',
			width: '100%',
			locale: 'en',
			// locales: locales,
			clickToUse: false,
			configure: {
				enabled: true,
				filter: 'nodes,edges',
				// container: undefined,
				showButton: true,
			},
			edges: {
				arrows: {
					to: {
						enabled: false,
						// imageHeight: undefined,
						// imageWidth: undefined,
						scaleFactor: 1,
						// src: undefined,
						type: 'arrow',
					},
					middle: {
						enabled: false,
						imageHeight: 32,
						imageWidth: 32,
						scaleFactor: 1,
						src: 'https://visjs.org/images/visjs_logo.png',
						type: 'image',
					},
					from: {
						enabled: false,
						// imageHeight: undefined,
						// imageWidth: undefined,
						scaleFactor: 1,
						// src: undefined,
						type: 'arrow',
					},
				},
				endPointOffset: {
					from: 0,
					to: 0,
				},
				arrowStrikethrough: true,
				chosen: true,
				color: {
					color: '#848484',
					highlight: '#848484',
					hover: '#848484',
					inherit: 'from',
					opacity: 1.0,
				},
				dashes: false,
				font: {
					color: '#343434',
					size: 14, // px
					face: 'arial',
					background: 'none',
					strokeWidth: 2, // px
					strokeColor: '#ffffff',
					align: 'horizontal',
					multi: false,
					vadjust: 0,
					bold: {
						color: '#343434',
						size: 14, // px
						face: 'arial',
						vadjust: 0,
						mod: 'bold',
					},
					ital: {
						color: '#343434',
						size: 14, // px
						face: 'arial',
						vadjust: 0,
						mod: 'italic',
					},
					boldital: {
						color: '#343434',
						size: 14, // px
						face: 'arial',
						vadjust: 0,
						mod: 'bold italic',
					},
					mono: {
						color: '#343434',
						size: 15, // px
						face: 'courier new',
						vadjust: 2,
						mod: '',
					},
				},
				hidden: false,
				hoverWidth: 1.5,
				label: undefined,
				labelHighlightBold: true,
				length: undefined,
				physics: true,
				scaling: {
					min: 1,
					max: 15,
					label: {
						enabled: true,
						min: 14,
						max: 30,
						maxVisible: 30,
						drawThreshold: 5,
					},
					customScalingFunction: function (min, max, total, value) {
						if (max === min) {
							return 0.5;
						} else {
							var scale = 1 / (max - min);
							return Math.max(0, (value - min) * scale);
						}
					},
				},
				selectionWidth: 1,
				selfReferenceSize: 20,
				selfReference: {
					size: 20,
					angle: Math.PI / 4,
					renderBehindTheNode: true,
				},
				shadow: {
					enabled: false,
					color: 'rgba(0,0,0,0.5)',
					size: 10,
					x: 5,
					y: 5,
				},
				smooth: {
					enabled: true,
					type: 'dynamic',
					roundness: 0.5,
				},
				title: undefined,
				value: undefined,
				width: 1,
				widthConstraint: false,
			},

			nodes: {
				borderWidth: 1,
				borderWidthSelected: 2,
				brokenImage: undefined,
				chosen: true,
				color: {
					border: '#2B7CE9',
					background: '#97C2FC',
					highlight: {
						border: '#2B7CE9',
						background: '#D2E5FF',
					},
					hover: {
						border: '#2B7CE9',
						background: '#D2E5FF',
					},
				},
				opacity: 1,
				fixed: {
					x: false,
					y: false,
				},
				font: {
					color: '#343434',
					size: 14, // px
					face: 'arial',
					background: 'none',
					strokeWidth: 0, // px
					strokeColor: '#ffffff',
					align: 'center',
					multi: false,
					vadjust: 0,
					bold: {
						color: '#343434',
						size: 14, // px
						face: 'arial',
						vadjust: 0,
						mod: 'bold',
					},
					ital: {
						color: '#343434',
						size: 14, // px
						face: 'arial',
						vadjust: 0,
						mod: 'italic',
					},
					boldital: {
						color: '#343434',
						size: 14, // px
						face: 'arial',
						vadjust: 0,
						mod: 'bold italic',
					},
					mono: {
						color: '#343434',
						size: 15, // px
						face: 'courier new',
						vadjust: 2,
						mod: '',
					},
				},
				group: undefined,
				heightConstraint: false,
				hidden: false,
				icon: {
					face: 'FontAwesome',
					// code: undefined,
					// weight: undefined,
					size: 50, //50,
					color: '#2B7CE9',
				},
				// image: undefined,
				imagePadding: {
					left: 0,
					top: 0,
					bottom: 0,
					right: 0,
				},
				label: undefined,
				labelHighlightBold: true,
				level: undefined,
				mass: 1,
				physics: true,
				scaling: {
					min: 10,
					max: 30,
					label: {
						enabled: false,
						min: 14,
						max: 30,
						maxVisible: 30,
						drawThreshold: 5,
					},
					customScalingFunction: function (min, max, total, value) {
						if (max === min) {
							return 0.5;
						} else {
							var scale = 1 / (max - min);
							return Math.max(0, (value - min) * scale);
						}
					},
				},
				shadow: {
					enabled: false,
					color: 'rgba(0,0,0,0.5)',
					size: 10,
					x: 5,
					y: 5,
				},
				shape: 'ellipse',
				shapeProperties: {
					borderDashes: false, // only for borders
					borderRadius: 6, // only for box shape
					interpolation: false, // only for image and circularImage shapes
					useImageSize: false, // only for image and circularImage shapes
					useBorderWithImage: false, // only for image shape
					coordinateOrigin: 'center', // only for image and circularImage shapes
				},
				size: 25,
				title: undefined,
				value: undefined,
				widthConstraint: false,
				// x: undefined,
				// y: undefined,
			},
			groups: {
				useDefaultGroups: true,
				myGroupId: {
					/*node options*/
				},
			},
			layout: {
				randomSeed: undefined,
				improvedLayout: true,
				clusterThreshold: 150,
				hierarchical: {
					enabled: false,
					levelSeparation: 150,
					nodeSpacing: 100,
					treeSpacing: 200,
					blockShifting: true,
					edgeMinimization: true,
					parentCentralization: true,
					direction: 'UD', // UD, DU, LR, RL
					sortMethod: 'hubsize', // hubsize, directed
					shakeTowards: 'leaves', // roots, leaves
				},
			},
			interaction: {
				dragNodes: true,
				dragView: true,
				hideEdgesOnDrag: false,
				hideEdgesOnZoom: false,
				hideNodesOnDrag: false,
				hover: false,
				hoverConnectedEdges: true,
				keyboard: {
					enabled: false,
					speed: { x: 10, y: 10, zoom: 0.02 },
					bindToWindow: true,
					autoFocus: true,
				},
				multiselect: false,
				navigationButtons: false,
				selectable: true,
				selectConnectedEdges: true,
				tooltipDelay: 300,
				zoomSpeed: 1,
				zoomView: true,
			},
			manipulation: {
				enabled: false,
				initiallyActive: false,
				addNode: true,
				addEdge: true,
				// editNode: undefined,
				editEdge: true,
				deleteNode: true,
				deleteEdge: true,
				controlNodeStyle: {
					// all node options are valid.
				},
			},
			physics: {
				enabled: true,
				barnesHut: {
					theta: 0.5,
					gravitationalConstant: -2000,
					centralGravity: 0.3,
					springLength: 95,
					springConstant: 0.04,
					damping: 0.09,
					avoidOverlap: 0,
				},
				forceAtlas2Based: {
					theta: 0.5,
					gravitationalConstant: -50,
					centralGravity: 0.01,
					springConstant: 0.08,
					springLength: 100,
					damping: 0.4,
					avoidOverlap: 0,
				},
				repulsion: {
					centralGravity: 0.2,
					springLength: 200,
					springConstant: 0.05,
					nodeDistance: 100,
					damping: 0.09,
				},
				hierarchicalRepulsion: {
					centralGravity: 0.0,
					springLength: 100,
					springConstant: 0.01,
					nodeDistance: 120,
					damping: 0.09,
					avoidOverlap: 0,
				},
				maxVelocity: 50,
				minVelocity: 0.1,
				solver: 'barnesHut',
				stabilization: {
					enabled: true,
					iterations: 1000,
					updateInterval: 100,
					onlyDynamicEdges: false,
					fit: true,
				},
				timestep: 0.5,
				adaptiveTimestep: true,
				wind: { x: 0, y: 0 },
			},
		};
		return options;
	}

	function uuidv4() {
		return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
			(
				c ^
				(crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
			).toString(16)
		);
	}

	function randomHSL() {
		var golden = 0.618033988749895;
		var h = Math.random() + golden;
		h %= 1;
		return 'hsla(' + 360 * h + ',' + '70%,' + '80%,1)';
	}

	return {
		initialize,
		getDefaultOptions,
	};
};

$(document).ready(async function () {
	var semanticGraphs = JSON.parse(mw.config.get('knowledgegraphs'));

	// console.log('semanticGraphs', semanticGraphs);

	async function getModule(str) {
		var module = await import(`data:text/javascript;base64,${btoa(str)}`);
		if ('default' in module) {
			return module.default;
		}
		return null;
	}

	$('.KnowledgeGraph').each(async function (index) {
		var graphData = semanticGraphs[index];

		var graph = new KnowledgeGraph();

		if (graphData.graphOptions && Object.keys(graphData.graphOptions).length) {
			var result = await getModule(graphData.graphOptions);
			if (result) {
				graphData.graphOptions = result;
			}
		}

		if (
			graphData.propertyOptions &&
			Object.keys(graphData.propertyOptions).length
		) {
			for (var i in graphData.propertyOptions) {
				var result = await getModule(graphData.propertyOptions[i]);
				if (result) {
					graphData.propertyOptions[i] = result;
				}
			}
		}

		graphData.graphOptions = $.extend(
			new KnowledgeGraph().getDefaultOptions(),
			graphData.graphOptions
		);

		var config = $.extend(
			true,
			{
				data: {},
				// graphOptions: new KnowledgeGraph().getDefaultOptions(),
				propertyOptions: {},
				properties: [],
				// 'nodes-by-properties': {},
				depth: '',
				width: '',
				height: '',
				'show-toolbar': false,
				'show-property-type': false,
				context: 'parserfunction',
			},
			graphData
		);

		if (config.width !== '') {
			config.graphOptions.width = config.width;
		}
		if (config.height !== '') {
			config.graphOptions.height = config.height;
		}

		var container = this;
		var containerToolbar = null;
		var containerOptions = null;

		if (config['show-toolbar']) {
			config.graphOptions.configure.enabled = true;
			if (config.graphOptions.configure.container) {
				containerOptions = config.graphOptions.configure.container;
				containerToolbar = document.createElement('div');
				containerToolbar.insertBefore(container);
			} else {
				var $container = $(this).clone();

				// *** unfortunately we cannot use the
				// following, since colspan does not work
				$table = $(
					`<div class="KnowledgeGraphTable" style="display:table;height:` +
						config.height +
						`;width:` +
						config.width +
						`">
	<div style="display:table-row">
		<div colspan="2" style="display:table-cell;width:100%" class="KnowledgeGraph-toolbar"></div>
	</div>
	<div style="display:table-row">
		<div class="KnowledgeGraph-network" style="display:table-cell;width:50%;vertical-align:top"></div>
		<div class="KnowledgeGraph-options" style="display:table-cell;width:50%"><div style="width:auto;height:` +
						config.height +
						`;overflow:scroll"></div></div>
	</div>
</div>`
				);

				$table = $(
					`<table class="KnowledgeGraphTable" style="height:` +
						config.height +
						`;width:` +
						config.width +
						`">
	<tr>
		<td colspan="2" class="KnowledgeGraph-toolbar"></td>
	</tr>
	<tr>
		<td class="KnowledgeGraph-network" style="width:50%;vertical-align:top"></td>
		<td class="KnowledgeGraph-options" style="width:50%"><div style="width:auto;height:` +
						config.height +
						`;overflow:scroll"></div></td>
	</tr>
</table>`
				);

				$table.find('.KnowledgeGraph-network').append($container);
				config.graphOptions.configure.container = $table
					.find('.KnowledgeGraph-options > div')
					.get(0);

				$(this).replaceWith($table);

				// network container
				container = $container.get(0);
				containerToolbar = $table.find('.KnowledgeGraph-toolbar').get(0);
				containerOptions = $table.find('.KnowledgeGraph-options').get(0);
			}
		} else {
			config.graphOptions.configure.enabled = false;
			// *** attention!! this generates absolute values
			// when used in conjunction with Chameleon !!
			// $(container).width(config.width);
			// $(container).height(config.height);
			container.style.width = config.width;
			container.style.height = config.height;
		}

		console.log('config', config);
		graph.initialize(container, containerToolbar, containerOptions, config);
	});
});

