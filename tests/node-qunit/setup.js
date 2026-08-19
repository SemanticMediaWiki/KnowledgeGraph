const path = require( 'path' );
const { installStubs } = require( './stubs/mw-oo-stubs.js' );

installStubs();

require( path.resolve( __dirname, '../../resources/KnowledgeGraphFunctions.js' ) );
require( path.resolve( __dirname, '../../resources/KnowledgeGraphOptions.js' ) );
require( path.resolve( __dirname, '../../resources/KnowledgeGraphContextMenu.js' ) );
require( path.resolve( __dirname, '../../resources/KnowledgeGraphToolbar.js' ) );
require( path.resolve( __dirname, '../../resources/KnowledgeGraphActionToolbar.js' ) );
require( path.resolve( __dirname, '../../resources/KnowledgeGraphNonModalDialog.js' ) );
require( path.resolve( __dirname, '../../resources/KnowledgeGraphDialog.js' ) );
require( path.resolve( __dirname, '../../resources/KnowledgeGraph.js' ) );

global.KnowledgeGraphFunctions = KnowledgeGraphFunctions;
global.KnowledgeGraphOptions = KnowledgeGraphOptions;
global.KnowledgeGraphNonContextMenu = KnowledgeGraphNonContextMenu;
global.KnowledgeGraphToolbar = KnowledgeGraphToolbar;
global.KnowledgeGraphActionToolbar = KnowledgeGraphActionToolbar;
global.KnowledgeGraphNonModalDialog = KnowledgeGraphNonModalDialog;
global.KnowledgeGraphDialog = KnowledgeGraphDialog;
global.KnowledgeGraph = KnowledgeGraph;
