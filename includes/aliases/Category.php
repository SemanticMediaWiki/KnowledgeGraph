<?php

/**
 * KnowledgeGraph
 *
 * @license GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

namespace MediaWiki\Extension\KnowledgeGraph\Aliases;

if ( class_exists( 'Category' ) ) {
	class Category extends \Category {
	}
} else {
	// phpcs:ignore Generic.Classes.DuplicateClassName.Found
	class Category extends \Mediawiki\Title\Category {
	}
}
