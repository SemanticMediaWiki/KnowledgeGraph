/**
 * KnowledgeGraph
 *
 * @licence GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

KnowledgeGraphNonModalDialog = (function () {
	function NonModalDialog(config) {
		NonModalDialog.super.call(this, config);
	}
	OO.inheritClass(NonModalDialog, OO.ui.Dialog);

	// NonModalDialog.static.name = 'myDialogNonModal';
	NonModalDialog.prototype.initialize = function () {
		const dialog = this;

		this.setElementId( 'knowledgegraph-credits' );

		NonModalDialog.super.prototype.initialize.apply(this, arguments);
		this.content = new OO.ui.PanelLayout({ padded: true, expanded: false });

		this.content.$element.append(
			'<p>' + mw.msg('knowledgegraph-credits') + '</p>'
		);
		this.content.$element.append(mw.msg('knowledgegraph-credits-list'));
		this.content.$element.append('<p></p><br />');
		const closeButton = new OO.ui.ButtonWidget({
			label: OO.ui.msg('ooui-dialog-process-dismiss'),
		});
		closeButton.on('click', function () {
			dialog.close();
		});

		this.content.$element.append(closeButton.$element);
		this.$body.append(this.content.$element);
	};
	NonModalDialog.prototype.getBodyHeight = function () {
		return this.content.$element.outerHeight(true);
	};
	
	function create(params) {
		return ( new NonModalDialog(params) );
	}

	return {
		create,
	};
})();
