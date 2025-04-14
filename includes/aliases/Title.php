<?php

/**
 * KnowledgeGraph
 *
 * @license GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

namespace MediaWiki\Extension\KnowledgeGraph\Aliases;

if ( class_exists( 'Title' ) ) {
	class Title extends \Title {
	}
} else {
	// phpcs:ignore Generic.Classes.DuplicateClassName.Found
	class Title extends \Mediawiki\Title\Title {
	}
}
