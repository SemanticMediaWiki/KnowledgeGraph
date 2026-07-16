<?php

$cfg = require __DIR__ . '/../vendor/mediawiki/mediawiki-phan-config/src/config.php';

$cfg['baseline_path'] = __DIR__ . '/baseline.php';

$IP = getenv( 'MW_INSTALL_PATH' ) !== false
	? str_replace( '\\', '/', getenv( 'MW_INSTALL_PATH' ) )
	: '../..';

// Analyse extension source code; vendor + node_modules are excluded by default
$cfg['directory_list'] = array_merge(
	$cfg['directory_list'],
	[
		'includes',
		$IP . '/extensions/SemanticMediaWiki',
	]
);

$cfg['exclude_analysis_directory_list'] = array_merge(
	$cfg['exclude_analysis_directory_list'],
	[
		'vendor/',
		$IP . '/extensions/SemanticMediaWiki',
	]
);

return $cfg;
