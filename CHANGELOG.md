# Changelog

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](https://semver.org/) and
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed
- `KnowledgeGraph::setSemanticDataFromApi()`: corrected the PHPDoc return type from `array` to `void`; the method has always populated the public static `self::$data` property as a side effect and never returns a value, and all five call sites already read the result from that property rather than from the return value ([#64](https://github.com/SemanticMediaWiki/KnowledgeGraph/issues/64))
- `KnowledgeGraph.php`, `KnowledgeGraphApiLoadCategories.php`: migrated `\SMW\DIProperty::findPropertyTypeID()` (removed in SMW 7.0.0) to `findPropertyValueType()`; the old call fataled under SMW 7.0.0 and was previously untested
- `KnowledgeGraph::getSubjectsByProperty()`: narrowed the `$propertyText` parameter to `\SMW\DIProperty` (the only type any real caller ever passes) and removed the dead `is_string( $propertyText )` branch, which silently discarded `$targetValue` for a code path no caller exercises ([#62](https://github.com/SemanticMediaWiki/KnowledgeGraph/issues/62))
- `KnowledgeGraphPropertyTypeLookupTest`: gated the `findPropertyTypeID()`-removed assertion on `SMW_VERSION >= 7.0.0`; the test unconditionally asserted the method was gone, which failed CI's SMW 6.0.1 matrix leg where the method still exists
- `KnowledgeGraph::parserFunctionKnowledgeGraph()`, `SpecialKnowledgeGraphDesigner::execute()`: confirmed the two `SecurityCheck-XSS` Phan findings on `wfMessage( 'knowledge-graph-wrapper-loading' )->text()` are false positives (hardcoded message key, plain-text i18n values, concatenated only with internal int indexes) and replaced the blanket `.phan/baseline.php` suppressions with inline `@phan-suppress-next-line` justifications ([#63](https://github.com/SemanticMediaWiki/KnowledgeGraph/issues/63))

### Added
- `.phan/config.php` and `.phan/baseline.php`: activated Phan static analysis (declared as a dev dependency via `mediawiki/mediawiki-phan-config` but never configured or run); runs on the coverage matrix leg via a new `composer-phan` Makefile target chained onto `ci-coverage`
- `composer-phan-update-baseline` Makefile target to regenerate `.phan/baseline.php` with tab indentation (Phan hardcodes 4-space indentation, which fails PHPCS)
- First QUnit tests, with JS coverage wired into CI

### Changed
- CI matrix now tracks MediaWiki LTS (1.43) and the latest non-LTS release (1.46) instead of intermediate 1.44/1.45 legs; coverage and Phan moved onto the 1.43/SMW 7.0.0 leg; PHP floor raised to 8.2
- `mediawiki/mediawiki-phan-config` bumped from 0.14.0 to 0.20.0
- Transitive npm dependencies bumped to close 6 Dependabot alerts (3 high, 3 moderate): `form-data` 4.0.5 → 4.0.6 (via `axios`), `lodash` 4.17.21 → 4.18.1 (via `copy-files-from-to`), `picomatch` 2.3.1 → 2.3.2 (via `fast-glob`), `uuid` 9.0.1 → 11.1.1 and `vis-data` 7.1.9 → 7.1.10 (via `vis-network`)
- Fixed ESLint violations and scoping bugs across `KnowledgeGraph.js`, `KnowledgeGraphNonModalDialog.js`, `KnowledgeGraphContextMenu.js`, `KnowledgeGraphOptions.js`, `KnowledgeGraphActionToolbar.js`, `KnowledgeGraphToolbar.js`, `KnowledgeGraphFunctions.js`, `KnowledgeGraphDialog.js`
- npm dependencies updated: `copy-files-from-to` 3.12.1 → 4.0.1, `vis-network` 9.1.9 → 9.1.13

## [3.0.2] - 2026-01-21

### Fixed
- `KnowledgeGraph.js`: exclude the Main namespace prefix from node labels in graphs

## [3.0.1] - 2026-01-20

### Fixed
- `KnowledgeGraph.js`: prevent the default browser context menu and safely handle a missing DOM event in the network `oncontext` handler

## [3.0.0] - 2025-11-21

### Changed
- CI now covers MW 1.44-1.45 instead of 1.39-1.42
- `includes/KnowledgeGraph.php`, `includes/specials/SpecialKnowledgeGraphDesigner.php`, `includes/api/KnowledgeGraphApiLoadProperties.php`, `includes/api/KnowledgeGraphApiLoadNodes.php`, `includes/api/KnowledgeGraphApiLoadCategories.php`: replaced the extension's own `Aliases\Title`/`Aliases\Category` compatibility shims with MediaWiki core's `MediaWiki\Title\Title` and `MediaWiki\Category\Category`, then removed the now-unused `includes/aliases/Title.php` and `includes/aliases/Category.php`
- `KnowledgeGraph::articlesInCategories()`: fixed support for MW 1.45 ([#46](https://github.com/SemanticMediaWiki/KnowledgeGraph/pull/46))
