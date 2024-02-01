mwjson.util = class {
	constructor() {
	}

	static getShortUid() {
		return (performance.now().toString(36) + Math.random().toString(36)).replace(/\./g, "");
	}
 
	static uuidv4(prefixedUuid) {
		if (prefixedUuid) { //e. g. OSW83e54febeb444c7484b3c7a81b5ba2fd
			var uuid = prefixedUuid.replace(/[^a-fA-F0-9]/g, '');
			uuid = uuid.slice(-32);
			uuid = uuid.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/g, '$1-$2-$3-$4-$5');
			return uuid;
		}
		else return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
			(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
		);
	}

	static OslId(uuid) {
		console.log("OslId is deprecated. Please use mwjson.util.OswId");
		return mwjson.util.OswId(uuid);
	}

	static OswId(uuid) {
		if (!uuid) uuid = mwjson.util.uuidv4();
		return "OSW" + uuid.replaceAll("-", "");
	}

	static isPascalCase(str) {
		return str.match(/[^a-zA-Z0-9]+(.)/g) === null 
		  && str.charAt(0).toUpperCase() == str.charAt(0);
	}
	
	static isCamelCase(str) {
		return str.match(/[^a-zA-Z0-9]+(.)/g) === null 
		  && str.charAt(0).toLowerCase() == str.charAt(0);
	}

	static toPascalCase(str) {
		if (mwjson.util.isPascalCase(str)) return str;
		str = str.charAt(0).toUpperCase() + str.slice(1);
		if (mwjson.util.isPascalCase(str)) return str;
		var camelCase = mwjson.util.toCamelCase(str);
		return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
	}
	
	static toCamelCase(str) {
		if (mwjson.util.isCamelCase(str)) return str;
		str = str.charAt(0).toLowerCase() + str.slice(1);
		if (mwjson.util.isCamelCase(str)) return str;
		return str.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
	}

	static valueIfExists(value, default_value = "") {
		if (value) return value;
		else return default_value;
	}

	static stripNamespace(title) {
		if (title.includes(":")) return title.replace(title.split(":")[0] + ":", "");
		else return title;
	}

	static objectToCompressedBase64(object) {
		return LZString.compressToBase64(JSON.stringify(object));
	}

	static objectFromCompressedBase64(base64) {
		return JSON.parse(LZString.decompressFromBase64(base64));
	}

	static isObject(item) {
		return (item && typeof item === 'object' && !Array.isArray(item));
	}

	static isObjLiteral(_obj) {
		var _test = _obj;
		return (typeof _obj !== 'object' || _obj === null ?
			false :
			(
				(function () {
					while (!false) {
						if (Object.getPrototypeOf(_test = Object.getPrototypeOf(_test)) === null) {
							break;
						}
					}
					return Object.getPrototypeOf(_obj) === _test;
				})()
			)
		);
	}

	static isArray(item) {
		return Array.isArray(item);
	}

	static isString(item) {
		return (typeof item === 'string' || item instanceof String)
	}

	static isInteger(item) {
		return Number.isInteger(item);
	}

	static isNumber(item) {
		return !isNaN(item);
	}

	static deepCopy(object) {
		if (object) return JSON.parse(JSON.stringify(object))
		else return object;
	}

	//from https://stackoverflow.com/questions/201183/how-to-determine-equality-for-two-javascript-objects
	static deepEqual(x, y) {
		const ok = Object.keys, tx = typeof x, ty = typeof y;
		return x && y && tx === 'object' && tx === ty ? (
		  ok(x).length === ok(y).length &&
			ok(x).every(key => mwjson.util.deepEqual(x[key], y[key]))
		) : (x === y);
	}

	static uniqueArray(array) {
		var result = []
		for (const item of array) {
			var add = true;
			for (const added_item of result) {
				if (mwjson.util.deepEqual(added_item, item)) {
					add = false;
					continue;
				}
			}
			if (add) result.push(item);
		}
		return result;
	}

	//from https://stackoverflow.com/questions/27936772/how-to-deep-merge-instead-of-shallow-merge
	static mergeDeep(target, source) {
		let output = Object.assign({}, target);
		if (mwjson.util.isObject(target) && mwjson.util.isObject(source)) {
			Object.keys(source).forEach(key => {
				if (mwjson.util.isArray(source[key]) && mwjson.util.isArray(target[key]) ) {
					if (!(key in target))
						Object.assign(output, { [key]: source[key] });
					else
						output[key] = mwjson.util.uniqueArray(target[key].concat(...source[key]));
				} else if (mwjson.util.isObject(source[key])) {
					if (!(key in target))
						Object.assign(output, { [key]: source[key] });
					else
						output[key] = mwjson.util.mergeDeep(target[key], source[key]);
				} else {
					Object.assign(output, { [key]: source[key] });
				}
			});
		}
		return output;
	}

	static isUndefined(arg) {
		return (arg === undefined || arg === null);
	}

	static isDefined(arg) {
		return !mwjson.util.isUndefined(arg);
	}

	static defaultArg(arg, default_value) {
		if (mwjson.util.isDefined(arg)) return arg; //special case: boolean false
		else return default_value;
	}

	// returns the value of a table (dict) path or default, if the path is not defined
	static defaultArgPath(arg, path, default_value) {
		if (mwjson.util.isUndefined(arg)) return default_value;
		else if (mwjson.util.isUndefined(path)) return arg;
		else {
			var key = path.shift();
			if (mwjson.util.isUndefined(key)) return arg;  //end of path
			return mwjson.util.defaultArgPath(arg[key], path, default_value);
		}
	}

	// creates a download dialog for any text
	static downloadTextAsFile(filename, text) {
		var element = document.createElement('a');
		element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
		element.setAttribute('download', filename);
		element.style.display = 'none';
		document.body.appendChild(element);
		element.click();
		document.body.removeChild(element);
	  }

	static addBarLink(config) {
		var defaultConfig = {
			"location": "#p-cactions",
			"label": "Link"
		};
		var config = { ...defaultConfig, ...config };
		if ($(defaultConfig.location).length === 0) return; //check if tool bar exists

		var $menu_entry = $(defaultConfig.location).find('ul').children().first().clone(); //find "more" page menu and clone first entry
		if (config.id) $menu_entry.attr('id', config.id);
		else $menu_entry.removeAttr('id');
		if ($menu_entry.length === 0) return; //check if entry exists

		var $link = $menu_entry.find('a');
		if ($link.length === 0) return; //check if link exists

		$link.text(config.label);
		if (config.href) $link.attr('href', config.href);
		else $link.removeAttr('href');
		if (config.onclick) $link[0].onclick = config.onclick;
		if (config.tooltip) $link.attr('title', config.tooltip);
		else $link.removeAttr('title');
		if (config.accesskey) $link.attr('accesskey', config.accesskey);
		else $link.removeAttr('accesskey');
		$(defaultConfig.location).find('ul').append($menu_entry); //insert entry
	}
}
