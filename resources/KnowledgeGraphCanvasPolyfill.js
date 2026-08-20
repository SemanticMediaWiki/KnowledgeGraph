/**
 * KnowledgeGraph
 *
 * vis-network's built-in configurator color picker calls the non-standard
 * `CanvasRenderingContext2D.prototype.circle`, inherited from legacy jCanvas
 * usage that was never bundled. Without it, opening the color picker throws
 * "ctx.circle is not a function" and the picker fails to render.
 *
 * @see https://github.com/visjs/vis-util/blob/master/src/shared/color-picker.js
 * @license GPL-2.0-or-later
 */
if ( typeof CanvasRenderingContext2D.prototype.circle !== 'function' ) {
	CanvasRenderingContext2D.prototype.circle = function ( x, y, radius ) {
		this.beginPath();
		this.arc( x, y, radius, 0, 2 * Math.PI );
	};
}
