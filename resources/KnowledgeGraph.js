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
	var nodePropertiesCache = {};

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
		if (obj.title !== null && obj.properties === null) {
			var payload = {
				action: 'knowledgegraph-load-nodes',
				titles: obj.title,
				depth: obj.depth,
				properties: JSON.stringify(Config['properties']),
			};
		} else if (obj.properties !== null) {
			if (obj.properties === undefined) {
				obj.properties = [];
			}
			var payload = {
				action: 'knowledgegraph-load-properties',
				properties: obj.properties.join('|'),
				nodes: titles,
				depth: obj.depth,
				limit: obj.limit,
				offset: obj.offset,
				inversePropsIncluded: inversePropsIncluded
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

		return new Promise((resolve, reject) => {
			mw.loader.using('mediawiki.api', function () {
				new mw.Api()
					.postWithToken('csrf', payload)
					.done(function (thisRes) {
						if ('data' in thisRes[payload.action]) {
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

	function addArticleNode(data, label, options, typeID) {
		if (Nodes.get(label) !== null) {
			return;
		}

		let cleanLabel = label.split('#')[0];

		var nodeConfig = jQuery.extend(
			JSON.parse(JSON.stringify(Config.graphOptions.nodes)),
			label in Config.propertyOptions ? Config.propertyOptions[label] : {},
			{
				id: label,
				label:
					cleanLabel.length <= maxPropValueLength
						? cleanLabel
						: cleanLabel.substring(0, maxPropValueLength) + '…',
				shape: 'box',
				font: jQuery.extend(
					{},
					Config.graphOptions.nodes.font,
					{ size: Config.graphOptions.nodes.font.size || 30 }
				),
				typeID: typeID || 9,

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

			for (var i in data[label].properties) {
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
							var targetLabel = property.values[ii].value;
							PropIdPropLabelMap[legendLabel].push(targetLabel);

							var from = property.inverse ? targetLabel : label;
							var to = property.inverse ? label : targetLabel;

							let edgeId = KnowledgeGraphFunctions.makeEdgeId(from, to, property.canonicalLabel, 9, Nodes);

							var edgeConfig = jQuery.extend(
								JSON.parse(JSON.stringify(Config.graphOptions.edges)),
								{
									id: edgeId,
									from: from,
									to: to,
									label: propLabel,
									group: label,
									arrows: {
										to: { enabled: true }
									}
								}
							);

							// Edges.add(edgeConfig);
							graphModel.addEdge(edgeConfig);

							if (
								property.values[ii].src &&
								mw.config.get('KnowledgeGraphShowImages') === true
							) {
								options.shape = 'image';
								options.image = property.values[ii].src;
							}

							addArticleNode(data, targetLabel, options, 9);
						}
						break;

					default:
						const seen = new Set();
						for (const { value: targetLabel } of property.values) {
							if (seen.has(targetLabel)) continue;
							seen.add(targetLabel);

							const typeId = property.typeId === '_txt' ? 2 : property.typeId;
							const valueId = KnowledgeGraphFunctions.makeNodeId(targetLabel, typeId);
							const edgeLabel = property.canonicalLabel || propLabel;

							PropIdPropLabelMap[legendLabel].push(valueId);

							const edgeId = KnowledgeGraphFunctions.makeEdgeId(label, valueId, edgeLabel);
							Edges.add({
								id: edgeId,
								from: label,
								to: valueId,
								label: propLabel,
								group: label,
							});

							if (!Nodes.get(valueId)) {
								const displayLabel = targetLabel.length <= maxPropValueLength
									? targetLabel
									: targetLabel.substring(0, maxPropValueLength) + '…';

								Nodes.add(
									jQuery.extend({}, options, {
										id: valueId,
										label: displayLabel,
										typeID: typeId,
									})
								);
							}
						}
					}
				}
			}
		Data = jQuery.extend(Data, data);
	}

	function HideNodesRec(nodeId) {
		var children = Network.getConnectedNodes(nodeId);
		// children = children.filter((x) => excludedIds.indexOf(x) === -1);
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
									titles = thisDialog.titlesInputWidget.getValue();

									if (!titles.length || !properties.length) {
										resolve();
										return;
									}

									const existingTitles = [];
									const newTitles = [];

									for (let i = 0; i < titles.length; i++) {
										const titleObj = mw.Title.newFromText( titles[i] );
										if (!titleObj) continue;

										const fullTitle = titleObj.getPrefixedText();
										if (fullTitle in Data) {
											existingTitles.push( fullTitle );
										} else {
											newTitles.push( fullTitle );
										}
									}

									if (newTitles.length === 0) {
										thisDialog.actions.setMode('existing-node');
										thisDialog.initializeResultsPanel('existing-node');
										resolve();
										return;
									}
									thisDialog._titlesToProcess = newTitles;
									thisDialog._skippedTitles = existingTitles;
									depth = thisDialog.depthInputWidgetProperties.getValue();
									limit = thisDialog.limitInputWidgetProperties.getValue();
									offset = thisDialog.offsetInputWidgetProperties.getValue();
									inversePropsIncluded = thisDialog.includeInverseCheckbox.isSelected();
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
					// mw.msg
					if (Object.keys(data).some((i) => !(i in Data) && data[i] !== null)) {
						thisDialog.panelB.$element.append(
							'<h3>' + mw.msg('knowledgegraph-dialog-results-importing-nodes') + '</h3>'
						);

						var $newList = $('<ul>');
						for (var i in data) {
							if (!(i in Data) && data[i] !== null) {
								var url = mw.config.get('wgArticlePath').replace('$1', i);
								$newList.append(
									$(
										'<li><a target="_blank" href="' +
											url +
											'">' +
											i +
											'</a></li>'
									)
								);
							}
						}
						thisDialog.panelB.$element.append($newList);
					}

					if (
						thisDialog._skippedTitles &&
						thisDialog._skippedTitles.length > 0
					) {
						thisDialog.panelB.$element.append(
							'<h4>' + mw.msg('knowledgegraph-dialog-results-skipped-existing') + '</h4>'
						);

						var $skippedList = $('<ul>');
						thisDialog._skippedTitles.forEach(function (title) {
							var url = mw.config.get('wgArticlePath').replace('$1', title);
							$skippedList.append(
								$(
									'<li><a target="_blank" href="' +
										url +
										'">' +
										title +
										'</a></li>'
								)
							);
						});
						thisDialog.panelB.$element.append($skippedList);
					}
					break;

				case 'by-categories':
					// mw.msg
					thisDialog.panelB.$element.append(
						'<h3>' +
							mw.msg('knowledgegraph-dialog-results-importing-nodes') +
							'</h3>'
					);

					var $el = $('<ul>');
					var newNodesCount = 0;

					for (var i in data) {
						if (!(i in Data) && data[i] !== null) {
							var url = mw.config.get('wgArticlePath').replace('$1', i);

							$el.append(
								$(
									'<li><a target="_blank" href="' +
										url +
										'">' +
										i +
										'</a></li>'
								)
							);
							newNodesCount++;
						}
					}

					if (newNodesCount === 0) {
						thisDialog.panelB.$element.append(
							$('<p>' + mw.msg('knowledgegraph-dialog-results-no-new-nodes') + '</p>')
						);
					} else {
						thisDialog.panelB.$element.append($el);
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
			function legacyCopy(text) {
				const textarea = document.createElement('textarea');
				textarea.value = text;
				textarea.style.position = 'fixed';
				document.body.appendChild(textarea);
				textarea.focus();
				textarea.select();
				try {
					document.execCommand('copy');
					alert(mw.msg('knowledgegraph-copied-to-clipboard'));
				} catch (err) {
					alert('Copy failed');
				}
				document.body.removeChild(textarea);
			}

			if (navigator.clipboard) {
				navigator.clipboard.writeText(text).then(function () {
					alert(mw.msg('knowledgegraph-copied-to-clipboard'));
				}).catch(() => legacyCopy(text));
			} else {
				legacyCopy(text);
			}
			break;

			case 'show-config':
				Config.graphOptions.configure.enabled =
					!Config.graphOptions.configure.enabled;
				$(ContainerOptions).toggle(Config.graphOptions.configure.enabled);
				break;

			case 'reload':
				if (confirm(mw.msg('knowledgegraph-toolbar-reset-network-confirm'))) {
					if (Network) {
						Network.destroy();
					}

					Data = {};
					Nodes = new vis.DataSet([]);
					Edges = new vis.DataSet([]);

					graphModel = {
						nodes: Nodes,
						edges: Edges,
						addNode: function(node) { if (!this.nodes.get(node.id)) this.nodes.add(node); },
						addEdge: function(edge) { if (!this.edges.get(edge.id)) this.edges.add(edge); },
						removeNode: function(nodeId) {
							if (this.nodes.get(nodeId)) {
								this.nodes.remove(nodeId);
							}
						},
						removeEdge: function(edgeId) {
							if (this.edges.get(edgeId)) {
								this.edges.remove(edgeId);
							}
						}
					};

					Network = new vis.Network(Container, { nodes: Nodes, edges: Edges }, Config.graphOptions);

					createNodes(InitialData);
					attachContextMenuListener();
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

	function findNodeIdContaining(labelPart) {
	const allNodes = Nodes.get();
	for (let node of allNodes) {
		const nodeLabel = node.id.split('#')[0];
		if (nodeLabel === labelPart) {
			return node.id;
		}
	}
	return null;
}

	

	function attachContextMenuListener() {
		Network.on('oncontext', function (params) {
			params.event.preventDefault();
			// close custom menu if exists
			$('.custom-menu').hide();

			const pointer = { x: params.pointer.DOM.x, y: params.pointer.DOM.y };
			const edgeId = Network.getEdgeAt(pointer);
			const nodeId = Network.getNodeAt(pointer);

			if (nodeId === undefined && edgeId === undefined) {
				return;
			}

			// create custom-menu if not exists
			let $menu = $('.custom-menu');
			if (!$menu.length) {
				$menu = $('<ul class="custom-menu"></ul>').appendTo('body').hide().css({
					position: 'absolute',
					background: '#fff',
					border: '1px solid #ccc',
					padding: '5px',
					listStyle: 'none',
					zIndex: 10000,
					maxHeight: '300px',
					overflowY: 'auto',
					margin: 0,
					boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
					cursor: 'pointer'
				});
			} else {
				$menu.empty();
			}

			// right click on node should show properties and link to article
			if (nodeId !== undefined) {
				let existingNodes = Nodes.get();
				let hashIndex = nodeId.indexOf('#');
				let titleLabel = nodeId.split('#')[0];
				let hashIndexTitle = titleLabel.indexOf('#');
				if (hashIndexTitle !== -1) {
					titleLabel = titleLabel.substring(0, hashIndexTitle);
				}
				let title = hashIndex !== -1 ? nodeId.substring(0, hashIndex) : nodeId;

				const currentNode = existingNodes.find(n => n.id === nodeId);
				const nodeTypeId = currentNode ? currentNode.typeID : null;

				if (nodeTypeId !== 2) {
					let url = mw.config.get('wgArticlePath').replace('$1', titleLabel);

					let liLink = document.createElement('li');
					liLink.classList.add('custom-menu-link-entry');
					liLink.innerHTML = '🔗 ' + titleLabel;
					liLink.addEventListener('click', () => window.open(url, '_blank'));
					$menu.append(liLink);
				}

				fetchSemanticDataForNode(nodeId, function (rawProps) {
					let props = parseProperties(rawProps).filter(p => !p.property.startsWith('_'));
					nodePropertiesCache[title] = props;

					if (props.length === 0) {
						$menu.append('<li>(No available properties)</li>');
					} else {
						props.forEach(p => {
							let li = document.createElement('li');
							li.classList.add('custom-menu-property-entry');
							li.dataset.action = p.property.replaceAll('_', ' ');
							li.dataset.direction = p.direction; 
							let displayName = p.property.replaceAll('_', ' ') + (p.direction === 'inverse' ? ' (inverse)' : '');
							li.innerHTML = '● ' + displayName;
							$menu.append(li);
						});
					}

					// Add click handler for property entries to create nodes and edges
					$('.custom-menu li.custom-menu-property-entry').click(function () {
						let clickedProperty = $(this).data('action');
						let clickedDirection = $(this).data('direction');
						$('.custom-menu').hide();

						let propertyData = getPropertyValueForNode(title, clickedProperty, clickedDirection);

						if (propertyData && Array.isArray(propertyData.value)) {
							let typeID = propertyData.typeID || null;
							let propKey = clickedDirection === 'inverse' ? `-${clickedProperty}` : clickedProperty;

							if (!(propKey in PropColors)) {
								let color_;
								do {
									color_ = KnowledgeGraphFunctions.randomHSL();
								} while (Object.values(PropColors).includes(color_));
								PropColors[propKey] = color_;
							}
							let nodeColor = PropColors[propKey];

							let currentNodeId = title.includes('_') ? title : `${title}_${typeID}`;
							let dataKey = currentNodeId.split('_')[0];
							if (!Data[dataKey]) {
								Data[dataKey] = {
									properties: []
								};
							}

							if (!Data[dataKey].properties[propKey]) {
								Data[dataKey].properties[propKey] = {
									key: propKey,
									canonicalLabel: propKey,
								};
							}

							let nodesExisting = Nodes.get();
							let	edgesExisting = Edges.get();
							let keepNode = Network.getNodeAt(pointer);
							let normalize = str => str.replace(/^-/, '');

							propertyData.value.forEach(valueItem => {
								nodesExisting = Nodes.get();
								edgesExisting = Edges.get();

								let rawLabel = valueItem;
								let labelWithoutHash = rawLabel.split('#')[0];
								let displayLabel = labelWithoutHash.replaceAll('_', ' ');

								let existingNode = nodesExisting.find(n => n.label === displayLabel && n.typeID === typeID);
								let nodeId = existingNode ? existingNode.id : KnowledgeGraphFunctions.makeNodeId(displayLabel, typeID);

								let fromRaw = clickedDirection === 'inverse' ? (nodeId) : (title);
								let toRaw   = clickedDirection === 'inverse' ? (title) : (nodeId);

								let edgePropKey = clickedDirection === 'inverse' ? `-${clickedProperty}` : clickedProperty;

								let fromNode = Nodes.get(fromRaw) ? fromRaw : findNodeIdContaining(fromRaw) || fromRaw;
								let toNode   = Nodes.get(toRaw)   ? toRaw   : findNodeIdContaining(toRaw)   || toRaw;

								let edgeId = KnowledgeGraphFunctions.makeEdgeId(fromNode, toNode, edgePropKey, typeID, Nodes);

								// Part to remove edges and nodes
								let edgeExists = edgesExisting.some(e => e.id === edgeId);

								if (edgeExists) {
									graphModel.removeEdge(edgeId);

									nodesExisting = Nodes.get();
									edgesExisting = Edges.get();

									let connectedEdges = Edges.get().filter(e =>
										(e.from === nodeId || e.to === nodeId) && e.id !== edgeId
									);

									if (connectedEdges.length === 0) {
										recursiveDeleteAllChildren(nodeId);

										nodesExisting = Nodes.get();
										edgesExisting = Edges.get();
									}

									return;
								}

								function stripHashSuffix(str) {
									return str.split('#')[0];
								}

								let clickedPropertyNormalized = normalize(edgePropKey);

								let edgeToDelete = edgesExisting.find(edge => {
									if (!edge.id) return false;

									let parts = edge.id.split('→');
									if (parts.length < 3) return false;

									let fromPart = stripHashSuffix(parts[0]);
									let labelPart = parts[1];
									let toPart = stripHashSuffix(parts[2]);

									return (
										(
											(fromPart === stripHashSuffix(fromNode) && toPart === stripHashSuffix(toNode)) ||
											(fromPart === stripHashSuffix(toNode) && toPart === stripHashSuffix(fromNode))
										) &&
											normalize(labelPart) === clickedPropertyNormalized
									);
								});

								if (edgeToDelete) {
									graphModel.removeEdge(edgeToDelete.id);

									nodesExisting = Nodes.get();
									edgesExisting = Edges.get();

									let { from, to } = edgeToDelete;
									
									let maybeDeleteNode = from === keepNode ? to : from;

									let connectedEdges = Edges.get().filter(e =>
										(e.from === maybeDeleteNode || e.to === maybeDeleteNode) &&
										e.id !== edgeToDelete.id
									);

									if (connectedEdges.length === 0) {
										recursiveDeleteAllChildren(maybeDeleteNode);
										nodesExisting = Nodes.get();
										edgesExisting = Edges.get();
									}

									return;
								}

								if (!nodesExisting.some(n => n.id === nodeId)) {
									let nodeConfig = {
										id: nodeId,
										label: displayLabel,
										typeID: typeID,
										color: nodeColor,
									};
									if (typeID === 9) {
										nodeConfig.shape = 'box';
										nodeConfig.font = jQuery.extend(
											{},
											Config.graphOptions.nodes.font,
											{ size: Config.graphOptions.nodes.font.size || 30 }
										);

										if (!Data[nodeId]) {
											let dataKey = nodeId.split('_')[0];
											Data[dataKey] = { properties: [] };
										}
									}
									graphModel.addNode(nodeConfig);
									nodesExisting = Nodes.get();
									edgesExisting = Edges.get();
								}

								let edgeConfig = {
									id: edgeId,
									from: fromNode,
									to: toNode,
									label: edgePropKey,
								};
								if (typeID === 9) {
									edgeConfig.arrows = { to: { enabled: true } };
								}

								graphModel.addEdge(edgeConfig);
								nodesExisting = Nodes.get();
								edgesExisting = Edges.get();

							});
						}
					});
				});
			}

			// right click on edge should show property and type
			else if (params.edges && params.edges.length > 0) {
				let edgeId = params.edges[0];
				let edge = Edges.get(edgeId);
				if (!edge || !edge.label) return;

				let cleanedLabel = cleanLabel(edge.label);
    			let propertyTitle = 'Property:' + cleanedLabel.replaceAll(' ', '_');

				let li = document.createElement('li');
				let baseUrl = mw.config.get('wgServer') + mw.config.get('wgScriptPath');
				let fullUrl = `${baseUrl}/index.php/${propertyTitle}`;
				li.classList.add('custom-menu-edge-entry');
				li.innerHTML = '🔗 ' + cleanedLabel;
				li.addEventListener('click', () => window.open(fullUrl, '_blank'));

				$menu.append(li);
			}

			// show the menu
			$menu.finish().toggle(100).css({
				top: params.event.pageY + "px",
				left: params.event.pageX + "px",
				display: "block"
			});

			// hide the menu when clicking outside
			$(document).one('click', function () {
				$menu.hide();
			});
		});
	}

	function recursiveDeleteAllChildren(nodeId) {
		const edges = Edges.get().filter(e => e.from === nodeId);
		edges.forEach(edge => {
			let childId = edge.to;
			recursiveDeleteAllChildren(childId);
			graphModel.removeEdge(edge.id);
			graphModel.removeNode(childId);
		});
		graphModel.removeNode(nodeId);
	}

	function fetchSemanticDataForNode(title, callback) {
		let cleanTitle = title.split('#')[0];
		let type = title.split('#')[1];
		if (type === '2') {
			callback([]);
        	return;
		}	
		mw.loader.using('mediawiki.api').then(function() {
			new mw.Api().get({
			action: "smwbrowse",
			format: "json",
			browse: "subject",
			params: JSON.stringify({
				subject: cleanTitle,
				ns: 0
			})
			}).done(function(data) {
				if (data && data.query && data.query.data) {
					const filtered = data.query.data.filter(item => !item.property.startsWith('_'));
					if (filtered.length > 0) {
						callback(filtered);
					} else {
						console.warn("No semantic *user* properties found for", cleanTitle, data);
						callback([]);
					}
				} else {
					console.warn("No semantic data found for", cleanTitle, data);
					callback([]);
				}
			}).fail(function(err) {
				console.error("SMW browse API failed:", err);
				callback([]);
			});
		});
	}

	function parseProperties(dataArray) {
		return dataArray.map(item => {
			let values = [];
			let typeID = null;

			if (item.dataitem && item.dataitem.length > 0) {
				values = item.dataitem.map(di => {
					if (di.label) return di.label;
					else if (di.title) return di.title;
					else if (typeof di === 'string') return di;
					else if (typeof di.item === 'string') return di.item;
					else return '';
				}).filter(v => v);

				typeID = item.dataitem[0].type !== undefined ? item.dataitem[0].type : null;
			}

			return {
				property: item.property,
				value: values,
				typeID: typeID,
				direction: item.direction
			};
		});
	}

	function cleanLabel(label) {
		if (label.startsWith('-')) {
			label = label.substring(1);
		}
		label = label.replace(/\s*\([^)]*\)$/, '');
		return label.trim();
	}

	function getPropertyValueForNode(nodeId, propertyName, direction) {
		const props = nodePropertiesCache[nodeId];
		if (!props) return null;

		const normalizedProperty = propertyName.replaceAll('_', ' ').toLowerCase();

		const prop = props.find(p =>
			p.property.replaceAll('_', ' ').toLowerCase() === normalizedProperty &&
			p.direction === direction
		);

		return prop || null;
	}

	function normalizeLabel(label) {
		let cleanLabel = label.startsWith('-') ? label.slice(1) : label;
		
		const parenIndex = cleanLabel.indexOf('(');
		if (parenIndex !== -1) {
			cleanLabel = cleanLabel.substring(0, parenIndex).trim();
		}

		return cleanLabel;
	}

	function initialize(container, containerToolbar, containerOptions, config) {
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

		graphModel = {
			nodes: Nodes,
			edges: Edges,

			addNode: function(node) {
				if (!this.nodes.get(node.id)) {
				this.nodes.add(node);
				}
			},

			addEdge: function(edge) {
				if (!this.edges.get(edge.id)) {
				this.edges.add(edge);
				}
			},

			removeNode: function(nodeId) {
				if (this.nodes.get(nodeId)) {
					this.nodes.remove(nodeId);
				}
			},

			removeEdge: function(edgeId) {
				if (this.edges.get(edgeId)) {
					this.edges.remove(edgeId);
				}
			}
		};

		Config.graphOptions.interaction = Config.graphOptions.interaction || {};
		Config.graphOptions.interaction.hover = true;

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
		attachContextMenuListener();

		Network.on('click', function (params) {
			if (!params.nodes.length) {
				return;
			}

			HideNodesRec(params.nodes[0]);
		});

		Network.on('hoverNode', function (params) {
			const nodeId = params.node;

			if (SelectedNode !== nodeId) {
				SelectedNode = nodeId;
			}
		});

		Network.on('hoverEdge', function (params) {
			const edgeId = params.edge;

			if (SelectedNode !== edgeId) {
				SelectedNode = edgeId;
				Network.selectEdges([edgeId]);
			}
		});

		Network.on('blurNode', function () {
			Network.unselectAll();
		});

		Network.on('blurEdge', function (params) {
			SelectedNode = null;
			Network.unselectAll();
		});

		Network.on('doubleClick', function (params) {
			if (!params.nodes.length) {
				return;
			}

			let nodeId = params.nodes[0];

			if (nodeId !== undefined) {
				let hashIndex = nodeId.indexOf('#');
				let titleLabel = nodeId.split('_')[0];
				let hashIndexTitle = titleLabel.indexOf('#');

				if (hashIndexTitle !== -1) {
					titleLabel = titleLabel.substring(0, hashIndexTitle);
				}

				let title = hashIndex !== -1 ? nodeId.substring(0, hashIndex) : nodeId;
				let url = mw.config.get('wgArticlePath').replace('$1', titleLabel);
				window.open(url, '_blank');
			}
		});
	}

	return {
		initialize,
	};
};

$(document).ready(async function () {
	var semanticGraphs = JSON.parse(mw.config.get('knowledgegraphs'));

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

		graph.initialize(container, containerToolbar, containerOptions, config);
	});
});
