/*@nomin*/
/* 
hint: ResourceLoader minifier does not support ES6 yet, therefore skip minification  with "nomin" (see https://phabricator.wikimedia.org/T255556)
*/

isg.UI = class {
	constructor(
		container,
		config = { onLegendClick: undefined, legacy_mode: false }
	) {
		this.config = config;
		this.container = container;
		this.container.style.position = "relative";
		this.container.style.display = "flex";
		this.container.style["align-items"] = "center";
		this.container.style["flex-direction"] = "column";
		//this.init(); //visnetwork will remove all child elements, so we call this later
	}

	init() {
		// If the document is clicked somewhere it hides the context menu
		$(document).bind("mousedown", function (e) {
			// If the clicked element is not the menu
			if (!$(e.target).parents(".custom-menu").length > 0) {
				// Hide it
				$(".custom-menu").hide(100);
			}
		});

		this.legendClickEvent = new CustomEvent("legend-click", {
			detail: {
				hazcheeseburger: true,
			},
		});

		this.createEditorElements();
	}

	createInfoSection() {
		var tip =
			"<p><strong>Hinweis:</strong> Um sich einen Pfad zwischen zwei Knoten ausgeben zu lassen, <em>Strg</em> gedrückt halten und die gewünschten zwei Knoten mit der <em>linken Maustaste</em> anklicken. </p>";
		this.container.insertAdjacentHTML("afterbegin", tip);
	}

	createLegend(properties, colors) {
		this.legendDiv = document.createElement("div");

		this.legendDiv.style.position = "relative";
		this.legendDiv.id = "legendContainer";
		var legendColors = {};

		for (var i = 0; i < properties.length; i++) {
			//create legend entries only for non-inversed properties
			legendColors[properties[i]] = colors[i];
			this.addLegendEntry(properties[i], properties[i], colors[i]);
		}

		this.container.append(this.legendDiv);
		return legendColors;
	}

	addLegendEntry(id, label, color) {
		var container = document.createElement("button");
		container.className = "legend-element-container";
		container.classList.add("btn", "btn-outline-light");
		container.id = id;
		container.style.color = "black";
		container.style.background = color;
		container.innerHTML = label;

		container.dataset.active = true;
		container.dataset.active_color = color;

		container.addEventListener("click", (event) =>
			this.dispatchEvent_LegendClick(event, id)
		);

		this.legendDiv.append(container);
	}

	dispatchEvent_LegendClick(event, id) {
		var container = $(this.legendDiv).find("[id='" + id + "']")[0];

		//toogle color
		if (container.dataset.active === "true") {
			container.dataset.active = false;
			container.style.background = "#FFFFFF";
		} else {
			container.dataset.active = true;
			container.style.background = container.dataset.active_color;
		}
		// create and dispatch the event
		if (this.config.onLegendClick) this.config.onLegendClick(id);
		//var event = new CustomEvent("legend-click", {
		//    id: id
		//});
		//this.dispatchEvent(event);
	}

	createEditorElements() {
		this.container_header = document.createElement("div");
		this.container_header.style.width = "100%";
		this.container.prepend(this.container_header);
	}

	createPermalinkButton() {
		var btn = document.createElement("button");
		btn.innerHTML = "Copy permalink";
		btn.style.float = "right";
		btn.classList.add("isg-button-permalink");
		btn.classList.add("btn", "btn-light");
		this.container_header.appendChild(btn);
		return btn;
	}

	createSaveButton() {
		var btn = document.createElement("button");
		btn.innerHTML = "Save changes";
		btn.style.float = "right";
		btn.classList.add("isg-button-save");
		btn.classList.add("btn", "btn-primary");
		this.container_header.appendChild(btn);
		return btn;
	}

	createResetViewButton() {
		var btn = document.createElement("button");
		btn.innerHTML = "Reset view";
		btn.style.float = "right";
		btn.classList.add("isg-button-reset-view");
		btn.classList.add("btn", "btn-light");
		this.container_header.appendChild(btn);
		return btn;
	}

	// *** not used
	createInfoDialog(text) {
		// Example: Customize the displayed actions at the time the window is opened.
		var messageDialog = new OO.ui.MessageDialog();
		// Create and append a window manager.
		var windowManager = new OO.ui.WindowManager();
		$("body").append(windowManager.$element);
		// Add the dialog to the window manager.
		windowManager.addWindows([messageDialog]);
		// Configure the message dialog when it is opened with the window manager's openWindow() method.
		windowManager.openWindow(messageDialog, {
			title: "Folgende Änderugnen wurden übernommen:",
			message: "" + text,
			verbose: true,
			actions: [
				{
					action: "accept",
					label: "Okay",
					flags: "primary",
				},
			],
		});
		/*OO.ui.alert( "" + text ).done( function () {
            console.log( text );
        } );*/
	}

	//function to make the manipulation popups draggable
	dragElement(elmnt) {
		var pos1 = 0,
			pos2 = 0,
			pos3 = 0,
			pos4 = 0;
		if (document.getElementById(elmnt.id)) {
			// if present, the header is where you move the DIV from:
			document.getElementById("node-operation").onmousedown = dragMouseDown;
			document.getElementById("edge-operation").onmousedown = dragMouseDown;
		} else {
			// otherwise, move the DIV from anywhere inside the DIV:
			elmnt.onmousedown = dragMouseDown;
		}

		function dragMouseDown(e) {
			e = e || window.event;
			e.preventDefault();
			// get the mouse cursor position at startup:
			pos3 = e.clientX;
			pos4 = e.clientY;
			document.onmouseup = closeDragElement;
			// call a function whenever the cursor moves:
			document.onmousemove = elementDrag;
		}

		function elementDrag(e) {
			e = e || window.event;
			e.preventDefault();
			// calculate the new cursor position:
			pos1 = pos3 - e.clientX;
			pos2 = pos4 - e.clientY;
			pos3 = e.clientX;
			pos4 = e.clientY;
			// set the element's new position:
			elmnt.style.top = elmnt.offsetTop - pos2 + "px";
			elmnt.style.left = elmnt.offsetLeft - pos1 + "px";
		}

		function closeDragElement() {
			// stop moving when mouse button is released:
			document.onmouseup = null;
			document.onmousemove = null;
		}
	}
};

