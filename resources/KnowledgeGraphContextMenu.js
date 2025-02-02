/**
 * KnowledgeGraph
 *
 * @licence GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

KnowledgeGraphNonContextMenu = (function () {
	function ContextMenu(config) {
		var el = document.getElementById(PopupMenuId);
		if (el) {
			el.remove();
		}
		var el = document.createElement('div');
		el.id = PopupMenuId;
		el.className = config.className;

		var html = '';
		var ul = document.createElement('ul');
		el.append(ul);

		for (var item of config.items) {
			var li = document.createElement('li');
			var span = document.createElement('span');
			span.className =
				'oo-ui-iconElement oo-ui-iconElement-icon oo-ui-labelElement-invisible oo-ui-iconWidget oo-ui-icon-' +
				item.icon;
			li.append(span);
			var textNode = document.createTextNode(item.label);
			li.append(textNode);
			li.addEventListener('click', item.onClick);
			ul.append(li);
		}

		$(document).click(function () {
			var el = document.getElementById(PopupMenuId);
			if (el) {
				el.remove();
			}
		});

		$('#' + PopupMenuId).click(function (e) {
			e.stopPropagation();
			return false;
		});
		this.el = el;
	}

	ContextMenu.prototype.showAt = function (x, y) {
		this.el.style.left = x + 'px';
		this.el.style.top = y + 'px';
		document.body.appendChild(this.el);
	};
})();
