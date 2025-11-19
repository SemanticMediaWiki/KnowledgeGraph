/**
 * KnowledgeGraph
 *
 * @licence GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 * @see https://github.com/OpenSemanticLab/mediawiki-extensions-InteractiveSemanticGraph
 */

KnowledgeGraph = function () {
	// instance bag
	const self = {};

	// instance state (defaults)
	self.Nodes = null;
	self.Edges = null;
	self.Data = {};
	self.maxPropValueLength = 20;
	self.Config = null;
	self.Container = null;
	self.Properties = {};
	self.SelectedNode = null;
	self.TmpData = null;
	self.Network = null;
	self.PopupMenuId = 'knowledgegraphp-popup-menu';
	self.InitialData = null;
	self.ContainerOptions = null;
	self.WindowManagerNonModal = null;
	self.DialogCredits = 'dialog-credits';
	self.PropColors = {};
	self.Categories = {};
	self.LegendDiv = null;
	self.PropIdPropLabelMap = {};
	self.nodePropertiesCache = {};
	self.id = null;
	self.colors = mw.config.get('wgKnowledgeGraphColorPalette');

	function addLegendEntry(id, label, color) {
		if (!self.LegendDiv) return;

		const safeId = id.replace(/ /g, '_');
		const uniqueId = `${self.id}-${safeId}`;
		
		if (self.LegendDiv.querySelector(`#${CSS.escape(uniqueId)}`)) {
			return;
		}

		let fontColor = KnowledgeGraphFunctions.getContrastColor(color);
		if (!fontColor) fontColor = '#000000';

		const container = document.createElement('button');
		container.className = 'legend-element-container btn btn-outline-light';
		container.id = uniqueId;
		container.style.color = fontColor;
		container.style.background = color;
		container.innerHTML = label;
		container.innerHTML = id;

		container.dataset.active = true;
		container.dataset.active_color = color;

		self.LegendDiv.append(container);
	}

	function removeLegendEntry(property) {
		if (!self.LegendDiv) return;
		// use instance-specific ID
		const safeId = `${this.id}-${property.replace(/ /g, '_')}`;
		const entry = this.LegendDiv.querySelector(`#${CSS.escape(safeId)}`);

		if (entry) {
			entry.remove();
			console.debug(`Legend entry removed for ${property} in ${this.id}`);
		}
	}

	function checkAndToogleId(id) {
		return id.trim().replace(/_/g, ' ').replace(/#.*$/, '');
	}

	function dispatchEvent_LegendClick(event, id) {
		if (!this.LegendDiv) return;

		const safeId = `${this.id}-${id.replace(/ /g, '_')}`;
		const container = this.LegendDiv.querySelector(`#${CSS.escape(safeId)}`);
		if (!container) return;

		const isActive = container.dataset.active === 'true';
		container.dataset.active = (!isActive).toString();

		if (isActive) {
			container.style.background = '#FFFFFF';
			const fontColor = KnowledgeGraphFunctions.getContrastColor(container.style.background) || '#000000';
			container.style.color = fontColor;
		} else {
			container.style.background = container.dataset.active_color;
			const fontColor = KnowledgeGraphFunctions.getContrastColor(container.style.background) || '#000000';
			container.style.color = fontColor;
		}

		const updateNodes = [];
		const visited = [];
		const self = this;

		function toggleConnectedNodes(nodeId) {
			if (visited.includes(nodeId)) return;
			visited.push(nodeId);

			const connectedNodes = self.Network.getConnectedNodes(nodeId);
			for (const nodeId_ of connectedNodes) {
				const connectedEdgesIds = self.Network.getConnectedEdges(nodeId_);
				const connectedEdges = self.Edges.get(connectedEdgesIds);

				let found = false;
				for (const edge of connectedEdges) {
					if (edge.to === nodeId || edge.from === nodeId) {
						found = true;
						break;
					}
				}

				if (!found) {
					updateNodes.push({
						id: nodeId_,
						hidden: container.dataset.active === 'true' ? false : true,
					});
					toggleConnectedNodes(nodeId_);
				}
			}
		}

		this.Nodes.forEach((node) => {
			const idValue = checkAndToogleId(node.id);

			if (this.PropIdPropLabelMap[id] === undefined) {
				this.PropIdPropLabelMap[id] = [];
			}

			if (
				this.PropIdPropLabelMap[id].includes(idValue) ||
				this.PropIdPropLabelMap[id].includes(node.id)
			) {
				updateNodes.push({
					id: node.id,
					hidden: container.dataset.active === 'true' ? false : true,
				});
				toggleConnectedNodes(node.id);
			}
		});

		this.Nodes.update(updateNodes);
	}

	function deleteNode(nodeId) {
		const children = self.Network.getConnectedNodes(nodeId).filter(
			(x) => !(x in self.Data) || self.Network.getConnectedNodes(x).length === 1
		);
		children.push(nodeId);

		for (const nid of children) {
			self.Edges.remove(self.Network.getConnectedEdges(nid));
		}
		self.Nodes.remove(children);
		for (const nid of children) {
			delete self.Data[nid];
		}
	}

	function loadNodes(obj) {
		if (obj.title !== null && obj.properties === null) {
			var payload = {
				action: 'knowledgegraph-load-nodes',
				titles: obj.title,
				depth: obj.depth,
				properties: JSON.stringify(self.Config['properties']),
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
				inversePropsIncluded: inversePropsIncluded,
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

	function wrapLabel(text, maxLength) {
		const words = text.split(' ');
		let wrapped = '';
		let line = '';

		for (let word of words) {
			if ((line + word).length > maxLength) {
				if (line) wrapped += line.trim() + '\n';
				line = word + ' ';
			} else {
				line += word + ' ';
			}
		}
		wrapped += line.trim();
		return wrapped;
	}

	function addArticleNode(data, label, options, typeID) {
		if (self.Nodes.get(label) !== null) {
			return;
		}

		let cleanLabel = label.split('#')[0];

		const nodeConfig = jQuery.extend(
			JSON.parse(JSON.stringify(self.Config.graphOptions.nodes)),
			label in self.Config.propertyOptions ? self.Config.propertyOptions[label] : {},
			{
				id: label,
				label:
					cleanLabel.length <= self.maxPropValueLength
						? cleanLabel
						: wrapLabel(cleanLabel, 20),
				shape: 'box',
				font: jQuery.extend({}, self.Config.graphOptions.nodes.font, {
					size: self.Config.graphOptions.nodes.font.size || 30,
				}),
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
			nodeConfig.shapeProperties = nodeConfig.shapeProperties || {};
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

		self.Nodes.add(nodeConfig);
	}

	function createNodes(data) {
		for (const label in data) {
			if (label in self.Data && self.Data[label] !== null) {
				continue;
			}

			addArticleNode(data, label);

			if (data[label] === null) {
				continue;
			}

			if (!(label in self.Categories)) {
				self.Categories[label] = [];
			}

			for (const i in data[label].categories) {
				const category = data[label].categories[i];
				if (self.Categories[label].indexOf(category) === -1) {
					self.Categories[label].push(category);
				}
			}

			for (const i in data[label].properties) {
				const property = data[label].properties[i];

				if (!(property.canonicalLabel in self.PropColors)) {
					if (self.colors && self.colors.length > 0) {
						// use d3 palette colors defined in wgKnowledgeGraphColorPalette
						self.PropColors[property.canonicalLabel] = KnowledgeGraphFunctions.colorForPropertyLabel(
							property.canonicalLabel,
							self.colors,
							self.PropColors
						);
					} else {
						// use random HSL colors if no palette defined
						let color_;
						function colorExists() {
							for (const j in self.PropColors) {
								if (self.PropColors[j] === color_) {
									return true;
								}
							}
							return false;
						}
						do {
							color_ = KnowledgeGraphFunctions.randomHSL();
						} while (colorExists());
						self.PropColors[property.canonicalLabel] = color_;
					}
				}

				let options =
					property.preferredLabel in self.Config.propertyOptions
						? self.Config.propertyOptions[property.preferredLabel]
						: property.canonicalLabel in self.Config.propertyOptions
							? self.Config.propertyOptions[property.canonicalLabel]
							: {};

				if ('nodes' in options) {
					options = options.nodes;
				}
				if (!('color' in options)) {
					const nodeColor = self.PropColors[property.canonicalLabel];
					const textColor = KnowledgeGraphFunctions.getContrastColor(nodeColor);

					options.color = {
						background: nodeColor,
						border: '#333',
						highlight: {
							background: nodeColor,
							border: '#000',
						},
					};

					// readable font color when background dark
					options.font = Object.assign({}, options.font, {
						color: textColor,
					});
				}

				const legendLabel =
					property.preferredLabel !== ''
						? property.preferredLabel
						: property.canonicalLabel;

				if (!(legendLabel in self.PropIdPropLabelMap)) {
					self.PropIdPropLabelMap[legendLabel] = [];
				}

				const propLabel =
					legendLabel + (!self.Config['show-property-type'] ? '' : ' (' + property.typeLabel + ')');

				if (self.Config['properties-panel']) {
					addLegendEntry(property.canonicalLabel, legendLabel, self.PropColors[property.canonicalLabel]);
				}

				switch (property.typeId) {
					case '_wpg':
						for (const ii in property.values) {
							const targetLabel = property.values[ii].value;
							self.PropIdPropLabelMap[legendLabel].push(targetLabel);

							const from = property.inverse ? targetLabel : label;
							const to = property.inverse ? label : targetLabel;

							const edgeId = KnowledgeGraphFunctions.makeEdgeId(from, to, property.canonicalLabel, 9, self.Nodes);

							const edgeConfig = jQuery.extend(
								JSON.parse(JSON.stringify(self.Config.graphOptions.edges)),
								{
									id: edgeId,
									from: from,
									to: to,
									label: propLabel,
									group: label,
									arrows: { to: { enabled: true } },
								}
							);

							self.graphModel.addEdge(edgeConfig);

							if (property.values[ii].src && mw.config.get('KnowledgeGraphShowImages') === true) {
								options.shape = 'image';
								options.image = property.values[ii].src;
							}

							addArticleNode(data, targetLabel, options, 9);
						}
						break;

					default:
						{
							const seen = new Set();
							for (const { value: targetLabel } of property.values) {
								if (seen.has(targetLabel)) continue;
								seen.add(targetLabel);

								const typeId = property.typeId === '_txt' ? 2 : property.typeId;
								const valueId = KnowledgeGraphFunctions.makeNodeId(targetLabel, typeId);
								const edgeLabel = property.canonicalLabel || propLabel;

								self.PropIdPropLabelMap[legendLabel].push(valueId);

								const edgeId = KnowledgeGraphFunctions.makeEdgeId(label, valueId, edgeLabel);
								self.Edges.add({
									id: edgeId,
									from: label,
									to: valueId,
									label: propLabel,
									group: label,
								});

								if (!self.Nodes.get(valueId)) {
									const displayLabel = targetLabel.length <= self.maxPropValueLength
										? targetLabel
										: wrapLabel(targetLabel, 20);

									self.Nodes.add(
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
		}
		self.Data = jQuery.extend(self.Data, data);
	}

	function HideNodesRec(nodeId) {
		const children = self.Network.getConnectedNodes(nodeId);
		const updateNodes = [];
		for (const nodeId_ of children) {
			if (!(nodeId_ in self.Data)) {
				updateNodes.push({
					id: nodeId_,
					hidden: !self.Nodes.get(nodeId_).hidden,
				});
			}
		}
		self.Nodes.update(updateNodes);
	}

	function getDialogActionProcessCallback(thisDialog, getActionProcess, action) {
		switch (action) {
			case 'delete':
				if (confirm(mw.msg('knowledgegraph-delete-node-confirm'))) {
					deleteNode(self.SelectedNode);
					return new OO.ui.Process(function () {
						thisDialog.close({ action: action });
					});
				}
				break;
			case 'done':
				return new OO.ui.Process(function () {
					thisDialog.close({ action: action }).then(function () {
						// createNodes(self.TmpData);
					});
					createNodes(self.TmpData);
					self.TmpData = {};
				});
			case 'continue':
				return getActionProcess
					.call(thisDialog, action)
					.next(function () {
						return new Promise((resolve, reject) => {
							const selectedTab = thisDialog.indexLayout.getCurrentTabPanelName();
							let titleValue = null;
							let properties = null;
							let categories = null;
							let depth, limit, offset;

							switch (selectedTab) {
								case 'by-article':
									titleValue = thisDialog.titleInputWidget.getValue();

									if (titleValue === '') {
										resolve();
										return;
									}
									let ns = parseInt(thisDialog.namespaceDropdown.getValue() || 0, 10);
									let titleObj = mw.Title.newFromText(titleValue, ns);

									if (!titleObj) {
										resolve();
										return;
									}
									let titleFullText = titleObj.getPrefixedText();

									if (titleFullText in self.Data) {
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
										const titleObj = mw.Title.newFromText(titles[i]);
										if (!titleObj) continue;

										const fullTitle = titleObj.getPrefixedText();
										if (fullTitle in self.Data) {
											existingTitles.push(fullTitle);
										} else {
											newTitles.push(fullTitle);
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
									self.TmpData = data;
									let mode;
									if (selectedTab === 'by-article') {
										let ns = parseInt(thisDialog.namespaceDropdown.getValue() || 0, 10);
										let titleObj = mw.Title.newFromText(titleValue, ns);
										titleFullText = titleObj ? titleObj.getPrefixedText() : titleValue;

										let properties_ = data[titleFullText] || data[titleValue] || {};
										mode = Object.keys(properties_).length ? 'show-results' : 'no-results';
									} else {
										mode = Object.keys(data).length ? 'show-results' : 'no-results';
									}
									thisDialog.initializeResultsPanel(mode, selectedTab, data, selectedTab === 'by-article' ? titleFullText : null);
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
		if (data && data.nodeId) {
			self.SelectedNode = data.nodeId;
			const mode = 'edit';
			thisDialog.initializeResultsPanel(mode);
			thisDialog.actions.setMode(mode);
		} else {
			thisDialog.actions.setMode('select');
		}
	}

	function getDialogInitializeResultsPanel(thisDialog, mode, selectedTab, data, titleFullText) {
		let $el;
		if (mode === 'no-results') {
			const msg = mw.msg(selectedTab === 'by-article' ? 'knowledgegraph-dialog-results-no-properties' : 'knowledgegraph-dialog-results-no-articles');
			$el = $('<span>' + msg + '</span>');
		} else if (mode === 'existing-node') {
			$el = $('<span>' + mw.msg('knowledgegraph-dialog-results-existing-node') + '</span>');
		} else {
			$el = $('<ul>');
			switch (selectedTab) {
				case 'by-article':
					thisDialog.panelB.$element.append('<h3>' + mw.msg('knowledgegraph-dialog-results-has-properties') + '</h3>');
					const properties = data[titleFullText].properties;
					for (const i in properties) {
						const url = mw.config.get('wgArticlePath').replace('$1', i);
						$el.append($('<li><a target="_blank" href="' + url + '">' + (properties[i].preferredLabel !== '' ? properties[i].preferredLabel : properties[i].canonicalLabel) + '</a> (' + properties[i].typeLabel + ')</li>'));
					}
					break;

				case 'by-properties':
					if (Object.keys(data).some((i) => !(i in self.Data) && data[i] !== null)) {
						thisDialog.panelB.$element.append('<h3>' + mw.msg('knowledgegraph-dialog-results-importing-nodes') + '</h3>');

						const $newList = $('<ul>');
						for (const i in data) {
							if (!(i in self.Data) && data[i] !== null) {
								const url = mw.config.get('wgArticlePath').replace('$1', i);
								$newList.append($('<li><a target="_blank" href="' + url + '">' + i + '</a></li>'));
							}
						}
						thisDialog.panelB.$element.append($newList);
					}

					if (thisDialog._skippedTitles && thisDialog._skippedTitles.length > 0) {
						thisDialog.panelB.$element.append('<h4>' + mw.msg('knowledgegraph-dialog-results-skipped-existing') + '</h4>');
						const $skippedList = $('<ul>');
						thisDialog._skippedTitles.forEach(function (title) {
							const url = mw.config.get('wgArticlePath').replace('$1', title);
							$skippedList.append($('<li><a target="_blank" href="' + url + '">' + title + '</a></li>'));
						});
						thisDialog.panelB.$element.append($skippedList);
					}
					break;

				case 'by-categories':
					thisDialog.panelB.$element.append('<h3>' + mw.msg('knowledgegraph-dialog-results-importing-nodes') + '</h3>');
					const $ul = $('<ul>');
					let newNodesCount = 0;
					for (const i in data) {
						if (!(i in self.Data) && data[i] !== null) {
							const url = mw.config.get('wgArticlePath').replace('$1', i);
							$ul.append($('<li><a target="_blank" href="' + url + '">' + i + '</a></li>'));
							newNodesCount++;
						}
					}
					if (newNodesCount === 0) {
						thisDialog.panelB.$element.append($('<p>' + mw.msg('knowledgegraph-dialog-results-no-new-nodes') + '</p>'));
					} else {
						thisDialog.panelB.$element.append($ul);
					}
					break;
			}
		}
		return $el;
	}

	function openDialog(nodeId) {
		self.Properties = {};
		self.TmpData = {};

		const windowManager = new OO.ui.WindowManager();
		$(document.body).append(windowManager.$element);

		const myDialog = KnowledgeGraphDialog.create(
			self.Config,
			{ size: 'medium' },
			getDialogActionProcessCallback,
			getDialogOnSetupCallback,
			getDialogInitializeResultsPanel
		);

		windowManager.addWindows([myDialog]);
		windowManager.openWindow(myDialog, { nodeId, title: nodeId });
	}

	function getOnSelectToolbar() {
		const selfTool = this;
		const toolName = selfTool.getName();

		switch (toolName) {
			case 'add-node':
				openDialog(null);
				break;
			case 'export-graph':
				{
					const nodes = [];
					const properties = [];
					let propertyOptions = '';
					for (const i in self.Data) {
						if (nodes.indexOf(i) === -1) {
							nodes.push(i);
						}
						if (self.Data[i] === null) continue;
						for (const ii in self.Data[i].properties) {
							const property = self.Data[i].properties[ii];
							if (properties.indexOf(property.canonicalLabel) === -1) {
								properties.push(property.canonicalLabel);
								propertyOptions += `|property-options?${property.canonicalLabel}=\n`;
							}
						}
					}

					const text = `{{#knowledgegraph:
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
				}
				break;
			case 'show-config':
				self.Config.graphOptions.configure.enabled = !self.Config.graphOptions.configure.enabled;
				$(self.ContainerOptions).toggle(self.Config.graphOptions.configure.enabled);
				break;
			case 'reload':
				if (confirm(mw.msg('knowledgegraph-toolbar-reset-network-confirm'))) {
					if (self.Network) {
						self.Network.destroy();
					}
					self.Data = {};
					self.Nodes = new vis.DataSet([]);
					self.Edges = new vis.DataSet([]);

					self.graphModel = {
						nodes: self.Nodes,
						edges: self.Edges,
						addNode: function (node) { if (!this.nodes.get(node.id)) this.nodes.add(node); },
						addEdge: function (edge) { if (!this.edges.get(edge.id)) this.edges.add(edge); },
						removeNode: function (nodeId) { if (this.nodes.get(nodeId)) this.nodes.remove(nodeId); },
						removeEdge: function (edgeId) { if (this.edges.get(edgeId)) this.edges.remove(edgeId); },
					};

					self.Network = new vis.Network(self.Container, { nodes: self.Nodes, edges: self.Edges }, self.Config.graphOptions);

					createNodes(self.InitialData);
					attachContextMenuListener();
				}
				break;
		}

		this.setActive(false);
	}

	function getOnSelectActionToolbar() {
		const selfTool = this;
		const toolName = selfTool.getName();

		switch (toolName) {
			case 'help-button':
				window.open(HelpUrl, '_blank').focus();
				break;
			case 'info-button':
				if (self.WindowManagerNonModal) {
					self.WindowManagerNonModal.getWindow(self.DialogCredits).then(function (dialog) {
						if (dialog.isOpened()) {
							dialog.close();
						} else {
							dialog.open();
						}
						return;
					});
					return;
				}

				self.WindowManagerNonModal = new OO.ui.WindowManager({
					modal: false,
					classes: ['OOUI-dialogs-non-modal'],
				});

				$(document.body).append(self.WindowManagerNonModal.$element);

				const windows = {
					[self.DialogCredits]: KnowledgeGraphNonModalDialog.create({ size: 'medium' }),
				};

				self.WindowManagerNonModal.addWindows(windows);
				self.WindowManagerNonModal.openWindow(self.DialogCredits, {});
				break;
		}
		this.setActive(false);
	}

	function findNodeIdContaining(labelPart) {
		const allNodes = self.Nodes.get();
		for (const node of allNodes) {
			const nodeLabel = node.id.split('#')[0];
			if (nodeLabel === labelPart) {
				return node.id;
			}
		}
		return null;
	}

	function attachContextMenuListener() {
		self.Network.on('oncontext', function (params) {
			params.event.preventDefault();

			// pointer coordinates
			const pointer = { x: params.pointer.DOM.x, y: params.pointer.DOM.y };
			const edgeId = self.Network.getEdgeAt(pointer);
			const nodeId = self.Network.getNodeAt(pointer);

			if (nodeId === undefined && edgeId === undefined) {
				return;
			}

			// create/find per-instance menu
			let $menu = $(`.kg-node-properties-menu[data-instance-id="${self.id}"]`);
			if (!$menu.length) {
				$menu = $(`<ul class="kg-node-properties-menu" data-instance-id="${self.id}"></ul>`).appendTo('body').hide();
			} else {
				$menu.empty();
			}

			// right click on node
			if (nodeId !== undefined) {
				const existingNodes = self.Nodes.get();
				let hashIndex = nodeId.indexOf('#');
				let titleLabel = nodeId.split('#')[0];
				let hashIndexTitle = titleLabel.indexOf('#');
				if (hashIndexTitle !== -1) {
					titleLabel = titleLabel.substring(0, hashIndexTitle);
				}
				const title = hashIndex !== -1 ? nodeId.substring(0, hashIndex) : nodeId;

				const currentNode = existingNodes.find(n => n.id === nodeId);
				const nodeTypeId = currentNode ? currentNode.typeID : null;

				if (nodeTypeId !== 2) {
					const url = mw.config.get('wgArticlePath').replace('$1', titleLabel);
					const liLink = document.createElement('li');
					liLink.classList.add('kg-node-properties-menu-link-entry');
					liLink.innerHTML = '🔗 ' + titleLabel;
					liLink.addEventListener('click', () => window.open(url, '_blank'));
					$menu.append(liLink);
				}

				// fetch semantic properties for clicked node
				fetchSemanticDataForNode(nodeId, function (rawProps) {
					const props = parseProperties(rawProps).filter(p => !p.property.startsWith('_'));
					self.nodePropertiesCache[title] = props;
					let nodesExisting = self.Nodes.get();
					let edgesExisting = self.Edges.get();

					if (props.length === 0) {
						$menu.append('<li>(No available properties)</li>');
					} else {
						props.forEach(p => {
							const li = document.createElement('li');
							li.classList.add('kg-node-properties-menu-property-entry');
							li.dataset.action = p.property.replaceAll('_', ' ');
							li.dataset.direction = p.direction;

							const displayName = p.property.replaceAll('_', ' ') + (p.direction === 'inverse' ? ' (inverse)' : '');
							const expectedLabel = p.direction === 'inverse' ? '-' + p.property.replaceAll('_', ' ') : p.property.replaceAll('_', ' ');

							// check if property already exists in graph
							const existsInGraph = edgesExisting.some(edge => {
								const labelMatch = edge.label === expectedLabel;
								const fromMatch = edge.from === title;
								const toMatch = edge.to === title;

								if (p.direction === 'direct') {
									return labelMatch && fromMatch;
								} else if (p.direction === 'inverse') {
									return labelMatch && toMatch;
								}
								return false;
							});

							if (existsInGraph) {
								li.classList.add('kg-node-properties-menu-property-entry-selected');
							}

							li.innerHTML = '● ' + displayName;
							$menu.append(li);
						});
					}

					// click handler for property entries
					$menu.find('li.kg-node-properties-menu-property-entry').off('click').on('click', (ev) => {
						const $li = $(ev.currentTarget);
						const clickedProperty = $li.data('action');
						const clickedDirection = $li.data('direction');
						$menu.hide();

						if ($li.hasClass('kg-node-properties-menu-property-entry-selected')) {
							$li.removeClass('kg-node-properties-menu-property-entry-selected');
						} else {
							$li.addClass('kg-node-properties-menu-property-entry-selected');
						}

						const propertyData = getPropertyValueForNode(title, clickedProperty, clickedDirection);

						if (propertyData && Array.isArray(propertyData.value)) {
							const typeID = propertyData.typeID || null;
							const propKey = clickedDirection === 'inverse' ? `-${clickedProperty}` : clickedProperty;

							if (!(propKey in self.PropColors)) {
								if (self.colors && self.colors.length > 0) {
									self.PropColors[propKey] = KnowledgeGraphFunctions.colorForPropertyLabel(propKey, self.colors, self.PropColors);
								} else {
									let color_;
									do {
										color_ = KnowledgeGraphFunctions.randomHSL();
									} while (Object.values(self.PropColors).includes(color_));
									self.PropColors[propKey] = color_;
								}
							}
							const nodeColor = self.PropColors[propKey];

							const currentNodeId = title.includes('_') ? title : `${title}_${typeID}`;
							const dataKey = currentNodeId.split('_')[0];
							if (!self.Data[dataKey]) {
								self.Data[dataKey] = { properties: [] };
							}

							if (!self.Data[dataKey].properties[propKey]) {
								self.Data[dataKey].properties[propKey] = {
									key: propKey,
									canonicalLabel: propKey,
								};
							}

							const pointer = params.pointer.DOM; // keep reference for Network.getNodeAt
							let normalize = str => str.replace(/^-/, '');

							const checkedItems = [];
							const checkedItemsIds = [];

							propertyData.value.forEach(valueItem => {
								nodesExisting = self.Nodes.get();
								edgesExisting = self.Edges.get();
								let displayLabel = '';

								// handle namespace-labeled values
								if (typeID === 9) {
									const nsName = fetchNamespaceNameForNode(valueItem, typeID);
									const rawLabel = valueItem;
									const labelWithoutHash = rawLabel.split('#')[0];
									displayLabel = labelWithoutHash.replaceAll('_', ' ');
									displayLabel = nsName ? `${nsName}:${displayLabel}` : displayLabel;
								} else {
									const rawLabel = valueItem;
									const labelWithoutHash = rawLabel.split('#')[0];
									displayLabel = labelWithoutHash.replaceAll('_', ' ');
								}

								if (checkedItems.includes(displayLabel)) {
									return;
								}

								checkedItems.push(displayLabel);
								checkedItemsIds.push(displayLabel + '#' + typeID);

								const alreadyChecked = nodesExisting.some(n => {
									return checkedItemsIds.includes(n.id);
								});

								// if (alreadyChecked) {
								// 	return;
								// }

								const existingNode = nodesExisting.find(n => {
									const normalizedLabel = n.label.replace(/\s+/g, ' ').trim();
									const shortLabel = normalizedLabel.includes(':') ? normalizedLabel.split(':')[1].trim() : normalizedLabel;
									const normalizedDisplay = displayLabel.replace(/\s+/g, ' ').trim();
									const count = displayLabel.split(':').length - 1;
									return normalizedDisplay.includes(shortLabel) && count === 1 && n.typeID === typeID;
								});

								const nodeId = existingNode ? existingNode.id : KnowledgeGraphFunctions.makeNodeId(displayLabel, typeID);

								const fromRaw = clickedDirection === 'inverse' ? (nodeId) : (title);
								const toRaw = clickedDirection === 'inverse' ? (title) : (nodeId);

								const edgePropKey = clickedDirection === 'inverse' ? `-${clickedProperty}` : clickedProperty;

								const fromNode = self.Nodes.get(fromRaw) ? fromRaw : findNodeIdContaining.call(self, fromRaw) || fromRaw;
								const toNode = self.Nodes.get(toRaw) ? toRaw : findNodeIdContaining.call(self, toRaw) || toRaw;

								const edgeId = KnowledgeGraphFunctions.makeEdgeId(fromNode, toNode, edgePropKey, typeID, self.Nodes);

								// remove if edge exists
								const edgeToRemove = self.Edges.get(edgeId);
								if (edgeToRemove) {
									self.graphModel.removeEdge(edgeId);

									const stillExists = self.Edges.get().some(e =>
										e.label === edgePropKey && (e.from !== title && e.to !== title)
									);

									if (!stillExists) {
										removeLegendEntry.call(self, edgePropKey);
									} 
									// else {
									// 	self.graphModel.removeNode(nodeId);
									// 	return;
									// }
									nodesExisting = self.Nodes.get();
									edgesExisting = self.Edges.get();

									const allEdges = self.Edges.get();
									const connectedEdges = allEdges.filter(e =>
										e.id !== edgeId && (e.from === nodeId || e.to === nodeId)
									);

									if (connectedEdges.length === 0) {
										recursiveDeleteAllChildren.call(self, nodeId);
										const nodeToClear = nodeId.split('#')[0];
										// recursiveDeleteAllChildren.call(self, nodeToClear);

										// if ((edgePropKey in self.PropIdPropLabelMap)) {
										// 	delete self.PropIdPropLabelMap[edgePropKey];
										// }

										nodesExisting = self.Nodes.get();
										edgesExisting = self.Edges.get();
									} else {
										self.graphModel.removeEdge(edgeId);

										// if ((edgePropKey in self.PropIdPropLabelMap)) {
										// 	delete self.PropIdPropLabelMap[edgePropKey];
										// }

										nodesExisting = self.Nodes.get();
										edgesExisting = self.Edges.get();
									}
									return;
								}

								function stripHashSuffix(str) {
									return str.split('#')[0];
								}

								const clickedPropertyNormalized = normalize(edgePropKey);

								const edgeToDelete = edgesExisting.find(edge => {
									if (!edge.id) return false;
									const parts = edge.id.split('→');
									if (parts.length < 3) return false;

									const fromPart = stripHashSuffix(parts[0]);
									const labelPart = parts[1];
									const toPart = stripHashSuffix(parts[2]);

									return (
										(
											(fromPart === stripHashSuffix(fromNode) && toPart === stripHashSuffix(toNode)) ||
											(fromPart === stripHashSuffix(toNode) && toPart === stripHashSuffix(fromNode))
										) &&
										normalize(labelPart) === clickedPropertyNormalized
									);
								});

								if (edgeToDelete) {
									self.graphModel.removeEdge(edgeToDelete.id);
									removeLegendEntry(edgePropKey);

									nodesExisting = self.Nodes.get();
									edgesExisting = self.Edges.get();

									const { from, to } = edgeToDelete;
									const maybeDeleteNode = from === keepNode ? to : from;

									const connectedEdges2 = self.Edges.get().filter(e =>
										(e.from === maybeDeleteNode || e.to === maybeDeleteNode) &&
										e.id !== edgeToDelete.id
									);

									if (connectedEdges2.length === 0) {
										recursiveDeleteAllChildren.call(self, maybeDeleteNode);
										nodesExisting = self.Nodes.get();
										edgesExisting = self.Edges.get();
									}
									return;
								}

								if (!nodesExisting.some(n => n.id === nodeId)) {
									let fontColor = KnowledgeGraphFunctions.getContrastColor(nodeColor);
									if (!fontColor) fontColor = '#000000';

									const nodeConfig = {
										id: nodeId,
										label: wrapLabel(displayLabel, 20),
										typeID: typeID,
										color: nodeColor,
										font: jQuery.extend({}, self.Config.graphOptions.nodes.font, {
											size: self.Config.graphOptions.nodes.font.size || 30,
											color: fontColor,
										}),
									};
									if (typeID === 9) {
										nodeConfig.shape = 'box';
										if (!self.Data[nodeId]) {
											const dataKey = nodeId.split('_')[0];
											self.Data[dataKey] = { properties: [] };
										}
									}

									if (!(edgePropKey in self.PropIdPropLabelMap)) {
										self.PropIdPropLabelMap[edgePropKey] = [];
									}
									self.PropIdPropLabelMap[edgePropKey].push(displayLabel);

									self.graphModel.addNode(nodeConfig);
									nodesExisting = self.Nodes.get();
									edgesExisting = self.Edges.get();
								}

								const edgeConfig = {
									id: edgeId,
									from: fromNode,
									to: toNode,
									label: edgePropKey,
								};
								if (typeID === 9) {
									edgeConfig.arrows = { to: { enabled: true } };
								}

								self.graphModel.addEdge(edgeConfig);
								if ($('#' + edgePropKey.replace(/ /g, '_')).length === 0) {
									addLegendEntry(edgePropKey, clickedProperty, nodeColor);
								}

								nodesExisting = self.Nodes.get();
								edgesExisting = self.Edges.get();
							});
						}
					});
				});
			} else if (params.edges && params.edges.length > 0) {
				// right click on edge
				const edgeId = params.edges[0];
				const edge = self.Edges.get(edgeId);
				if (!edge || !edge.label) return;
				const cleanedLabel = cleanLabel(edge.label);
				const propertyTitle = 'Property:' + cleanedLabel.replaceAll(' ', '_');

				const li = document.createElement('li');
				const baseUrl = mw.config.get('wgServer') + mw.config.get('wgScriptPath');
				const fullUrl = `${baseUrl}/index.php/${propertyTitle}`;
				li.classList.add('kg-node-properties-menu-edge-entry');
				li.innerHTML = '🔗 ' + cleanedLabel;
				li.addEventListener('click', () => window.open(fullUrl, '_blank'));

				$menu.append(li);
			}

			// position and show only this instance's menu
			$(`.kg-node-properties-menu`).not($menu).hide();
			$menu.finish().toggle(100).css({
				top: params.event.pageY + "px",
				left: params.event.pageX + "px",
				display: "block"
			});

			// hide when clicking outside
			$(document).one('click', function () {
				$menu.hide();
			});
		});
	}

	function recursiveDeleteAllChildren(nodeId) {
		const edges = self.Edges.get().filter(e => e.from === nodeId);
		edges.forEach(edge => {
			const childId = edge.to;
			recursiveDeleteAllChildren.call(self, childId);
			self.graphModel.removeEdge(edge.id);
			self.graphModel.removeNode(childId);
		});
		self.graphModel.removeNode(nodeId);
	}

	function fetchSemanticDataForNode(title, callback) {
		const cleanTitle = title.split('#')[0];
		const type = title.split('#')[1];
		if (type === '2') {
			callback([]);
			return;
		}
		mw.loader.using('mediawiki.api').then(function () {
			new mw.Api().get({
				action: "smwbrowse",
				format: "json",
				browse: "subject",
				params: JSON.stringify({
					subject: cleanTitle,
					ns: 0
				})
			}).done(function (data) {
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
			}).fail(function (err) {
				console.error("SMW browse API failed:", err);
				callback([]);
			});
		});
	}

	function fetchNamespaceNameForNode(title) {
		const parts = title.split('#');
		const nsId = parts.length > 1 ? parseInt(parts[1], 10) : 0;
		if (isNaN(nsId)) {
			return 'Main';
		}
		const nsMap = mw.config.get('wgFormattedNamespaces') || {};
		return nsMap[nsId] || 'Main';
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
		const props = self.nodePropertiesCache[nodeId];
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
		// set instance id from container (or generate)
		self.id = container && container.id ? container.id : 'knowledgegraph-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);

		self.InitialData = JSON.parse(JSON.stringify(config.data || {}));
		self.Config = config;
		self.Container = container;
		self.ContainerOptions = containerOptions;

		// toolbar setup
		if (config['show-toolbar']) {
			const toolbar = KnowledgeGraphToolbar.create(getOnSelectToolbar);
			const actionToolbar = KnowledgeGraphActionToolbar.create(getOnSelectActionToolbar);
			toolbar.$actions.append(actionToolbar.$element);
			toolbar.$element.appendTo(containerToolbar);
			$(self.ContainerOptions).toggle(false);
		}

		// per-instance datasets
		self.Data = {};
		self.Nodes = new vis.DataSet([]);
		self.Edges = new vis.DataSet([]);

		self.graphModel = {
			nodes: self.Nodes,
			edges: self.Edges,
			addNode: function (node) { if (!this.nodes.get(node.id)) this.nodes.add(node); },
			addEdge: function (edge) { if (!this.edges.get(edge.id)) this.edges.add(edge); },
			removeNode: function (nodeId) { if (this.nodes.get(nodeId)) this.nodes.remove(nodeId); },
			removeEdge: function (edgeId) { if (this.edges.get(edgeId)) this.edges.remove(edgeId); },
		};

		self.Config.graphOptions = self.Config.graphOptions || {};
		self.Config.graphOptions.interaction = self.Config.graphOptions.interaction || {};
		self.Config.graphOptions.interaction.hover = true;

		// create network for this instance
		self.Network = new vis.Network(
			self.Container,
			{ nodes: self.Nodes, edges: self.Edges },
			self.Config.graphOptions
		);

		// toolbar config message
		if (config['show-toolbar']) {
			self.Config.graphOptions.configure.enabled = false;
			const messageWidget = new OO.ui.MessageWidget({
				type: 'info',
				label: new OO.ui.HtmlSnippet(
					mw.msg(
						'knowledgegraph-graph-options-message',
						mw.config.get('wgArticlePath').replace('$1', 'MediaWiki:KnowledgeGraphOptions')
					)
				),
				invisibleLabel: false,
			});
			$(containerOptions).find('.vis-configuration.vis-config-option-container').prepend(messageWidget.$element);
		}

		// legend / properties panel - create per-instance legend element and attach below container
		if (self.Config['properties-panel']) {
			const LegendDiv = document.createElement('div');
			LegendDiv.style.position = 'relative';
			LegendDiv.id = `${self.id}-legend`; // unique id per instance
			LegendDiv.classList.add('knowledgegraph-legend');
			LegendDiv.dataset.instanceId = self.id;

			// insert right after container
			container.insertAdjacentElement('afterend', LegendDiv);

			// style default: flexible and auto height (so it adapts)
			LegendDiv.style.width = (self.Config.width && self.Config.width !== '') ? self.Config.width : '100%';
			LegendDiv.style.height = 'auto';
			// LegendDiv.style.margin = '8px auto 0 auto';
			// LegendDiv.style.display = 'flex';
			// LegendDiv.style.justifyContent = 'center';
			// LegendDiv.style.flexWrap = 'wrap';
			// LegendDiv.style.gap = '8px';

			LegendDiv.addEventListener("click", (e) => {
				if (e.target.classList.contains("legend-element-container")) {
					let id = e.target.id
						.replace(/^knowledgegraph-wrapper-\d+-/, '')
						.replace(/_/g, ' ');

					if (typeof dispatchEvent_LegendClick === "function") {
						dispatchEvent_LegendClick.call(self, e, id);
					} else if (self.dispatchEvent_LegendClick) {
						self.dispatchEvent_LegendClick(e, id);
					}
				}
			});

			self.LegendDiv = LegendDiv;
		}

		// create nodes from config data
		createNodes(self.Config.data || {});
		// attach context menu (per-instance)
		attachContextMenuListener();

		// events bound to this instance's network
		self.Network.on('click', function (params) {
			if (!params.nodes.length) return;
			HideNodesRec(params.nodes[0]);
		});

		self.Network.on('hoverNode', function (params) {
			const nodeId = params.node;
			if (self.SelectedNode !== nodeId) {
				self.SelectedNode = nodeId;
			}
		});

		self.Network.on('hoverEdge', function (params) {
			const edgeId = params.edge;
			if (self.SelectedNode !== edgeId) {
				self.SelectedNode = edgeId;
				self.Network.selectEdges([edgeId]);
			}
		});

		self.Network.on('blurNode', function () {
			self.Network.unselectAll();
		});

		self.Network.on('blurEdge', function () {
			self.SelectedNode = null;
			self.Network.unselectAll();
		});

		self.Network.on('doubleClick', function (params) {
			if (!params.nodes.length) return;

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

	// Caches loaded modules to avoid repeated dynamic imports
	const moduleCache = new Map();

	var semanticGraphs = JSON.parse(mw.config.get('knowledgegraphs'));

	async function getModule(str) {
		// Empty or non-string input should be ignored early
		if (typeof str !== "string" || str.trim() === "") {
			return null;
		}

		// Return from cache if already loaded
		if (moduleCache.has(str)) {
			return moduleCache.get(str);
		}

		try {
			// Convert JS string to Base64 ES module and load it
			const module = await import(`data:text/javascript;base64,${btoa(str)}`);

			// Use "default" export if available
			const result = module.default ?? null;

			// Store only successful results in cache
			moduleCache.set(str, result);

			return result;

		} catch (error) {
			// Log errors to help debugging faulty JS blocks in wiki pages
			console.error("KnowledgeGraph: Failed to load module:", error);
			return null;
		}
	}

	// Returns true only for plain objects (not arrays, not strings, not functions)
	function isPlainObject(value) {
		return (
			value !== null &&
			typeof value === "object" &&
			value.constructor === Object
		);
	}

	$('.KnowledgeGraph').each(async function (index) {
		// Retrieve semantic graph config by index
		const graphData = semanticGraphs[index];

		// Abort early if no config exists for this element
		if (!graphData) {
			console.warn("KnowledgeGraph: Missing graphData for index", index);
			return;
		}

		// Use existing DOM element
		var container = this;
		if (!container) {
			console.warn("KnowledgeGraph: Missing DOM container for index", index);
			return;
		}

		var graph = new KnowledgeGraph();

		// graphOptions may be a JS module string or an object; handle both cleanly
		if (typeof graphData.graphOptions === "string") {
			const result = await getModule(graphData.graphOptions);
			if (result) {
				graphData.graphOptions = result;
			}
		} else if (!isPlainObject(graphData.graphOptions)) {
			graphData.graphOptions = {};
		}

		// propertyOptions contains a map of property → JS module string or object
		if (isPlainObject(graphData.propertyOptions)) {
			for (const key in graphData.propertyOptions) {
				const value = graphData.propertyOptions[key];

				if (typeof value === "string") {
					const result = await getModule(value);
					if (result) {
						graphData.propertyOptions[key] = result;
					}
				} else if (!isPlainObject(value)) {
					graphData.propertyOptions[key] = {};
				}
			}
		} else {
			graphData.propertyOptions = {};
		}

		graphData.graphOptions = $.extend(
			KnowledgeGraphOptions.getDefaultOptions(),
			graphData.graphOptions
		);

		var config = $.extend(
			true,
			{
				data: {},
				propertyOptions: {},
				properties: [],
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
