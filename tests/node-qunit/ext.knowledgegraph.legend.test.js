'use strict';

// Covers KnowledgeGraph.js's legend/visibility state-toggle functions:
// addLegendEntry, removeLegendEntry, dispatchLegendClickEvent (including
// nested toggleConnectedNodes), HideNodesRec, recursiveDeleteAllChildren.
//
// These are internal closures over `self`; the constructor exposes `self`
// itself on the returned object (test-only escape hatch, see the return
// statement at the bottom of resources/KnowledgeGraph.js) so tests can seed
// and inspect instance state (LegendDiv, id, Nodes, Edges, Network, Data,
// PropIdPropLabelMap, graphModel) that has no dedicated public setter.
//
// @see https://github.com/SemanticMediaWiki/KnowledgeGraph/issues/89
QUnit.module( 'ext.knowledgegraph.legend', ( hooks ) => {

	let graph;

	hooks.beforeEach( () => {
		graph = new KnowledgeGraph();
	} );

	QUnit.module( 'addLegendEntry', () => {

		QUnit.test( 'is a no-op when self.LegendDiv is not set', ( assert ) => {
			graph.addLegendEntry( 'Has_Author', 'Author', '#ff0000' );
			assert.strictEqual( graph.self.LegendDiv, null, 'LegendDiv remains unset' );
		} );

		QUnit.test( 'skips creating a duplicate entry when the computed uniqueId already exists', ( assert ) => {
			graph.self.LegendDiv = document.createElement( 'div' );
			graph.self.id = 'g1';

			graph.addLegendEntry( 'Has_Author', 'Author', '#ff0000' );
			assert.strictEqual( graph.self.LegendDiv.children.length, 1, 'the first call creates one entry' );

			graph.addLegendEntry( 'Has_Author', 'Author (again)', '#00ff00' );
			assert.strictEqual( graph.self.LegendDiv.children.length, 1, 'a second call with the same id is a no-op' );
			assert.strictEqual(
				graph.self.LegendDiv.children[ 0 ].innerHTML,
				'Author',
				'the existing entry is left untouched'
			);
		} );

		QUnit.test( 'creates a button with the expected class, id, colors, dataset, and label content', ( assert ) => {
			graph.self.LegendDiv = document.createElement( 'div' );
			graph.self.id = 'g1';

			graph.addLegendEntry( 'Has Author', 'Author', '#ff0000' );

			const button = graph.self.LegendDiv.children[ 0 ];
			assert.strictEqual( button.tagName, 'BUTTON', 'a <button> element is created' );
			assert.strictEqual(
				button.className,
				'legend-element-container btn btn-outline-light',
				'the expected class list is set'
			);
			assert.strictEqual( button.id, 'g1-Has_Author', 'the id is "{self.id}-{safeId}" with spaces replaced by underscores' );
			assert.strictEqual( button.style.background, '#ff0000', 'the background color is set from the color argument' );
			assert.strictEqual( button.innerHTML, 'Author', 'the label is used as the button content' );
			assert.strictEqual( button.dataset.active, 'true', 'dataset.active is set to true (coerced to a string, as with a real DOMStringMap)' );
			assert.strictEqual( button.dataset.activeColor, '#ff0000', 'dataset.activeColor is set to the color argument' );
			assert.strictEqual( graph.self.LegendDiv.children.length, 1, 'the button is appended to self.LegendDiv' );
		} );

		QUnit.test( 'computes the font color via KnowledgeGraphFunctions.getContrastColor', ( assert ) => {
			graph.self.LegendDiv = document.createElement( 'div' );
			graph.self.id = 'g1';

			graph.addLegendEntry( 'Has_Author', 'Author', '#000000' );

			assert.strictEqual(
				graph.self.LegendDiv.children[ 0 ].style.color,
				'#FFFFFF',
				'a dark background resolves to a white contrast color'
			);
		} );

		QUnit.test( 'falls back to \'#000000\' as the font color when getContrastColor returns falsy', ( assert ) => {
			graph.self.LegendDiv = document.createElement( 'div' );
			graph.self.id = 'g1';

			// getContrastColor( '#ffffff' ) returns null (contrast with black below threshold).
			graph.addLegendEntry( 'Has_Author', 'Author', '#ffffff' );

			assert.strictEqual(
				graph.self.LegendDiv.children[ 0 ].style.color,
				'#000000',
				'the font color falls back to \'#000000\''
			);
		} );

	} );

	QUnit.module( 'removeLegendEntry', () => {

		QUnit.test( 'is a no-op when self.LegendDiv is not set', ( assert ) => {
			assert.strictEqual( graph.self.LegendDiv, null );
			graph.removeLegendEntry.call( graph.self, 'Has_Author' );
			assert.strictEqual( graph.self.LegendDiv, null, 'remains unset, no throw' );
		} );

		QUnit.test( 'removes the matching entry element when found', ( assert ) => {
			graph.self.LegendDiv = document.createElement( 'div' );
			graph.self.id = 'g1';
			graph.addLegendEntry( 'Has_Author', 'Author', '#ff0000' );
			assert.strictEqual( graph.self.LegendDiv.children.length, 1, 'entry exists before removal' );

			graph.removeLegendEntry.call( graph.self, 'Has_Author' );

			assert.strictEqual( graph.self.LegendDiv.children.length, 0, 'the entry is removed' );
		} );

		QUnit.test( 'is a no-op (no throw) when no matching entry is found', ( assert ) => {
			graph.self.LegendDiv = document.createElement( 'div' );
			graph.self.id = 'g1';

			graph.removeLegendEntry.call( graph.self, 'Missing_Property' );

			assert.strictEqual( graph.self.LegendDiv.children.length, 0, 'no entries existed and none were added' );
		} );

	} );

	QUnit.module( 'dispatchLegendClickEvent', () => {

		QUnit.test( 'is a no-op when self.LegendDiv is not set', ( assert ) => {
			graph.self.id = 'g1';
			// Would throw on this.Nodes.forEach(...) if execution continued past the guard.
			graph.dispatchLegendClickEvent.call( graph.self, {}, 'Has_Author' );
			assert.true( true, 'returns without throwing' );
		} );

		QUnit.test( 'is a no-op when the target legend container is not found', ( assert ) => {
			graph.self.LegendDiv = document.createElement( 'div' );
			graph.self.id = 'g1';
			// No entry for 'Has_Author' was ever added, so the container lookup fails.
			graph.dispatchLegendClickEvent.call( graph.self, {}, 'Has_Author' );
			assert.true( true, 'returns without throwing' );
		} );

		QUnit.test( 'toggles dataset.active and background/font color from active to inactive', ( assert ) => {
			graph.self.LegendDiv = document.createElement( 'div' );
			graph.self.id = 'g1';
			graph.self.PropIdPropLabelMap = {};
			graph.self.Nodes = new vis.DataSet( [] );
			graph.self.Edges = new vis.DataSet( [] );
			graph.self.Network = { getConnectedNodes: () => [], getConnectedEdges: () => [] };
			graph.addLegendEntry( 'Has_Author', 'Author', '#ff0000' );

			const button = graph.self.LegendDiv.children[ 0 ];
			assert.strictEqual( button.dataset.active, 'true', 'starts active' );

			graph.dispatchLegendClickEvent.call( graph.self, {}, 'Has_Author' );

			assert.strictEqual( button.dataset.active, 'false', 'dataset.active toggles to "false"' );
			assert.strictEqual( button.style.background, '#FFFFFF', 'inactive uses a white background' );
			assert.strictEqual( button.style.color, '#000000', 'inactive uses the contrast text color for white' );
		} );

		QUnit.test( 'toggles dataset.active and background/font color from inactive back to active', ( assert ) => {
			graph.self.LegendDiv = document.createElement( 'div' );
			graph.self.id = 'g1';
			graph.self.PropIdPropLabelMap = {};
			graph.self.Nodes = new vis.DataSet( [] );
			graph.self.Edges = new vis.DataSet( [] );
			graph.self.Network = { getConnectedNodes: () => [], getConnectedEdges: () => [] };
			graph.addLegendEntry( 'Has_Author', 'Author', '#ff0000' );
			const button = graph.self.LegendDiv.children[ 0 ];

			// First click: active -> inactive.
			graph.dispatchLegendClickEvent.call( graph.self, {}, 'Has_Author' );
			// Second click: inactive -> active again.
			graph.dispatchLegendClickEvent.call( graph.self, {}, 'Has_Author' );

			assert.strictEqual( button.dataset.active, 'true', 'dataset.active toggles back to "true"' );
			assert.strictEqual( button.style.background, '#ff0000', 'the original activeColor background is restored' );
			assert.strictEqual( button.style.color, '#FFFFFF', 'the contrast color for the restored background is used' );
		} );

		QUnit.test( 'updates nodes directly mapped to the clicked legend id via PropIdPropLabelMap', ( assert ) => {
			graph.self.LegendDiv = document.createElement( 'div' );
			graph.self.id = 'g1';
			// eslint-disable-next-line camelcase
			graph.self.PropIdPropLabelMap = { Has_Author: [ 'NodeA' ] };
			graph.self.Nodes = new vis.DataSet( [ { id: 'NodeA' }, { id: 'NodeB' } ] );
			graph.self.Edges = new vis.DataSet( [] );
			graph.self.Network = { getConnectedNodes: () => [], getConnectedEdges: () => [] };
			graph.addLegendEntry( 'Has_Author', 'Author', '#ff0000' );

			graph.dispatchLegendClickEvent.call( graph.self, {}, 'Has_Author' );

			assert.strictEqual( graph.self.Nodes.get( 'NodeA' ).hidden, true, 'the mapped node is hidden after toggling off' );
			assert.strictEqual( graph.self.Nodes.get( 'NodeB' ).hidden, undefined, 'an unrelated node is left untouched' );
		} );

		QUnit.module( 'toggleConnectedNodes recursion', () => {

			QUnit.test( 'does not revisit an already-visited node id (no infinite loop on a cycle)', ( assert ) => {
				graph.self.LegendDiv = document.createElement( 'div' );
				graph.self.id = 'g1';
				// eslint-disable-next-line camelcase
				graph.self.PropIdPropLabelMap = { Has_Author: [ 'NodeA' ] };
				graph.self.Nodes = new vis.DataSet( [ { id: 'NodeA' }, { id: 'NodeB' } ] );
				graph.self.Edges = new vis.DataSet( [] );

				const getConnectedNodesCalls = [];
				// NodeA <-> NodeB form a 2-cycle with no direct edge between them recorded
				// in self.Edges, so toggleConnectedNodes descends into both directions;
				// the `visited` guard must stop it from looping forever.
				graph.self.Network = {
					getConnectedNodes( nodeId ) {
						getConnectedNodesCalls.push( nodeId );
						if ( nodeId === 'NodeA' ) {
							return [ 'NodeB' ];
						}
						if ( nodeId === 'NodeB' ) {
							return [ 'NodeA' ];
						}
						return [];
					},
					getConnectedEdges: () => []
				};
				graph.addLegendEntry( 'Has_Author', 'Author', '#ff0000' );

				graph.dispatchLegendClickEvent.call( graph.self, {}, 'Has_Author' );

				assert.strictEqual(
					getConnectedNodesCalls.filter( ( id ) => id === 'NodeA' ).length,
					1,
					'getConnectedNodes is called for NodeA only once despite the cycle'
				);
				assert.strictEqual(
					getConnectedNodesCalls.filter( ( id ) => id === 'NodeB' ).length,
					1,
					'getConnectedNodes is called for NodeB only once despite the cycle'
				);
			} );

			QUnit.test( 'collects connected nodes not already linked by a direct edge to the toggled node', ( assert ) => {
				graph.self.LegendDiv = document.createElement( 'div' );
				graph.self.id = 'g1';
				// eslint-disable-next-line camelcase
				graph.self.PropIdPropLabelMap = { Has_Author: [ 'NodeA' ] };
				graph.self.Nodes = new vis.DataSet( [ { id: 'NodeA' }, { id: 'NodeB' }, { id: 'NodeC' } ] );
				// An edge directly connects NodeA and NodeB, so NodeB is excluded from
				// the recursive toggle (the `found` guard in toggleConnectedNodes);
				// NodeC has no such edge, so it should be toggled.
				graph.self.Edges = new vis.DataSet( [
					{ id: 'e1', from: 'NodeA', to: 'NodeB' }
				] );
				graph.self.Network = {
					getConnectedNodes( nodeId ) {
						return nodeId === 'NodeA' ? [ 'NodeB', 'NodeC' ] : [];
					},
					getConnectedEdges( nodeId ) {
						return nodeId === 'NodeB' ? [ 'e1' ] : [];
					}
				};
				graph.addLegendEntry( 'Has_Author', 'Author', '#ff0000' );

				graph.dispatchLegendClickEvent.call( graph.self, {}, 'Has_Author' );

				assert.strictEqual( graph.self.Nodes.get( 'NodeB' ).hidden, undefined, 'NodeB is excluded (directly edge-connected)' );
				assert.strictEqual( graph.self.Nodes.get( 'NodeC' ).hidden, true, 'NodeC is toggled (no direct edge found)' );
			} );

		} );

	} );

	QUnit.module( 'HideNodesRec', () => {

		QUnit.test( 'builds updateNodes only for connected nodes not present in self.Data, toggling their hidden state', ( assert ) => {
			graph.self.Data = { NodeInData: {} };
			graph.self.Nodes = new vis.DataSet( [
				{ id: 'NodeInData' },
				{ id: 'NodeNotInData', hidden: false },
				{ id: 'NodeAlreadyHidden', hidden: true }
			] );
			graph.self.Network = {
				getConnectedNodes: () => [ 'NodeInData', 'NodeNotInData', 'NodeAlreadyHidden' ]
			};

			graph.HideNodesRec( 'Root' );

			assert.strictEqual( graph.self.Nodes.get( 'NodeInData' ).hidden, undefined, 'a node present in self.Data is skipped' );
			assert.strictEqual( graph.self.Nodes.get( 'NodeNotInData' ).hidden, true, 'a visible node not in self.Data is hidden' );
			assert.strictEqual( graph.self.Nodes.get( 'NodeAlreadyHidden' ).hidden, false, 'a hidden node not in self.Data is un-hidden' );
		} );

		QUnit.test( 'calls self.Nodes.update with the expected payload', ( assert ) => {
			graph.self.Data = {};
			graph.self.Nodes = new vis.DataSet( [ { id: 'A', hidden: false } ] );
			let updatePayload;
			graph.self.Nodes.update = ( payload ) => {
				updatePayload = payload;
			};
			graph.self.Network = { getConnectedNodes: () => [ 'A' ] };

			graph.HideNodesRec( 'Root' );

			assert.deepEqual( updatePayload, [ { id: 'A', hidden: true } ], 'update is called with the computed toggle list' );
		} );

	} );

	QUnit.module( 'recursiveDeleteAllChildren', () => {

		// Fixture: a 3-level chain Root -> Mid -> Leaf.
		function makeChainFixture() {
			const edges = [
				{ id: 'e-root-mid', from: 'Root', to: 'Mid' },
				{ id: 'e-mid-leaf', from: 'Mid', to: 'Leaf' }
			];
			const calls = [];
			graph.self.Edges = new vis.DataSet( edges );
			graph.self.graphModel = {
				removeEdge: ( edgeId ) => calls.push( { op: 'removeEdge', id: edgeId } ),
				removeNode: ( nodeId ) => calls.push( { op: 'removeNode', id: nodeId } )
			};
			return calls;
		}

		QUnit.test( 'recursively removes edges/nodes for each descendant before removing the parent node', ( assert ) => {
			const calls = makeChainFixture();

			graph.recursiveDeleteAllChildren.call( graph.self, 'Root' );

			// The recursive call for a child happens before that child's own
			// removeEdge/removeNode calls, so the leaf's removeNode fires once from
			// its own (edge-less) base case, then again from the Mid-level loop
			// iteration that recursed into it -- same for Mid/Leaf up one level.
			assert.deepEqual(
				calls,
				[
					{ op: 'removeNode', id: 'Leaf' },
					{ op: 'removeEdge', id: 'e-mid-leaf' },
					{ op: 'removeNode', id: 'Leaf' },
					{ op: 'removeNode', id: 'Mid' },
					{ op: 'removeEdge', id: 'e-root-mid' },
					{ op: 'removeNode', id: 'Mid' },
					{ op: 'removeNode', id: 'Root' }
				],
				'the deepest descendant is fully removed before its ancestors, ending with the parent node itself'
			);
		} );

		QUnit.test( 'removes only the node itself when it has no child edges', ( assert ) => {
			graph.self.Edges = new vis.DataSet( [] );
			const calls = [];
			graph.self.graphModel = {
				removeEdge: ( edgeId ) => calls.push( { op: 'removeEdge', id: edgeId } ),
				removeNode: ( nodeId ) => calls.push( { op: 'removeNode', id: nodeId } )
			};

			graph.recursiveDeleteAllChildren.call( graph.self, 'Leaf' );

			assert.deepEqual( calls, [ { op: 'removeNode', id: 'Leaf' } ], 'no edges to recurse into, only the node is removed' );
		} );

	} );

} );
