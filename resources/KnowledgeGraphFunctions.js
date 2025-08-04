/**
 * KnowledgeGraph
 *
 * @licence GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

KnowledgeGraphFunctions = (function () {
	function isObject(obj) {
		return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
	}

	function uuidv4() {
		return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
			(
				c ^
				(crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
			).toString(16)
		);
	}

	// @see  https://github.com/OpenSemanticLab/mediawiki-extensions-InteractiveSemanticGraph
	function randomHSL() {
		var golden = 0.618033988749895;
		var h = Math.random() + golden;
		h %= 1;
		return 'hsla(' + 360 * h + ',' + '70%,' + '80%,1)';
	}

	function getNestedProp(path, obj) {
		return path.reduce((xs, x) => (xs && xs[x] ? xs[x] : null), obj);
	}

	function makeNodeId(label, typeId) {
		return `${label}#${typeId}`;
	}

	function makeEdgeId(from, to, propLabel, typeId = null, Nodes = null) {
		if (!to.includes('#')) {
			if (typeId !== null) {
				to = `${to}#${typeId}`;
			} else if (Nodes) {
				const toNode = Nodes.get(to);
				if (toNode && typeof toNode.typeID !== 'undefined') {
					to = `${to}#${toNode.typeID}`;
				}
			}
		}

		return `${from}→${propLabel}→${to}`;
	}

	return {
		isObject,
		uuidv4,
		randomHSL,
		getNestedProp,
		makeEdgeId,
		makeNodeId
	};
})();
