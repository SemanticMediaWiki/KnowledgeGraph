/**
 * KnowledgeGraph
 *
 * @licence GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

KnowledgeGraphOptions = {
	getDefaultOptions: function () {
		return {
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
	},
};

