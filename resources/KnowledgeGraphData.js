isg.Data = class {
	nodes = {};
	edged = {};
	editNodes = {};
	editDeletedNodes = {};
	editTargetNodes = [];

	constructor(config) {
		// create an array with nodes
		this.nodes = new vis.DataSet([]);
		// create an array with edges
		this.edges = new vis.DataSet([]);
		this.config = config || {}; //{uri_color_map: {"http://emmo.info/emmo#":  "blue"}};
	}

	//The function nodeExists() returns true, if the given node already exists, else false
	nodeExists(id) {
		const node = this.nodes.get(id);
		if (node === null) return false;
		else return id;
	}

	//The function edgeExists() returns true, if the given edge already exists, else false
	edgeExists(node1, edgeLabel, node2) {
		var res = this.edges.get().filter(function (edge) {
			return (
				edge.from === node1 && edge.label === edgeLabel && edge.to === node2
			);
		});
		var exits = res.length == 0 ? false : true;
		return exits;
	}

	fetchData(root, properties, nodeID, colors) {
		const deferred = $.Deferred();

		//split the query because due to results are wrong if a property and it's inverse version a queried at the same time
		var inverseProperties = properties.filter((p) =>
			isg.util.isLabelReversed(p)
		);
		var noninverseProperties = properties.filter(
			(p) => !isg.util.isLabelReversed(p)
		);
		var promises = [];
		var error_occured = false;

		promises.push(this.runQuery(root, noninverseProperties, nodeID, colors));
		promises.push(this.runQuery(root, inverseProperties, nodeID, colors));
		Promise.allSettled(promises).then(([result]) => {
			deferred.resolve(result);
		});
		return deferred.promise();
	}

	//Makes an API call with the given parameters and adds the results to the nodes and edges datasets.
	//With a given nodeID the edges are set to the nodeID, else they are set to the root node.
	runQuery(root, properties, nodeID, colors) {
		const deferred = $.Deferred();
		fetch(isg.util.getSmwQuery(root, properties))
			.then((response) => response.json())
			.then((data) => {
				if (!nodeID && root) {
					//first query on root node
					var rootNode = this.nodes.get(root);

					rootNode.url = data.query.results[root].fullurl;
					if (data.query.results[root].printouts["Display title of"].length)
						rootNode.label =
							data.query.results[root].printouts["Display title of"][0];
					else if (data.query.results[root].displaytitle)
						rootNode.label = data.query.results[root].displaytitle;
				}

				for (var i = 0; i < properties.length; i++) {
					var labelOffset = 0;
					for (
						var j = 0;
						j < data.query.results[root].printouts[properties[i]].length;
						j++
					) {
						var edgeLabel = properties[i];
						//handle inverse properties like normal ones
						var isReverseProperty = isg.util.isLabelReversed(edgeLabel);
						if (isReverseProperty) edgeLabel = isg.util.reverseLabel(edgeLabel);

						//define colors
						var edgeColor = colors[edgeLabel];
						var nodeColor = colors[edgeLabel];

						//define id and label. use displaytitle if available. Use string representation of non-page properties
						var id = isg.util.uuidv4(); //default: UUID
						var label = "";
						var isLiteral = true;
						var isNonExistingPage = false;

						if (data.query.results[root].printouts[properties[i]][j].fulltext) {
							if (
								data.query.results[root].printouts[properties[i]][j].exists ===
								"1"
							) {
								id =
									data.query.results[root].printouts[properties[i]][j].fulltext; //use pagename as id for pages
								isLiteral = isNonExistingPage = false;
							} else {
								isNonExistingPage = true;
								labelOffset += 1; //skip 'gap' in Display title of result array
								//if (input.treat_non_existing_pages_as_literals) {
								label =
									data.query.results[root].printouts[properties[i]][j].fulltext; //treat non existing pages as literals
								//}
								//else {
								//    id = data.query.results[root].printouts[properties[i]][j].fulltext; //use pagename as id for pages
								//}
							}
						} else if (
							data.query.results[root].printouts[properties[i]][j].value
						)
							label =
								"" +
								data.query.results[root].printouts[properties[i]][j].value +
								" " +
								data.query.results[root].printouts[properties[i]][j].unit; //quantity
						else if (
							data.query.results[root].printouts[properties[i]][j].timestamp
						)
							label = new Date(
								data.query.results[root].printouts[properties[i]][j].timestamp *
									1000
							).toISOString(); //datetime
						else if (
							data.query.results[root].printouts[properties[i]][j][
								"Language code"
							]
						)
							label =
								data.query.results[root].printouts[properties[i]][j]["Text"]
									.item[0] +
								" (" +
								data.query.results[root].printouts[properties[i]][j][
									"Language code"
								].item[0] +
								")"; //multi lang label
						else
							label =
								data.query.results[root].printouts[properties[i]][j].toString(); //other literals

						//if (!isNonExistingPage && data.query.results[root].printouts[properties[i] + ".HasLabel"][j+labelOffset]) label = data.query.results[root].printouts[properties[i] + ".HasLabel"][j+labelOffset]; //explicit use label in user language
						if (
							!isNonExistingPage &&
							data.query.results[root].printouts[
								properties[i] + ".Display title of"
							][j + labelOffset]
						)
							label =
								data.query.results[root].printouts[
									properties[i] + ".Display title of"
								][j + labelOffset]; //explicit use property display title due to slow update of the displaytitle page field
						else if (
							data.query.results[root].printouts[properties[i]][j].displaytitle
						)
							label =
								data.query.results[root].printouts[properties[i]][j]
									.displaytitle; //use display title of pages
						if (label === "") label = id; //default label is id

						if (isNonExistingPage) nodeColor = "#D3D3D3";
						if (isLiteral) nodeColor = "#FFFFFF";
						var shape = undefined;
						var image = undefined;
						if (
							id.includes("File:") &&
							(id.includes(".png") ||
								id.includes(".jpeg") ||
								id.includes(".jpg") ||
								id.includes(".tif") ||
								id.includes(".pdf") ||
								id.includes(".bmp") ||
								id.includes(".svg") ||
								id.includes(".gif"))
						) {
							image =
								mw.config.get("wgScriptPath") +
								`/index.php?title=Special:Redirect/file/${id.replace("File:", "")}&width=200&height=200`;
							shape = "image";
							label = "";
						}

						var uri =
							data.query.results[root].printouts[
								properties[i] + ".Equivalent URI"
							][j + labelOffset];
						if (uri && this.config.uri_color_map) {
							for (const key in this.config.uri_color_map) {
								if (uri.startsWith(key))
									nodeColor = this.config.uri_color_map[key];
							}
						}

						//if (!input.edge_labels) edgeLabel = undefined; //some features depend on the labels, so we can't simple remove them

						var sub = root; //subject
						if (nodeID) sub = nodeID;
						var obj = id;
						if (isReverseProperty) [sub, obj] = [obj, sub]; //swap sub and obj

						if (this.nodeExists(id) === false) {
							//test if node with id exists
							this.nodes.add({
								id: id,
								label: label,
								color: nodeColor,
								group: edgeLabel,
								hidden: false,
								url: data.query.results[root].printouts[properties[i]][j]
									.fullurl,
								isLiteral: isLiteral,
								image: image,
								shape: shape,
							});
							if (!this.edgeExists(sub, edgeLabel, obj)) {
								this.edges.add({
									from: sub,
									to: obj,
									label: edgeLabel,
									color: edgeColor,
									group: edgeLabel,
								});
							}
						} else if (!this.edgeExists(sub, edgeLabel, obj)) {
							this.edges.add({
								from: sub,
								to: obj,
								label: edgeLabel,
								color: edgeColor,
								group: edgeLabel,
							});
						}
					}
				}

				deferred.resolve({});
			});
		return deferred.promise();
	}

	//Makes an API call to retrieve the type of a given property
	fetchPropertyType(property) {
		//
	}

	//Called on save button click. Creates new wiki pages or edits them with the created wiki text.
	saveGraphChanges() {
		// ...
	}
};

