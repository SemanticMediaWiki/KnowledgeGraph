/**
 * KnowledgeGraph
 *
 * @license GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

// Label/ID helpers and legend interaction/visibility-toggling state, extracted out
// of KnowledgeGraph.js (see issue #94). KnowledgeGraph.create( self ) wires these
// functions onto a per-instance `self` bag, exactly as KnowledgeGraph.js's own
// constructor closure did before the split -- callers keep using the same
// `this`/`self`-bound calling conventions (e.g. `dispatchLegendClickEvent.call( self, ... )`).
KnowledgeGraphLegend = ( function () {

	// Reduces a node/edge id to its comparable base title: trims whitespace,
	// normalizes underscores to spaces, and strips a trailing "#typeId" suffix.
	function checkAndToogleId( id ) {
		return id.trim().replace( /_/g, ' ' ).replace( /#.*$/, '' );
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

	function cleanLabel( label ) {
		label = label.trim();
		if ( label.startsWith( '-' ) ) {
			label = label.slice( 1 );
		}
		label = label.replace( /\s*\([^)]*\)$/, '' );
		return label.trim();
	}

	// Builds the legend/visibility-state functions for a single KnowledgeGraph
	// instance, bound to that instance's `self` bag.
	function create( self ) {

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

		return {
			addLegendEntry,
			removeLegendEntry,
			dispatchLegendClickEvent,
			HideNodesRec,
			recursiveDeleteAllChildren
		};
	}

	return {
		checkAndToogleId,
		wrapLabel,
		cleanLabel,
		create
	};
}() );
