isg.util = class {
    constructor() {
    }

    static articlePath(title) {
        return mw.config.get("wgArticlePath").replace("$1", title );
    }

    static getShortUid() {
        return (performance.now().toString(36) + Math.random().toString(36)).replace(/\./g, "");
    }

    static uuidv4() {
        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }

    //Removes the given value from the given array
    static removeItemFromArray(arr, value) {
        var index = arr.indexOf(value);
        if (index > -1) {
            arr.splice(index, 1);
        }
        return arr;
    }

    //Creates API query Url with the given root and properties
    static getSmwQuery(root, properties) {
        if (properties[0] === "-Category") properties[0] = "Category";
        else if (root.startsWith("Category:")) root = ":" + root; //[[Category:X]] queries pages within this category, [[:Category:X]] the category itself
        var url = mw.config.get("wgScriptPath") + `/api.php?action=ask&query=[[${encodeURIComponent(root)}]]`;
        var propertiesVar = '';
        propertiesVar += '|?' + ".Display title of" + "=" + "Display title of"; //explicit query for display title due to slow update of the displaytitle page field 
        for (var i = 0; i < properties.length; i++) {
            propertiesVar += '|?' + encodeURIComponent(properties[i]) + "=" + encodeURIComponent(properties[i]); //explicit label overwrites property display title. ToDo: extrakt label in result and get corresponding printout
            propertiesVar += '|?' + encodeURIComponent(properties[i] + ".Display title of") + "=" + encodeURIComponent(properties[i] + ".Display title of"); //explicit query for display title due to slow update of the displaytitle page field 
            //propertiesVar += '|?' + encodeURIComponent(properties[i] + ".HasLabel#LOCL") + "=" + encodeURIComponent(properties[i] + ".HasLabel"); //explicit query for label in user language 
	    propertiesVar += '|?' + encodeURIComponent(properties[i] + ".Equivalent URI") + "=" + encodeURIComponent(properties[i] + ".Equivalent URI");
        }
        url = url + propertiesVar + '&format=json';
        return url;
    }

    //Given Label is reversed with "-" or "-" is removed
    static reverseLabel(label) {
        if (label[0] == "-") {
            return label.substring(1);
        } else {
            return "-" + label;
        }
    }

    static isLabelReversed(label) {
        if (label[0] == "-") {
            return true;
        } else {
            return false;
        }
    }

    //Cartesian Product of arrays
    static cartesianProduct(arr) {
        return arr.reduce(function (a, b) {
            return a.map(function (x) {
                return b.map(function (y) {
                    return x.concat([y]);
                })
            }).reduce(function (a, b) { return a.concat(b) }, [])
        }, [[]])
    }

    //Copies a text into the clipboard
    static copyToClipboad(copyText) {
        // create an input element
        let input = document.createElement('input');
        // setting it's type to be text
        input.setAttribute('type', 'text');
        // setting the input value to equal to the text we are copying
        input.value = copyText;
        // appending it to the document
        document.body.appendChild(input);
        // calling the select, to select the text displayed
        // if it's not in the document we won't be able to
        input.select();
        // calling the copy command
        document.execCommand("copy");
        // removing the input from the document
        document.body.removeChild(input)
    }

}

isg.util.Color = class {
    //Function for random colors

    static golden = 0.618033988749895;

    constructor() {
        this.h = Math.random();
    }
    randomHSL() {

        this.h += isg.util.Color.golden;
        this.h %= 1;
        return "hsla(" + (360 * this.h) + "," + "70%," + "80%,1)";
    }
}
