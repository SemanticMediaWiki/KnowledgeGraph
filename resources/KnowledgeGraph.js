/**
 * KnowledgeGraph
 *
 * @license GPL-2.0-or-later
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
	self.id = null;
	self.LastDepth = null;
	self.LastSelectedTab = null;
	self.colors = mw.config.get( 'wgKnowledgeGraphColorPalette' );

	function addLegendEntry( id, label, color ) {
		if ( !self.LegendDiv ) {
			return;
		}

		const safeId = id.replace( / /g, '_' );
		const uniqueId = `${ self.id }-${ safeId }`;

		if ( self.LegendDiv.querySelector( `#${ CSS.escape( uniqueId ) }` ) ) {
			return;
		}

		let fontColor = KnowledgeGraphFunctions.getContrastColor( color );
		if ( !fontColor ) {
			fontColor = '#000000';
		}

		const container = document.createElement( 'button' );
		container.className = 'legend-element-container btn btn-outline-light';
		container.id = uniqueId;
		container.style.color = fontColor;
		container.style.background = color;
		container.innerHTML = label;

		container.dataset.active = true;
		container.dataset.activeColor = color;

		self.LegendDiv.append( container );
	}

	function removeLegendEntry( property ) {
		if ( !this.LegendDiv ) {
			return;
		}
		// use instance-specific ID
		const safeId = `${ this.id }-${ property.replace( / /g, '_' ) }`;
		const entry = this.LegendDiv.querySelector( `#${ CSS.escape( safeId ) }` );

		if ( entry ) {
			entry.remove();
			// eslint-disable-next-line no-console
			console.debug( `Legend entry removed for ${ property } in ${ this.id }` );
		}
	}

	function checkAndToogleId( id ) {
		return id.trim().replace( /_/g, ' ' ).replace( /#.*$/, '' );
	}

	function dispatchLegendClickEvent( event, id ) {
		if ( !this.LegendDiv ) {
			return;
		}

		const safeId = `${ this.id }-${ id.replace( / /g, '_' ) }`;
		const container = this.LegendDiv.querySelector( `#${ CSS.escape( safeId ) }` );
		if ( !container ) {
			return;
		}

		const isActive = container.dataset.active === 'true';
		container.dataset.active = ( !isActive ).toString();

		if ( isActive ) {
			container.style.background = '#FFFFFF';
			const fontColor = KnowledgeGraphFunctions.getContrastColor( container.style.background ) || '#000000';
			container.style.color = fontColor;
		} else {
			container.style.background = container.dataset.activeColor;
			const fontColor = KnowledgeGraphFunctions.getContrastColor( container.style.background ) || '#000000';
			container.style.color = fontColor;
		}

		const updateNodes = [];
		const visited = [];
		const instance = this;

		function toggleConnectedNodes( nodeId ) {
			if ( visited.includes( nodeId ) ) {
				return;
			}
			visited.push( nodeId );

			const connectedNodes = instance.Network.getConnectedNodes( nodeId );
			for ( const connectedNodeId of connectedNodes ) {
				const connectedEdgesIds = instance.Network.getConnectedEdges( connectedNodeId );
				const connectedEdges = instance.Edges.get( connectedEdgesIds );

				let found = false;
				for ( const edge of connectedEdges ) {
					if ( edge.to === nodeId || edge.from === nodeId ) {
						found = true;
						break;
					}
				}

				if ( !found ) {
					updateNodes.push( {
						id: connectedNodeId,
						hidden: container.dataset.active !== 'true'
					} );
					toggleConnectedNodes( connectedNodeId );
				}
			}
		}

		this.Nodes.forEach( ( node ) => {
			const idValue = checkAndToogleId( node.id );

			if ( this.PropIdPropLabelMap[ id ] === undefined ) {
				this.PropIdPropLabelMap[ id ] = [];
			}

			if (
				this.PropIdPropLabelMap[ id ].includes( idValue ) ||
				this.PropIdPropLabelMap[ id ].includes( node.id )
			) {
				updateNodes.push( {
					id: node.id,
					hidden: container.dataset.active !== 'true'
				} );
				toggleConnectedNodes( node.id );
			}
		} );

		this.Nodes.update( updateNodes );
	}

	function deleteNode( nodeId ) {
		const children = self.Network.getConnectedNodes( nodeId ).filter(
			( x ) => !( x in self.Data ) || self.Network.getConnectedNodes( x ).length === 1
		);
		children.push( nodeId );

		for ( const nid of children ) {
			self.Edges.remove( self.Network.getConnectedEdges( nid ) );
		}
		self.Nodes.remove( children );
		for ( const nid of children ) {
			delete self.Data[ nid ];
		}
	}

	function loadNodes( obj ) {
		self.LastDepth = obj.depth;

		let payload;
		if ( obj.title !== null && obj.properties === null ) {
			payload = {
				action: 'knowledgegraph-load-nodes',
				titles: obj.title,
				depth: obj.depth,
				properties: JSON.stringify( self.Config.properties )
			};
		} else if ( obj.properties !== null ) {
			if ( obj.properties === undefined ) {
				obj.properties = [];
			}
			payload = {
				action: 'knowledgegraph-load-properties',
				properties: obj.properties.join( '|' ),
				nodes: obj.titles,
				depth: obj.depth,
				limit: obj.limit,
				offset: obj.offset,
				inversePropsIncluded: obj.inversePropsIncluded
			};
		} else if ( obj.categories !== null ) {
			payload = {
				action: 'knowledgegraph-load-categories',
				categories: obj.categories.join( '|' ),
				depth: obj.depth,
				limit: obj.limit,
				offset: obj.offset
			};
		}

		return new Promise( ( resolve, reject ) => {
			mw.loader.using( 'mediawiki.api', () => {
				new mw.Api()
					.postWithToken( 'csrf', payload )
					.done( ( thisRes ) => {
						if ( 'data' in thisRes[ payload.action ] ) {
							const parsedData = JSON.parse( thisRes[ payload.action ].data );
							resolve( parsedData );
						} else {
							reject();
						}
					} )
					.fail( ( thisRes ) => {
						// eslint-disable-next-line no-console
						console.error( payload.action, thisRes );
						reject( thisRes );
					} );
			} );
		} );
	}

	function wrapLabel( text, maxLength ) {
		const words = text.split( ' ' );
		let wrapped = '';
		let line = '';

		for ( const word of words ) {
			if ( ( line + word ).length > maxLength ) {
				if ( line ) {
					wrapped += line.trim() + '\n';
				}
				line = word + ' ';
			} else {
				line += word + ' ';
			}
		}
		wrapped += line.trim();
		return wrapped;
	}

	function addArticleNode( data, label, options, typeID ) {
		if ( self.Nodes.get( label ) !== null ) {
			return;
		}

		const displayTitle = data[ label ] && data[ label ].displayTitle;
		const baseLabel = displayTitle || label.split( '#' )[ 0 ];

		const nodeConfig = jQuery.extend(
			JSON.parse( JSON.stringify( self.Config.graphOptions.nodes ) ),
			label in self.Config.propertyOptions ? self.Config.propertyOptions[ label ] : {},
			{
				id: label,
				label:
					baseLabel.length <= self.maxPropValueLength ?
						baseLabel :
						wrapLabel( baseLabel, 20 ),
				shape: 'box',
				font: jQuery.extend( {}, self.Config.graphOptions.nodes.font, {
					size: self.Config.graphOptions.nodes.font.size || 30
				} ),
				typeID: typeID || 9

				// https://visjs.github.io/vis-network/examples/network/other/popups.html
				// title: createHTMLTitle(label),
			},
			options || {}
		);

		if ( !( label in data ) ) {
			nodeConfig.color.border = 'red';
			nodeConfig.font.color = 'red';
			nodeConfig.color.background = 'white';
		}

		if ( data[ label ] === null ) {
			nodeConfig.opacity = 0.5;
			nodeConfig.shapeProperties = nodeConfig.shapeProperties || {};
			nodeConfig.shapeProperties.borderDashes = [ 5, 5 ];
		}

		if (
			data[ label ] &&
			data[ label ].src &&
			mw.config.get( 'KnowledgeGraphShowImages' ) === true
		) {
			nodeConfig.shape = 'image';
			nodeConfig.image = data[ label ].src;
		}

		self.Nodes.add( nodeConfig );
	}

	function getVisibleTargetLabels( data, wantedProperties ) {
		const visible = new Set();
		if ( !wantedProperties || !data[ wantedProperties.titleFullText ] ) {
			return visible;
		}
		const properties = data[ wantedProperties.titleFullText ].properties || {};
		for ( const propKey in properties ) {
			if ( !wantedProperties.wanted[ propKey ] ) {
				continue;
			}
			for ( const value of properties[ propKey ].values || [] ) {
				visible.add( value.value );
			}
		}
		return visible;
	}

	// Builds the node/edge identity and vis.DataSet configs for a single
	// server-canonical property value, following the same _wpg/default
	// branching createNodes() uses for the initial graph load -- shared so the
	// context-menu property-toggle handler creates nodes/edges with the exact
	// same ids createNodes() would have used for the same value, instead of
	// re-deriving them independently (see issue #100).
	function buildNodeAndEdgeFromValue( label, property, value, options, hidden ) {
		if ( property.typeId === '_wpg' ) {
			const wpgTargetLabel = value.value;
			const from = property.inverse ? wpgTargetLabel : label;
			const to = property.inverse ? label : wpgTargetLabel;
			const wpgEdgeId = KnowledgeGraphFunctions.makeEdgeId(
				from, to, property.canonicalLabel, 9, self.Nodes
			);

			return {
				targetId: wpgTargetLabel,
				edgeId: wpgEdgeId,
				edgeConfig: {
					id: wpgEdgeId,
					from,
					to,
					group: label,
					arrows: { to: { enabled: true } },
					hidden
				},
				nodeConfig: null, // caller uses addArticleNode() for _wpg targets
				targetLabel: wpgTargetLabel
			};
		}

		const targetLabel = value.value;
		const typeId = value.type !== undefined ? value.type : 2;
		const valueId = KnowledgeGraphFunctions.makeNodeId( targetLabel, typeId );
		const edgeLabel = property.canonicalLabel;
		const edgeId = KnowledgeGraphFunctions.makeEdgeId( label, valueId, edgeLabel );

		const displayLabel = targetLabel.length <= self.maxPropValueLength ?
			targetLabel :
			wrapLabel( targetLabel, 20 );

		return {
			targetId: valueId,
			edgeId,
			edgeConfig: {
				id: edgeId,
				from: label,
				to: valueId,
				group: label,
				hidden
			},
			nodeConfig: jQuery.extend( {}, options, {
				id: valueId,
				label: displayLabel,
				typeID: typeId,
				formattedUrl: value.formattedUrl || null,
				hasKeywordAskFormatter: property.linkFormatter && property.linkFormatter.kind === 'ask',
				askPropertyLabel: property.canonicalLabel,
				hidden
			} ),
			targetLabel
		};
	}

	function createNodes( data, wantedProperties ) {
		const visibleTargetLabels = getVisibleTargetLabels( data, wantedProperties );

		for ( const label in data ) {
			if ( label in self.Data && self.Data[ label ] !== null ) {
				continue;
			}

			const isRootArticle = !wantedProperties || label === wantedProperties.titleFullText;
			addArticleNode( data, label, {
				hidden: !isRootArticle && !visibleTargetLabels.has( label )
			} );

			if ( data[ label ] === null ) {
				continue;
			}

			if ( !( label in self.Categories ) ) {
				self.Categories[ label ] = [];
			}

			for ( const i in data[ label ].categories ) {
				const category = data[ label ].categories[ i ];
				if ( !self.Categories[ label ].includes( category ) ) {
					self.Categories[ label ].push( category );
				}
			}

			for ( const i in data[ label ].properties ) {
				const property = data[ label ].properties[ i ];

				const hidden = !!wantedProperties && (
					label === wantedProperties.titleFullText ?
						!wantedProperties.wanted[ i ] :
						true
				);

				if ( !( property.canonicalLabel in self.PropColors ) ) {
					if ( self.colors && self.colors.length > 0 ) {
						// use d3 palette colors defined in wgKnowledgeGraphColorPalette
						self.PropColors[ property.canonicalLabel ] = KnowledgeGraphFunctions.colorForPropertyLabel(
							property.canonicalLabel,
							self.colors,
							self.PropColors
						);
					} else {
						// use random HSL colors if no palette defined
						let randomColor;
						const colorExists = () => {
							for ( const j in self.PropColors ) {
								if ( self.PropColors[ j ] === randomColor ) {
									return true;
								}
							}
							return false;
						};
						do {
							randomColor = KnowledgeGraphFunctions.randomHSL();
						} while ( colorExists() );
						self.PropColors[ property.canonicalLabel ] = randomColor;
					}
				}

				let options =
					property.preferredLabel in self.Config.propertyOptions ?
						self.Config.propertyOptions[ property.preferredLabel ] :
						property.canonicalLabel in self.Config.propertyOptions ?
							self.Config.propertyOptions[ property.canonicalLabel ] :
							{};

				if ( 'nodes' in options ) {
					options = options.nodes;
				}
				if ( !( 'color' in options ) ) {
					const nodeColor = self.PropColors[ property.canonicalLabel ];
					const textColor = KnowledgeGraphFunctions.getContrastColor( nodeColor );

					options.color = {
						background: nodeColor,
						border: '#333',
						highlight: {
							background: nodeColor,
							border: '#000'
						}
					};

					// readable font color when background dark
					options.font = Object.assign( {}, options.font, {
						color: textColor
					} );
				}

				const legendLabel =
					property.preferredLabel !== '' ?
						property.preferredLabel :
						property.canonicalLabel;

				if ( !( legendLabel in self.PropIdPropLabelMap ) ) {
					self.PropIdPropLabelMap[ legendLabel ] = [];
				}

				const propLabel =
					legendLabel + ( !self.Config[ 'show-property-type' ] ? '' : ' (' + property.typeLabel + ')' );

				if ( self.Config[ 'properties-panel' ] ) {
					addLegendEntry( property.canonicalLabel, legendLabel, self.PropColors[ property.canonicalLabel ] );
				}

				switch ( property.typeId ) {
					case '_wpg':
						for ( const ii in property.values ) {
							const built = buildNodeAndEdgeFromValue( label, property, property.values[ ii ], options, hidden );
							self.PropIdPropLabelMap[ legendLabel ].push( built.targetLabel );

							const edgeConfig = jQuery.extend(
								JSON.parse( JSON.stringify( self.Config.graphOptions.edges ) ),
								built.edgeConfig,
								{ label: propLabel }
							);

							self.graphModel.addEdge( edgeConfig );

							if ( property.values[ ii ].src && mw.config.get( 'KnowledgeGraphShowImages' ) === true ) {
								options.shape = 'image';
								options.image = property.values[ ii ].src;
							}

							addArticleNode( data, built.targetLabel, jQuery.extend( {}, options, { hidden } ), 9 );
						}
						break;

					default:
					{
						const seen = new Set();
						for ( const value of property.values ) {
							if ( seen.has( value.value ) ) {
								continue;
							}
							seen.add( value.value );

							const built = buildNodeAndEdgeFromValue( label, property, value, options, hidden );
							self.PropIdPropLabelMap[ legendLabel ].push( built.targetId );

							self.Edges.add( jQuery.extend( {}, built.edgeConfig, { label: propLabel } ) );

							if ( !self.Nodes.get( built.targetId ) ) {
								self.Nodes.add( built.nodeConfig );
							}
						}
					}
				}
			}
		}
		self.Data = jQuery.extend( self.Data, data );
	}

	function HideNodesRec( nodeId ) {
		const children = self.Network.getConnectedNodes( nodeId );
		const updateNodes = [];
		for ( const childNodeId of children ) {
			if ( !( childNodeId in self.Data ) ) {
				updateNodes.push( {
					id: childNodeId,
					hidden: !self.Nodes.get( childNodeId ).hidden
				} );
			}
		}
		self.Nodes.update( updateNodes );
	}

	function getWantedProperties( thisDialog ) {
		const widgets = thisDialog.wantedPropertiesWidgets;
		if ( !widgets ) {
			return null;
		}
		const wanted = {};
		for ( const propKey in widgets ) {
			if ( widgets[ propKey ].isSelected() ) {
				wanted[ propKey ] = true;
			}
		}
		return wanted;
	}

	function getDialogActionProcessCallback( thisDialog, getActionProcess, action ) {
		switch ( action ) {
			case 'delete':
				// eslint-disable-next-line no-alert
				if ( confirm( mw.msg( 'knowledgegraph-delete-node-confirm' ) ) ) {
					deleteNode( self.SelectedNode );
					return new OO.ui.Process( () => {
						thisDialog.close( { action: action } );
					} );
				}
				break;
			case 'done':
				return new OO.ui.Process( () => {
					thisDialog.close( { action: action } ).then( () => {
						// createNodes(self.TmpData);
					} );
					let wantedProperties = null;
					if ( self.LastSelectedTab === 'by-article' && thisDialog.wantedPropertiesWidgets ) {
						const titleFullText = thisDialog.wantedPropertiesTitleFullText;
						const wanted = getWantedProperties( thisDialog );
						if ( titleFullText && wanted ) {
							wantedProperties = { titleFullText, wanted };
						}
					}
					createNodes( self.TmpData, wantedProperties );
					self.TmpData = {};
					thisDialog.wantedPropertiesWidgets = null;
					thisDialog.wantedPropertiesTitleFullText = null;
				} );
			case 'continue':
				return getActionProcess
					.call( thisDialog, action )
					.next( () => new Promise( ( resolve ) => {
						const selectedTab = thisDialog.indexLayout.getCurrentTabPanelName();
						let titleValue = null;
						let properties = null;
						let categories = null;
						let titles = null;
						let inversePropsIncluded = null;
						let titleFullText = null;
						let depth, limit, offset;

						switch ( selectedTab ) {
							case 'by-article': {
								titleValue = thisDialog.titleInputWidget.getValue();

								if ( titleValue === '' ) {
									resolve();
									return;
								}
								const ns = parseInt( thisDialog.namespaceDropdown.getValue() || 0, 10 );
								const titleObj = mw.Title.newFromText( titleValue, ns );

								if ( !titleObj ) {
									resolve();
									return;
								}
								titleFullText = titleObj.getPrefixedText();

								if ( titleFullText in self.Data ) {
									thisDialog.actions.setMode( 'existing-node' );
									thisDialog.initializeResultsPanel( 'existing-node' );
									resolve();
									return;
								}
								depth = thisDialog.depthInputWidget.getValue();
								break;
							}

							case 'by-properties': {
								properties = thisDialog.propertiesInputWidget.getValue();
								titles = thisDialog.titlesInputWidget.getValue();

								if ( !titles.length || !properties.length ) {
									resolve();
									return;
								}

								const existingTitles = [];
								const newTitles = [];

								for ( let i = 0; i < titles.length; i++ ) {
									const titleObj = mw.Title.newFromText( titles[ i ] );
									if ( !titleObj ) {
										continue;
									}

									const fullTitle = titleObj.getPrefixedText();
									if ( fullTitle in self.Data ) {
										existingTitles.push( fullTitle );
									} else {
										newTitles.push( fullTitle );
									}
								}

								if ( newTitles.length === 0 ) {
									thisDialog.actions.setMode( 'existing-node' );
									thisDialog.initializeResultsPanel( 'existing-node' );
									resolve();
									return;
								}
								thisDialog.titlesToProcess = newTitles;
								thisDialog.skippedTitles = existingTitles;
								depth = thisDialog.depthInputWidgetProperties.getValue();
								limit = thisDialog.limitInputWidgetProperties.getValue();
								offset = thisDialog.offsetInputWidgetProperties.getValue();
								inversePropsIncluded = thisDialog.includeInverseCheckbox.isSelected();
								break;
							}

							case 'by-categories': {
								categories = thisDialog.categoriesInputWidget.getValue();

								if ( !categories.length ) {
									resolve();
									return;
								}
								depth = thisDialog.depthInputWidgetCategories.getValue();
								limit = thisDialog.limitInputWidgetCategories.getValue();
								offset = thisDialog.offsetInputWidgetCategories.getValue();
								break;
							}
						}

						loadNodes( {
							title: titleValue,
							properties,
							categories,
							titles,
							inversePropsIncluded,
							depth: parseInt( depth ),
							limit: parseInt( limit ),
							offset: parseInt( offset )
						} )
							.then( ( data ) => {
								self.TmpData = data;
								self.LastSelectedTab = selectedTab;
								let mode;
								if ( selectedTab === 'by-article' ) {
									const ns = parseInt( thisDialog.namespaceDropdown.getValue() || 0, 10 );
									const titleObj = mw.Title.newFromText( titleValue, ns );
									titleFullText = titleObj ? titleObj.getPrefixedText() : titleValue;

									const articleProperties = data[ titleFullText ] || data[ titleValue ] || {};
									mode = Object.keys( articleProperties ).length ? 'show-results' : 'no-results';
								} else {
									mode = Object.keys( data ).length ? 'show-results' : 'no-results';
								}
								thisDialog.initializeResultsPanel( mode, selectedTab, data, selectedTab === 'by-article' ? titleFullText : null );
								thisDialog.actions.setMode( mode );
								resolve();
							} )
							.catch( ( err ) => {
								// eslint-disable-next-line no-console
								console.log( 'err loadNodes', err );
							} );
					} ) );

			case 'back':
				thisDialog.stackLayout.setItem( thisDialog.stackLayout.getItems()[ 0 ] );
				thisDialog.actions.setMode( 'select' );
				break;
		}
	}

	function getDialogOnSetupCallback( thisDialog, data ) {
		if ( data && data.nodeId ) {
			self.SelectedNode = data.nodeId;
			const mode = 'edit';
			thisDialog.initializeResultsPanel( mode );
			thisDialog.actions.setMode( mode );
		} else {
			thisDialog.actions.setMode( 'select' );
		}
	}

	function getDialogInitializeResultsPanel( thisDialog, mode, selectedTab, data, titleFullText ) {
		let $el;
		if ( mode === 'no-results' ) {
			const msg = mw.msg( selectedTab === 'by-article' ? 'knowledgegraph-dialog-results-no-properties' : 'knowledgegraph-dialog-results-no-articles' );
			$el = $( '<span>' + msg + '</span>' );
		} else if ( mode === 'existing-node' ) {
			$el = $( '<span>' + mw.msg( 'knowledgegraph-dialog-results-existing-node' ) + '</span>' );
		} else {
			switch ( selectedTab ) {
				case 'by-article': {
					thisDialog.panelB.$element.append( '<h3>' + mw.msg( 'knowledgegraph-dialog-results-has-properties' ) + '</h3>' );
					thisDialog.panelB.$element.append( '<p>' + mw.msg( 'knowledgegraph-dialog-results-select-properties-hint' ) + '</p>' );
					const properties = data[ titleFullText ].properties;
					const fieldset = new OO.ui.FieldsetLayout();
					thisDialog.wantedPropertiesWidgets = {};
					thisDialog.wantedPropertiesTitleFullText = titleFullText;
					for ( const i in properties ) {
						const label = properties[ i ].preferredLabel !== '' ? properties[ i ].preferredLabel : properties[ i ].canonicalLabel;
						const checkbox = new OO.ui.CheckboxInputWidget( { selected: false } );
						thisDialog.wantedPropertiesWidgets[ i ] = checkbox;
						fieldset.addItems( [
							new OO.ui.FieldLayout( checkbox, {
								label: label + ' (' + properties[ i ].typeLabel + ')',
								align: 'inline'
							} )
						] );
					}
					$el = fieldset.$element;
					break;
				}

				case 'by-properties': {
					$el = $( '<ul>' );
					if ( Object.keys( data ).some( ( i ) => !( i in self.Data ) && data[ i ] !== null ) ) {
						thisDialog.panelB.$element.append( '<h3>' + mw.msg( 'knowledgegraph-dialog-results-importing-nodes' ) + '</h3>' );

						const $newList = $( '<ul>' );
						for ( const i in data ) {
							if ( !( i in self.Data ) && data[ i ] !== null ) {
								const url = mw.config.get( 'wgArticlePath' ).replace( '$1', i );
								$newList.append( $( '<li><a target="_blank" href="' + url + '">' + i + '</a></li>' ) );
							}
						}
						thisDialog.panelB.$element.append( $newList );
					}

					if ( thisDialog.skippedTitles && thisDialog.skippedTitles.length > 0 ) {
						thisDialog.panelB.$element.append( '<h4>' + mw.msg( 'knowledgegraph-dialog-results-skipped-existing' ) + '</h4>' );
						const $skippedList = $( '<ul>' );
						thisDialog.skippedTitles.forEach( ( title ) => {
							const url = mw.config.get( 'wgArticlePath' ).replace( '$1', title );
							$skippedList.append( $( '<li><a target="_blank" href="' + url + '">' + title + '</a></li>' ) );
						} );
						thisDialog.panelB.$element.append( $skippedList );
					}
					break;
				}

				case 'by-categories': {
					thisDialog.panelB.$element.append( '<h3>' + mw.msg( 'knowledgegraph-dialog-results-importing-nodes' ) + '</h3>' );
					const $ul = $( '<ul>' );
					let newNodesCount = 0;
					for ( const i in data ) {
						if ( !( i in self.Data ) && data[ i ] !== null ) {
							const url = mw.config.get( 'wgArticlePath' ).replace( '$1', i );
							$ul.append( $( '<li><a target="_blank" href="' + url + '">' + i + '</a></li>' ) );
							newNodesCount++;
						}
					}
					if ( newNodesCount === 0 ) {
						thisDialog.panelB.$element.append( $( '<p>' + mw.msg( 'knowledgegraph-dialog-results-no-new-nodes' ) + '</p>' ) );
					} else {
						thisDialog.panelB.$element.append( $ul );
					}
					break;
				}
			}
		}
		return $el;
	}

	function openDialog( nodeId ) {
		self.Properties = {};
		self.TmpData = {};

		const windowManager = new OO.ui.WindowManager();
		$( document.body ).append( windowManager.$element );

		const myDialog = KnowledgeGraphDialog.create(
			self.Config,
			{ size: 'medium' },
			getDialogActionProcessCallback,
			getDialogOnSetupCallback,
			getDialogInitializeResultsPanel
		);

		windowManager.addWindows( [ myDialog ] );
		windowManager.openWindow( myDialog, { nodeId, title: nodeId } );
	}

	function getOnSelectToolbar() {
		const selfTool = this;
		const toolName = selfTool.getName();

		switch ( toolName ) {
			case 'add-node':
				openDialog( null );
				break;
			case 'export-graph':
				{
					const nodes = [];
					const properties = [];
					let propertyOptions = '';
					for ( const i in self.Data ) {
						if ( !nodes.includes( i ) ) {
							nodes.push( i );
						}
						if ( self.Data[ i ] === null ) {
							continue;
						}
						for ( const ii in self.Data[ i ].properties ) {
							const property = self.Data[ i ].properties[ ii ];
							if ( !properties.includes( property.canonicalLabel ) ) {
								properties.push( property.canonicalLabel );
								propertyOptions += `|property-options?${ property.canonicalLabel }=\n`;
							}
						}
					}

					const text = `{{#knowledgegraph:
nodes=${ nodes.join( ', ' ) }
|properties=${ properties.join( ', ' ) }
|depth=${ self.LastDepth !== null ? self.LastDepth : self.Config.depth }
|graph-options=
${ propertyOptions }|show-property-type=true
|width=400px
|height=400px
|properties-panel=false
|categories-panel=false
}}`;

					const legacyCopy = ( copyText ) => {
						const textarea = document.createElement( 'textarea' );
						textarea.value = copyText;
						textarea.style.position = 'fixed';
						document.body.appendChild( textarea );
						textarea.focus();
						textarea.select();
						try {
							document.execCommand( 'copy' );
							// eslint-disable-next-line no-alert
							alert( mw.msg( 'knowledgegraph-copied-to-clipboard' ) );
						} catch ( err ) {
							// eslint-disable-next-line no-alert
							alert( 'Copy failed' );
						}
						document.body.removeChild( textarea );
					};

					if ( navigator.clipboard ) {
						navigator.clipboard.writeText( text ).then( () => {
							// eslint-disable-next-line no-alert
							alert( mw.msg( 'knowledgegraph-copied-to-clipboard' ) );
						} ).catch( () => legacyCopy( text ) );
					} else {
						legacyCopy( text );
					}
				}
				break;
			case 'show-config':
				self.Config.graphOptions.configure.enabled = !self.Config.graphOptions.configure.enabled;
				$( self.ContainerOptions ).toggle( self.Config.graphOptions.configure.enabled );
				break;
			case 'reload':
				// eslint-disable-next-line no-alert
				if ( confirm( mw.msg( 'knowledgegraph-toolbar-reset-network-confirm' ) ) ) {
					if ( self.Network ) {
						self.Network.destroy();
					}
					self.Data = {};
					self.Nodes = new vis.DataSet( [] );
					self.Edges = new vis.DataSet( [] );

					self.graphModel = {
						nodes: self.Nodes,
						edges: self.Edges,
						addNode: function ( node ) {
							if ( !this.nodes.get( node.id ) ) {
								this.nodes.add( node );
							}
						},
						addEdge: function ( edge ) {
							if ( !this.edges.get( edge.id ) ) {
								this.edges.add( edge );
							}
						},
						removeNode: function ( nodeId ) {
							if ( this.nodes.get( nodeId ) ) {
								this.nodes.remove( nodeId );
							}
						},
						removeEdge: function ( edgeId ) {
							if ( this.edges.get( edgeId ) ) {
								this.edges.remove( edgeId );
							}
						}
					};

					self.Network = new vis.Network( self.Container, { nodes: self.Nodes, edges: self.Edges }, self.Config.graphOptions );

					createNodes( self.InitialData );
					attachContextMenuListener();
				}
				break;
		}

		this.setActive( false );
	}

	function getOnSelectActionToolbar() {
		const selfTool = this;
		const toolName = selfTool.getName();

		switch ( toolName ) {
			case 'help-button': {
				const HelpUrl = '';
				window.open( HelpUrl, '_blank' ).focus();
				break;
			}
			case 'info-button': {
				if ( self.WindowManagerNonModal ) {
					self.WindowManagerNonModal.getWindow( self.DialogCredits ).then( ( dialog ) => {
						if ( dialog.isOpened() ) {
							dialog.close();
						} else {
							dialog.open();
						}
						return;
					} );
					return;
				}

				self.WindowManagerNonModal = new OO.ui.WindowManager( {
					modal: false,
					classes: [ 'OOUI-dialogs-non-modal' ]
				} );

				$( document.body ).append( self.WindowManagerNonModal.$element );

				const windows = {
					[ self.DialogCredits ]: KnowledgeGraphNonModalDialog.create( { size: 'medium' } )
				};

				self.WindowManagerNonModal.addWindows( windows );
				self.WindowManagerNonModal.openWindow( self.DialogCredits, {} );
				break;
			}
		}
		this.setActive( false );
	}

	function attachContextMenuListener() {
		// Attach a listener for the "oncontext" event of the vis.Network instance
		self.Network.on( 'oncontext', ( params ) => {
			// Attempt to get the original DOM event from vis.Network's params
			// vis.js sometimes passes either 'event' or 'domEvent', depending on the version or context
			const domEvent = params.event || params.domEvent || null;

			// If no DOM event is available, or it doesn't have a preventDefault method, exit early
			// This prevents runtime errors when vis.Network calls the handler without a proper event
			if ( !domEvent || typeof domEvent.preventDefault !== 'function' ) {
				return; // No usable context event → nothing to do
			}

			// Prevent the default context menu from appearing
			domEvent.preventDefault();

			// Stop the event from propagating further up the DOM tree
			// Guarded call in case stopPropagation is undefined
			if ( typeof domEvent.stopPropagation === 'function' ) {
				domEvent.stopPropagation();
			}

			// pointer coordinates
			const pointer = { x: params.pointer.DOM.x, y: params.pointer.DOM.y };
			const edgeId = self.Network.getEdgeAt( pointer );
			const nodeId = self.Network.getNodeAt( pointer );

			if ( nodeId === undefined && edgeId === undefined ) {
				return;
			}

			// create/find per-instance menu
			let $menu = $( `.kg-node-properties-menu[data-instance-id="${ self.id }"]` );
			if ( !$menu.length ) {
				$menu = $( `<ul class="kg-node-properties-menu" data-instance-id="${ self.id }"></ul>` ).appendTo( 'body' ).hide();
			} else {
				$menu.empty();
			}

			// right click on node
			if ( nodeId !== undefined ) {
				const existingNodes = self.Nodes.get();
				const hashIndex = nodeId.indexOf( '#' );
				let titleLabel = nodeId.split( '#' )[ 0 ];
				const hashIndexTitle = titleLabel.indexOf( '#' );
				if ( hashIndexTitle !== -1 ) {
					titleLabel = titleLabel.slice( 0, Math.max( 0, hashIndexTitle ) );
				}
				const title = hashIndex !== -1 ? nodeId.slice( 0, Math.max( 0, hashIndex ) ) : nodeId;

				const currentNode = existingNodes.find( ( n ) => n.id === nodeId );
				const nodeTypeId = currentNode ? currentNode.typeID : null;

				const linkUrl = nodeTypeId === 9 ?
					mw.config.get( 'wgArticlePath' ).replace( '$1', titleLabel ) :
					resolveFormattedLink( currentNode, titleLabel );

				if ( linkUrl ) {
					const linkDisplayLabel = currentNode && currentNode.label ? currentNode.label.replace( /\n/g, ' ' ) : titleLabel;
					const liLink = document.createElement( 'li' );
					liLink.classList.add( 'kg-node-properties-menu-link-entry' );
					liLink.innerHTML = '🔗 ' + linkDisplayLabel;
					liLink.addEventListener( 'click', () => window.open( linkUrl, '_blank' ) );
					$menu.append( liLink );
				}

				// fetch semantic properties for clicked node -- via the same
				// server-canonical endpoint (knowledgegraph-load-nodes) the initial
				// graph load uses, so node/edge ids match exactly (see issue #100).
				// depth: 1 (not 0) -- KnowledgeGraph::setSemanticDataFromApi() treats
				// maxDepth === 0 as "root node only, skip loading its own SMW data
				// entirely" (a shortcut for placeholder/unexpanded nodes), which would
				// make every context-menu open report "no available properties";
				// depth: 1 loads this node's own properties without recursing into
				// its linked pages' properties (those recursive calls hit depth>=maxDepth
				// and return immediately, so they cost a cheap Title::isKnown() check
				// each but no additional API calls).
				loadNodes( { title, properties: null, depth: 1 } ).then( ( data ) => {
					const properties = ( data[ title ] && data[ title ].properties ) || {};
					const propKeys = Object.keys( properties );

					if ( propKeys.length === 0 ) {
						$menu.append( '<li>(No available properties)</li>' );
					} else {
						propKeys.forEach( ( propKey ) => {
							const property = properties[ propKey ];
							const legendLabel = property.preferredLabel || property.canonicalLabel || propKey;

							const li = document.createElement( 'li' );
							li.classList.add( 'kg-node-properties-menu-property-entry' );
							li.dataset.propKey = propKey;

							const displayName = legendLabel + ( property.inverse ? ' (inverse)' : '' );

							// check if this property's canonical edge already exists in the graph
							const existsInGraph = ( property.values || [] ).some( ( value ) => {
								const built = buildNodeAndEdgeFromValue( title, property, value, {}, false );
								return !!self.Edges.get( built.edgeId );
							} );

							if ( existsInGraph ) {
								li.classList.add( 'kg-node-properties-menu-property-entry-selected' );
							}

							li.innerHTML = '● ' + displayName;
							$menu.append( li );
						} );
					}

					// click handler for property entries
					$menu.find( 'li.kg-node-properties-menu-property-entry' ).off( 'click' ).on( 'click', ( ev ) => {
						const $li = $( ev.currentTarget );
						const propKey = $li.data( 'propKey' );
						$menu.hide();

						const property = properties[ propKey ];
						if ( !property ) {
							return;
						}

						const legendLabel = property.preferredLabel || property.canonicalLabel || propKey;

						if ( !( property.canonicalLabel in self.PropColors ) ) {
							if ( self.colors && self.colors.length > 0 ) {
								self.PropColors[ property.canonicalLabel ] = KnowledgeGraphFunctions.colorForPropertyLabel(
									property.canonicalLabel, self.colors, self.PropColors
								);
							} else {
								let randomColor;
								do {
									randomColor = KnowledgeGraphFunctions.randomHSL();
								} while ( Object.values( self.PropColors ).includes( randomColor ) );
								self.PropColors[ property.canonicalLabel ] = randomColor;
							}
						}
						const nodeColor = self.PropColors[ property.canonicalLabel ];

						( property.values || [] ).forEach( ( value ) => {
							const built = buildNodeAndEdgeFromValue( title, property, value, {}, false );
							const existingEdge = self.Edges.get( built.edgeId );

							if ( existingEdge ) {
								// toggle-OFF: the edge already exists (possibly hidden) --
								// flip its visibility, and that of its target node, rather
								// than removing/recreating it (matches the hidden-flag
								// visibility model used elsewhere, e.g. createNodes()).
								const newHidden = !existingEdge.hidden;
								self.Edges.update( { id: built.edgeId, hidden: newHidden } );
								if ( self.Nodes.get( built.targetId ) ) {
									self.Nodes.update( { id: built.targetId, hidden: newHidden } );
								}
								return;
							}

							// toggle-ON: build node+edge exactly as createNodes() would have.
							if ( built.nodeConfig && !self.Nodes.get( built.targetId ) ) {
								let fontColor = KnowledgeGraphFunctions.getContrastColor( nodeColor );
								if ( !fontColor ) {
									fontColor = '#000000';
								}
								self.graphModel.addNode( jQuery.extend( {}, built.nodeConfig, {
									label: wrapLabel( built.nodeConfig.label, 20 ),
									color: nodeColor,
									font: jQuery.extend( {}, self.Config.graphOptions.nodes.font, {
										size: self.Config.graphOptions.nodes.font.size || 30,
										color: fontColor
									} )
								} ) );
							} else if ( property.typeId === '_wpg' ) {
								addArticleNode( self.Data, built.targetId, {}, 9 );
							}

							self.graphModel.addEdge( jQuery.extend( {}, built.edgeConfig, { label: legendLabel } ) );

							if ( !( legendLabel in self.PropIdPropLabelMap ) ) {
								self.PropIdPropLabelMap[ legendLabel ] = [];
							}
							self.PropIdPropLabelMap[ legendLabel ].push( built.targetId );

							addLegendEntry( property.canonicalLabel, legendLabel, nodeColor );
						} );
					} );
				} ).catch( ( err ) => {
					// eslint-disable-next-line no-console
					console.error( 'loadNodes', err );
				} );
			} else if ( params.edges && params.edges.length > 0 ) {
				// right click on edge
				const clickedEdgeId = params.edges[ 0 ];
				const edge = self.Edges.get( clickedEdgeId );
				if ( !edge || !edge.label ) {
					return;
				}
				const cleanedLabel = cleanLabel( edge.label );
				const propertyTitle = 'Property:' + cleanedLabel.split( ' ' ).join( '_' );

				const li = document.createElement( 'li' );
				const baseUrl = mw.config.get( 'wgServer' ) + mw.config.get( 'wgScriptPath' );
				const fullUrl = `${ baseUrl }/index.php/${ propertyTitle }`;
				li.classList.add( 'kg-node-properties-menu-edge-entry' );
				li.innerHTML = '🔗 ' + cleanedLabel;
				li.addEventListener( 'click', () => window.open( fullUrl, '_blank' ) );

				$menu.append( li );
			}

			// position and show only this instance's menu
			$( '.kg-node-properties-menu' ).not( $menu ).hide();
			$menu.finish().toggle( 100 ).css( {
				top: params.event.pageY + 'px',
				left: params.event.pageX + 'px',
				display: 'block'
			} );

			// hide when clicking outside
			$( document ).one( 'click', () => {
				$menu.hide();
			} );
		} );
	}

	function recursiveDeleteAllChildren( nodeId ) {
		const edges = self.Edges.get().filter( ( e ) => e.from === nodeId );
		edges.forEach( ( edge ) => {
			const childId = edge.to;
			recursiveDeleteAllChildren.call( self, childId );
			self.graphModel.removeEdge( edge.id );
			self.graphModel.removeNode( childId );
		} );
		self.graphModel.removeNode( nodeId );
	}

	// Resolves the link a non-wikipage node should open (double-click/context-menu),
	// based on the link-formatter metadata KnowledgeGraph.php attached to the node:
	// an already-substituted External Identifier (_eid/_PEFU) URL, or a Keyword
	// (_keyw/_FORMAT_SCHEMA) node built client-side as a Special:Ask query. Returns
	// null when no formatter is configured, i.e. the value has nothing to link to.
	function resolveFormattedLink( node, valueLabel ) {
		if ( !node ) {
			return null;
		}

		if ( node.formattedUrl ) {
			return node.formattedUrl;
		}

		if ( node.hasKeywordAskFormatter && node.askPropertyLabel ) {
			const condition = `[[${ node.askPropertyLabel }::${ valueLabel }]]`;
			return mw.util.getUrl( 'Special:Ask', { q: condition } );
		}

		return null;
	}

	function cleanLabel( label ) {
		label = label.trim();
		if ( label.startsWith( '-' ) ) {
			label = label.slice( 1 );
		}
		label = label.replace( /\s*\([^)]*\)$/, '' );
		return label.trim();
	}

	// Exposed so tests can exercise functions that read self.Config (e.g. loadNodes)
	// without going through the full initialize() DOM/vis-network setup.
	function setConfig( config ) {
		self.Config = config;
	}

	function initialize( container, containerToolbar, containerOptions, config ) {
		// set instance id from container (or generate)
		self.id = container && container.id ? container.id : 'knowledgegraph-' + Date.now() + '-' + Math.random().toString( 36 ).slice( 2, 7 );

		self.InitialData = JSON.parse( JSON.stringify( config.data || {} ) );
		self.Config = config;
		self.Container = container;
		self.ContainerOptions = containerOptions;

		// toolbar setup
		if ( config[ 'show-toolbar' ] ) {
			const toolbar = KnowledgeGraphToolbar.create( getOnSelectToolbar );
			const actionToolbar = KnowledgeGraphActionToolbar.create( getOnSelectActionToolbar );
			toolbar.$actions.append( actionToolbar.$element );
			toolbar.$element.appendTo( containerToolbar );
			$( self.ContainerOptions ).toggle( false );
		}

		// per-instance datasets
		self.Data = {};
		self.Nodes = new vis.DataSet( [] );
		self.Edges = new vis.DataSet( [] );

		self.graphModel = {
			nodes: self.Nodes,
			edges: self.Edges,
			addNode: function ( node ) {
				if ( !this.nodes.get( node.id ) ) {
					this.nodes.add( node );
				}
			},
			addEdge: function ( edge ) {
				if ( !this.edges.get( edge.id ) ) {
					this.edges.add( edge );
				}
			},
			removeNode: function ( nodeId ) {
				if ( this.nodes.get( nodeId ) ) {
					this.nodes.remove( nodeId );
				}
			},
			removeEdge: function ( edgeId ) {
				if ( this.edges.get( edgeId ) ) {
					this.edges.remove( edgeId );
				}
			}
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
		if ( config[ 'show-toolbar' ] ) {
			self.Config.graphOptions.configure.enabled = false;
			const messageWidget = new OO.ui.MessageWidget( {
				type: 'info',
				label: new OO.ui.HtmlSnippet(
					mw.msg(
						'knowledgegraph-graph-options-message',
						mw.config.get( 'wgArticlePath' ).replace( '$1', 'MediaWiki:KnowledgeGraphOptions' )
					)
				),
				invisibleLabel: false
			} );
			$( containerOptions ).find( '.vis-configuration.vis-config-option-container' ).prepend( messageWidget.$element );
		}

		// legend / properties panel - create per-instance legend element and attach below container
		if ( self.Config[ 'properties-panel' ] ) {
			const LegendDiv = document.createElement( 'div' );
			LegendDiv.style.position = 'relative';
			LegendDiv.id = `${ self.id }-legend`; // unique id per instance
			LegendDiv.classList.add( 'knowledgegraph-legend' );
			LegendDiv.dataset.instanceId = self.id;

			// insert right after container
			container.insertAdjacentElement( 'afterend', LegendDiv );

			// style default: flexible and auto height (so it adapts)
			LegendDiv.style.width = ( self.Config.width && self.Config.width !== '' ) ? self.Config.width : '100%';
			LegendDiv.style.height = 'auto';
			// LegendDiv.style.margin = '8px auto 0 auto';
			// LegendDiv.style.display = 'flex';
			// LegendDiv.style.justifyContent = 'center';
			// LegendDiv.style.flexWrap = 'wrap';
			// LegendDiv.style.gap = '8px';

			LegendDiv.addEventListener( 'click', ( e ) => {
				if ( e.target.classList.contains( 'legend-element-container' ) ) {
					const id = e.target.id
						.replace( /^knowledgegraph-wrapper-\d+-/, '' )
						.replace( /_/g, ' ' );

					if ( typeof dispatchLegendClickEvent === 'function' ) {
						dispatchLegendClickEvent.call( self, e, id );
					} else if ( self.dispatchLegendClickEvent ) {
						self.dispatchLegendClickEvent( e, id );
					}
				}
			} );

			self.LegendDiv = LegendDiv;
		}

		// create nodes from config data
		createNodes( self.Config.data || {} );
		// attach context menu (per-instance)
		attachContextMenuListener();

		// events bound to this instance's network
		self.Network.on( 'click', ( params ) => {
			if ( !params.nodes.length ) {
				return;
			}
			HideNodesRec( params.nodes[ 0 ] );
		} );

		self.Network.on( 'hoverNode', ( params ) => {
			const nodeId = params.node;
			if ( self.SelectedNode !== nodeId ) {
				self.SelectedNode = nodeId;
			}
		} );

		self.Network.on( 'hoverEdge', ( params ) => {
			const edgeId = params.edge;
			if ( self.SelectedNode !== edgeId ) {
				self.SelectedNode = edgeId;
				self.Network.selectEdges( [ edgeId ] );
			}
		} );

		self.Network.on( 'blurNode', () => {
			self.Network.unselectAll();
		} );

		self.Network.on( 'blurEdge', () => {
			self.SelectedNode = null;
			self.Network.unselectAll();
		} );

		self.Network.on( 'doubleClick', ( params ) => {
			if ( !params.nodes.length ) {
				return;
			}

			const nodeId = params.nodes[ 0 ];
			if ( nodeId !== undefined ) {
				const titleLabel = nodeId.split( '#' )[ 0 ];
				const node = self.Nodes.get( nodeId );
				const nodeTypeId = node ? node.typeID : null;

				const url = nodeTypeId === 9 ?
					mw.config.get( 'wgArticlePath' ).replace( '$1', titleLabel ) :
					resolveFormattedLink( node, titleLabel );

				if ( url ) {
					window.open( url, '_blank' );
				}
			}
		} );
	}

	return {
		initialize,
		setConfig,
		checkAndToogleId,
		wrapLabel,
		cleanLabel,
		resolveFormattedLink,
		loadNodes,
		addLegendEntry,
		removeLegendEntry,
		dispatchLegendClickEvent,
		HideNodesRec,
		recursiveDeleteAllChildren,
		self
	};
};

// Returns true only for plain objects (not arrays, not strings, not functions).
// Attached to the KnowledgeGraph constructor (rather than kept as a closure
// inside the $( document ).ready() handler below) so it is reachable for
// testing, since JS closures have no other runtime escape hatch.
KnowledgeGraph.isPlainObject = function ( value ) {
	return (
		value !== null &&
		typeof value === 'object' &&
		value.constructor === Object
	);
};

$( document ).ready( async () => {

	// Caches loaded modules to avoid repeated dynamic imports
	const moduleCache = new Map();

	const semanticGraphs = JSON.parse( mw.config.get( 'knowledgegraphs' ) );

	async function getModule( str ) {
		// Empty or non-string input should be ignored early
		if ( typeof str !== 'string' || str.trim() === '' ) {
			return null;
		}

		// Return from cache if already loaded
		if ( moduleCache.has( str ) ) {
			return moduleCache.get( str );
		}

		try {
			// Convert JS string to Base64 ES module and load it
			const module = await import( `data:text/javascript;base64,${ btoa( str ) }` );

			// Use "default" export if available
			const result = module.default ?? null;

			// Store only successful results in cache
			moduleCache.set( str, result );

			return result;

		} catch ( error ) {
			// Log errors to help debugging faulty JS blocks in wiki pages
			// eslint-disable-next-line no-console
			console.error( 'KnowledgeGraph: Failed to load module:', error );
			return null;
		}
	}

	$( '.KnowledgeGraph' ).each( async function ( index ) {
		// Retrieve semantic graph config by index
		const graphData = semanticGraphs[ index ];

		// Abort early if no config exists for this element
		if ( !graphData ) {
			// eslint-disable-next-line no-console
			console.warn( 'KnowledgeGraph: Missing graphData for index', index );
			return;
		}

		// Use existing DOM element
		let container = this;
		if ( !container ) {
			// eslint-disable-next-line no-console
			console.warn( 'KnowledgeGraph: Missing DOM container for index', index );
			return;
		}

		try {
			const graph = new KnowledgeGraph();

			// graphOptions may be a JS module string or an object; handle both cleanly
			if ( typeof graphData.graphOptions === 'string' ) {
				const result = await getModule( graphData.graphOptions );
				if ( result ) {
					graphData.graphOptions = result;
				}
			} else if ( !KnowledgeGraph.isPlainObject( graphData.graphOptions ) ) {
				graphData.graphOptions = {};
			}

			// propertyOptions contains a map of property → JS module string or object
			if ( KnowledgeGraph.isPlainObject( graphData.propertyOptions ) ) {
				for ( const key in graphData.propertyOptions ) {
					const value = graphData.propertyOptions[ key ];

					if ( typeof value === 'string' ) {
						const result = await getModule( value );
						if ( result ) {
							graphData.propertyOptions[ key ] = result;
						}
					} else if ( !KnowledgeGraph.isPlainObject( value ) ) {
						graphData.propertyOptions[ key ] = {};
					}
				}
			} else {
				graphData.propertyOptions = {};
			}

			graphData.graphOptions = $.extend(
				KnowledgeGraphOptions.getDefaultOptions(),
				graphData.graphOptions
			);

			const config = $.extend(
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
					context: 'parserfunction'
				},
				graphData
			);

			if ( config.width !== '' ) {
				config.graphOptions.width = config.width;
			}
			if ( config.height !== '' ) {
				config.graphOptions.height = config.height;
			}

			container = this;
			let containerToolbar = null;
			let containerOptions = null;

			if ( config[ 'show-toolbar' ] ) {
				config.graphOptions.configure.enabled = true;
				if ( config.graphOptions.configure.container ) {
					containerOptions = config.graphOptions.configure.container;
					containerToolbar = document.createElement( 'div' );
					containerToolbar.insertBefore( container );
				} else {
					const $container = $( this ).clone();

					const $table = $(
						'<table class="KnowledgeGraphTable" style="height:' +
						config.height +
						';width:' +
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

					$table.find( '.KnowledgeGraph-network' ).append( $container );
					config.graphOptions.configure.container = $table
						.find( '.KnowledgeGraph-options > div' )
						.get( 0 );

					$( this ).replaceWith( $table );

					container = $container.get( 0 );
					containerToolbar = $table.find( '.KnowledgeGraph-toolbar' ).get( 0 );
					containerOptions = $table.find( '.KnowledgeGraph-options' ).get( 0 );
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

			graph.initialize( container, containerToolbar, containerOptions, config );
		} catch ( error ) {
			// eslint-disable-next-line no-console
			console.error( 'KnowledgeGraph: Failed to initialize graph at index', index, error );
			return;
		}
	} );
} );
