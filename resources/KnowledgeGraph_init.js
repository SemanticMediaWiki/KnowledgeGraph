/*@nomin*/
/* 
DEV: MediaWiki:KnowledgeGraph.js
REL: modules/ext.KnowledgeGraph/KnowledgeGraph.js
hint: ResourceLoader minifier does not support ES6 yet, therefore skip minification  with "nomin" (see https://phabricator.wikimedia.org/T255556)
*/

$(document).ready(function () {
	var semanticGraphs = JSON.parse(mw.config.get("knowledgegraphs"));

	$(".KnowledgeGraph").each(function (index) {
		var graphData = semanticGraphs[index];
		var defaultOptions = {
			root: "",
			properties: [],
			ignore_properties: [],
			permalink: false,
			sync_permalink: false,
			edit: false,
			hint: false,
			treat_non_existing_pages_as_literals: false,
			edge_labels: true,
		};

		defaultOptions.legacy_mode =
			mw.config.get("wgPageName").split(":")[0] === "Term";

		var config = $.extend(defaultOptions, graphData);
		config.root = config.root.replace(/_/g, " ");

		// force to false
		config.edit = false;

		config.properties = config.properties.map((x) => x.replace("_", " "));
		var graph = new isg.Graph(this, config);
	});
});
