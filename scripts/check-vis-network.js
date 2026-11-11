#!/usr/bin/env node
'use strict';

/**
 * Fails if the vis-network files committed under resources/visNetwork/ differ from what
 * `npm install` would generate from the vis-network version pinned in package.json.
 *
 * Dependency bots only change package.json and package-lock.json; the committed bundle is
 * produced by the postinstall step (copy-files-from-to + inject-nomin.js) and is not
 * updated by them. Without this check such a pull request passes CI while the extension
 * keeps shipping the old library.
 *
 * It must run BEFORE the postinstall step, which overwrites the committed files and would
 * make the comparison pass trivially. In CI install with `npm ci --ignore-scripts`.
 *
 * Update procedure: see "Updating vis-network Library" in README.md
 */

const fs = require( 'fs' );
const path = require( 'path' );

const root = path.resolve( __dirname, '..' );
const pkg = require( path.join( root, 'package.json' ) );

// Same prefix that resources/utility/inject-nomin.js puts on the minified script.
const NOMIN_LINE = '/*@nomin*/\n';

const problems = [];

pkg.copyFiles.forEach( ( { from, to } ) => {
	const source = path.join( root, from );
	const target = path.join( root, to );

	if ( !fs.existsSync( source ) ) {
		problems.push( `${ from } is missing: run "npm ci --ignore-scripts" first` );
		return;
	}
	if ( !fs.existsSync( target ) ) {
		problems.push( `${ to } is not committed` );
		return;
	}

	let expected = fs.readFileSync( source );
	if ( to.endsWith( '.min.js' ) ) {
		expected = Buffer.concat( [ Buffer.from( NOMIN_LINE ), expected ] );
	}
	if ( !expected.equals( fs.readFileSync( target ) ) ) {
		problems.push( `${ to } differs from ${ from }` );
	}
} );

if ( problems.length ) {
	const version = pkg.dependencies[ 'vis-network' ];
	console.error( `The committed vis-network files do not match vis-network ${ version } from package.json:` );
	problems.forEach( ( problem ) => console.error( `  - ${ problem }` ) );
	console.error( 'Run "npm install", review the changes in resources/visNetwork/ and commit them.' );
	process.exit( 1 );
}

console.log( `resources/visNetwork matches vis-network ${ pkg.dependencies[ 'vis-network' ] }` );
