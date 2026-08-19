'use strict';

QUnit.module( 'ext.knowledgegraph.stubs', () => {

	QUnit.test( 'every production file under resources/ can be require()\'d after installStubs()', ( assert ) => {
		const requireFns = {
			'KnowledgeGraphFunctions.js': () => require( '../../resources/KnowledgeGraphFunctions.js' ),
			'KnowledgeGraphOptions.js': () => require( '../../resources/KnowledgeGraphOptions.js' ),
			'KnowledgeGraphContextMenu.js': () => require( '../../resources/KnowledgeGraphContextMenu.js' ),
			'KnowledgeGraphDialog.js': () => require( '../../resources/KnowledgeGraphDialog.js' ),
			'KnowledgeGraphNonModalDialog.js': () => require( '../../resources/KnowledgeGraphNonModalDialog.js' ),
			'KnowledgeGraphActionToolbar.js': () => require( '../../resources/KnowledgeGraphActionToolbar.js' ),
			'KnowledgeGraphToolbar.js': () => require( '../../resources/KnowledgeGraphToolbar.js' ),
			'KnowledgeGraph.js': () => require( '../../resources/KnowledgeGraph.js' )
		};

		Object.entries( requireFns ).forEach( ( [ file, requireFile ] ) => {
			assert.true(
				( () => {
					try {
						requireFile();
						return true;
					} catch ( e ) {
						// eslint-disable-next-line no-console
						console.error( file, e );
						return false;
					}
				} )(),
				`${ file } does not throw when require()'d`
			);
		} );
	} );

} );
