const path = require( 'path' );

require( path.resolve( __dirname, '../../resources/KnowledgeGraphFunctions.js' ) );
require( path.resolve( __dirname, '../../resources/KnowledgeGraphOptions.js' ) );

global.KnowledgeGraphFunctions = KnowledgeGraphFunctions;
global.KnowledgeGraphOptions = KnowledgeGraphOptions;
