const path = require( 'path' );
const { installStubs } = require( './stubs/mw-oo-stubs.js' );

installStubs();

require( path.resolve( __dirname, '../../resources/KnowledgeGraphFunctions.js' ) );
require( path.resolve( __dirname, '../../resources/KnowledgeGraphOptions.js' ) );
require( path.resolve( __dirname, '../../resources/KnowledgeGraphContextMenu.js' ) );

global.KnowledgeGraphFunctions = KnowledgeGraphFunctions;
global.KnowledgeGraphOptions = KnowledgeGraphOptions;
global.KnowledgeGraphNonContextMenu = KnowledgeGraphNonContextMenu;
