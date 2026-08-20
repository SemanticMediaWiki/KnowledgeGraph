/**
 * KnowledgeGraph
 *
 * @license GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

// Node/edge construction and API data-loading logic, extracted out of
// KnowledgeGraph.js (see issue #94). KnowledgeGraphNodes.create( self ) wires
// these functions onto a per-instance `self` bag, exactly as KnowledgeGraph.js's
// own constructor closure did before the split.
KnowledgeGraphNodes = ( function () {

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

	// Builds the node/edge/data-building functions for a single KnowledgeGraph
	// instance, bound to that instance's `self` bag.
	function create( self ) {

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
							KnowledgeGraphLegend.wrapLabel( baseLabel, 20 ),
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
				KnowledgeGraphLegend.wrapLabel( targetLabel, 20 );

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
						self.addLegendEntry( property.canonicalLabel, legendLabel, self.PropColors[ property.canonicalLabel ] );
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

		return {
			loadNodes,
			addArticleNode,
			getVisibleTargetLabels,
			buildNodeAndEdgeFromValue,
			createNodes,
			deleteNode
		};
	}

	return {
		resolveFormattedLink,
		create
	};
}() );
