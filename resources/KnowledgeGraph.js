/**
 * KnowledgeGraph
 *
 * @licence GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 * @see https://github.com/OpenSemanticLab/mediawiki-extensions-InteractiveSemanticGraph
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

	// *** currently not used
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
						for (var j in PropColors) {
							if (PropColors[j] === color_) {
								return true;
							}
						}
						return false;
					}
					do {
						color_ = KnowledgeGraphFunctions.randomHSL();
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

				if (!(legendLabel in PropIdPropLabelMap)) {
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
						var valueId = `${i}#${KnowledgeGraphFunctions.uuidv4()}`;

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

	function HideNodesRec(nodeId) {
		var children = Network.getConnectedNodes(nodeId);
		// children = children.filter((x) => excludedIds.indexOf(x) === -1);
		// console.log('children', children);
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

	function getDialogActionProcessCallback(thisDialog, getActionProcess, action) {
		switch (action) {
			case 'delete':
				if (confirm(mw.msg('knowledgegraph-delete-node-confirm'))) {
					deleteNode(SelectedNode);
					return new OO.ui.Process(function () {
						thisDialog.close({ action: action });
					});
				}
				break;
			case 'done':
				return new OO.ui.Process(function () {
					thisDialog.close({ action: action }).then(function () {
						// createNodes(TmpData);
					});
					createNodes(TmpData);
					TmpData = {};
				});
			case 'continue':
				return getActionProcess
					.call(thisDialog, action)
					.next(function () {
						return new Promise((resolve, reject) => {
							var selectedTab = thisDialog.indexLayout.getCurrentTabPanelName();
							var titleValue = null;
							var properties = null;
							var categories = null;
							var depth, limit, offset;

							switch (selectedTab) {
								case 'by-article':
									titleValue = thisDialog.titleInputWidget.getValue();

									if (titleValue === '') {
										resolve();
										return;
									}
									var titleFullText = thisDialog.titleInputWidget
										.getMWTitle()
										.getPrefixedText();

									if (titleFullText in Data) {
										thisDialog.actions.setMode('existing-node');
										thisDialog.initializeResultsPanel('existing-node');
										resolve();
										return;
									}
									depth = thisDialog.depthInputWidget.getValue();
									break;

								case 'by-properties':
									properties = thisDialog.propertiesInputWidget.getValue();

									if (!properties.length) {
										resolve();
										return;
									}
									depth = thisDialog.depthInputWidgetProperties.getValue();
									limit = thisDialog.limitInputWidgetProperties.getValue();
									offset = thisDialog.offsetInputWidgetProperties.getValue();
									break;

								case 'by-categories':
									categories = thisDialog.categoriesInputWidget.getValue();

									if (!categories.length) {
										resolve();
										return;
									}
									depth = thisDialog.depthInputWidgetCategories.getValue();
									limit = thisDialog.limitInputWidgetCategories.getValue();
									offset = thisDialog.offsetInputWidgetCategories.getValue();
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
									thisDialog.initializeResultsPanel(
										mode,
										selectedTab,
										data,
										selectedTab === 'by-article' ? titleFullText : null
									);
									thisDialog.actions.setMode(mode);
									resolve();
								})
								.catch((err) => {
									console.log('err loadNodes', err);
								});
						});
					});
				break;

			case 'back':
				thisDialog.stackLayout.setItem(thisDialog.stackLayout.getItems()[0]);
				thisDialog.actions.setMode('select');
				break;
		}
	}

	function getDialogOnSetupCallback(thisDialog, data) {
		var self = thisDialog;
		if (data && data.nodeId) {
			SelectedNode = data.nodeId;
			var mode = 'edit';
			self.initializeResultsPanel(mode);
			self.actions.setMode(mode);
		} else {
			self.actions.setMode('select');
		}
	}

	function getDialogInitializeResultsPanel(
		thisDialog,
		mode,
		selectedTab,
		data,
		titleFullText
	) {
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
					thisDialog.panelB.$element.append(
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
					thisDialog.panelB.$element.append(
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

		return $el;
	}

	function openDialog(nodeId) {
		Properties = {};
		TmpData = {};

		// Create and append a window manager.
		var windowManager = new OO.ui.WindowManager();
		$(document.body).append(windowManager.$element);

		// @see https://www.mediawiki.org/wiki/OOUI/Windows/Process_Dialogs
		var myDialog = KnowledgeGraphDialog.create(
			Config,
			{
				size: 'medium',
			},
			getDialogActionProcessCallback,
			getDialogOnSetupCallback,
			getDialogInitializeResultsPanel
		);

		windowManager.addWindows([myDialog]);
		windowManager.openWindow(myDialog, { nodeId, title: nodeId });
	}

	function getOnSelectToolbar() {
		var self = this;

		var toolName = self.getName();

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
				if (navigator.clipboard) {
					navigator.clipboard.writeText(text).then(function () {
						alert(mw.msg('knowledgegraph-copied-to-clipboard'));
					});
				} else {
					alert('clipboard not available');
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

		self.setActive(false);
	}

	function getOnSelectActionToolbar() {
		var self = this;
		var toolName = self.getName();

		switch (toolName) {
			case 'help-button':
				window.open(HelpUrl, '_blank').focus();
				break;
			case 'info-button':

				if ( WindowManagerNonModal ) {
					WindowManagerNonModal.getWindow(DialogCredits).then( function( dialog ) {
						if ( dialog.isOpened() ) {
							dialog.close();
						} else {
							dialog.open();
						}
						return;
					});
					return;
				}

				WindowManagerNonModal = new OO.ui.WindowManager({
					modal: false,
					classes: ['OOUI-dialogs-non-modal'],
				});

				$(document.body).append(WindowManagerNonModal.$element);

				// @see https://www.mediawiki.org/wiki/OOUI/Windows/Process_Dialogs
				// var myDialog = new NonModalDialog({
				// 	size: 'medium',
				// });

				// WindowManagerNonModal.addWindows([myDialog]);
				// WindowManagerNonModal.openWindow(myDialog, {});
				var windows = {
					[DialogCredits]: KnowledgeGraphNonModalDialog.create({
						size: 'medium',
					}),
				};

				WindowManagerNonModal.addWindows(windows);
				WindowManagerNonModal.openWindow(DialogCredits, {});

				break;
		}
		self.setActive(false);
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
			var toolbar = KnowledgeGraphToolbar.create(getOnSelectToolbar);
			// toolbar.$element.insertBefore(container);

			var actionToolbar = KnowledgeGraphActionToolbar.create(
				getOnSelectActionToolbar
			);
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

	return {
		initialize,
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
			KnowledgeGraphOptions.getDefaultOptions(),
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

		// console.log('config', config);
		graph.initialize(container, containerToolbar, containerOptions, config);
	});
});
