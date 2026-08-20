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
			// Only toggle neighbors the wizard/#knowledgegraph call originally
			// selected for display (`wanted: true`, set once in createNodes() and
			// never touched again) -- not every neighbor depth-recursion happened
			// to load along the way. Otherwise a single click would reveal a pile
			// of never-selected properties the user has no way to have "expected"
			// back, since collapsing them first makes them indistinguishable
			// (by `hidden` alone) from the ones actually chosen.
			const children = self.Network.getConnectedNodes( nodeId )
				.filter( ( childNodeId ) => !( childNodeId in self.Data ) && self.Nodes.get( childNodeId ).wanted );

			if ( !children.length ) {
				return;
			}

			// A single click should collapse whatever is currently shown, or
			// (only once nothing is left showing) expand every wanted neighbor
			// back -- not flip each neighbor's hidden flag independently, which
			// would simultaneously hide the ones the user had shown while also
			// revealing the rest.
			const newHidden = children.some(
				( childNodeId ) => !self.Nodes.get( childNodeId ).hidden
			);

			const updateNodes = children.map( ( childNodeId ) => ( { id: childNodeId, hidden: newHidden } ) );

			const updateEdges = [];
			for ( const childNodeId of children ) {
				// keep the edge(s) directly connecting nodeId <-> childNodeId in
				// sync with the node -- otherwise a node can end up shown with
				// no visible edge to it (or vice versa).
				const connectedEdgeIds = self.Network.getConnectedEdges( childNodeId );
				for ( const edge of self.Edges.get( connectedEdgeIds ) ) {
					if ( edge.from === nodeId || edge.to === nodeId ) {
						updateEdges.push( { id: edge.id, hidden: newHidden } );
					}
				}
			}
			self.Nodes.update( updateNodes );
			self.Edges.update( updateEdges );
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
