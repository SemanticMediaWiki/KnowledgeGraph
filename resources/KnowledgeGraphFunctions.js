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

	// use d3 palette colors defined in wgKnowledgeGraphColorPalette
	function colorForPropertyLabel(label, colors, PropColors = {}) {
		if (PropColors[label]) return PropColors[label];
		const index = Object.keys(PropColors).length % colors.length;
		PropColors[label] = colors[index];
		return PropColors[label];
	}

	function getContrastColor(hexColor) {
		if (!hexColor.startsWith('#')) {
			hexColor = rgbToHex(hexColor);
		}

		hexColor = hexColor.replace('#', '');

		let r = parseInt(hexColor.substr(0, 2), 16);
		let g = parseInt(hexColor.substr(2, 2), 16);
		let b = parseInt(hexColor.substr(4, 2), 16);

		r /= 255; g /= 255; b /= 255;
		r = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
		g = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
		b = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

		let luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
		const blackLuminance = 0;

		const contrastWithBlack = (Math.max(luminance, blackLuminance) + 0.05) / 
								(Math.min(luminance, blackLuminance) + 0.05);

		if (contrastWithBlack < 7.5) {
			return '#FFFFFF';
		}

		return null;
	}

	function rgbToHex(rgb) {
		let result = rgb.match(/\d+/g);
		if (!result) return '#000000';
		let r = parseInt(result[0]).toString(16).padStart(2, '0');
		let g = parseInt(result[1]).toString(16).padStart(2, '0');
		let b = parseInt(result[2]).toString(16).padStart(2, '0');
		return `#${r}${g}${b}`;
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
		colorForPropertyLabel,
		getContrastColor,
		getNestedProp,
		makeEdgeId,
		makeNodeId
	};
})();