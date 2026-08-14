# Changelog

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](https://semver.org/) and
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed
- `KnowledgeGraph::setSemanticDataFromApi()`: fixed a fatal `Class "Title" not found` error under MediaWiki 1.41+ raised whenever a linked property or recursively-followed page was processed at `depth` > 0 (the global `\Title` alias was removed in 1.41; the file already imports the namespaced `MediaWiki\Title\Title` and uses it everywhere else); previously untested, since every other test exercising this method used `depth=0`, which short-circuits before this code path is reached
- `KnowledgeGraphApiLoadProperties::execute()`: fixed a fatal `Access to undeclared static property` error raised for every known node processed; the code referenced `self::$data`, which is never declared on `KnowledgeGraphApiLoadProperties`, instead of the intended `\KnowledgeGraph::$data`; also extracted the inverse-properties expansion into a new `expandInverseProperties()` method, making it directly unit-testable ([#69](https://github.com/SemanticMediaWiki/KnowledgeGraph/issues/69))
- `KnowledgeGraph::getAllPropertiesForNode()`, `KnowledgeGraph::setSemanticDataFromApi()`: fixed a fatal `Class "FauxRequest" not found` error under MediaWiki 1.41+ (the global `\FauxRequest` alias was removed in 1.41; the namespaced `MediaWiki\Request\FauxRequest` has existed since 1.40); both call sites now go through a new `KnowledgeGraph::newFauxRequest()` helper that picks the correct class name, keeping support for MediaWiki 1.39+
- `KnowledgeGraphApiLoadNodes::execute()`: fixed a fatal `Access to undeclared static property` error raised for every known title processed; the code referenced `self::$data`, which is never declared on `KnowledgeGraphApiLoadNodes`, instead of the intended `\KnowledgeGraph::$data` ([#68](https://github.com/SemanticMediaWiki/KnowledgeGraph/issues/68))
- `KnowledgeGraphApiLoadCategories::execute()`: fixed a fatal `Undefined variable $limit` error raised whenever the internal `allpages` properties lookup returned at least one property; the property-filtering logic (exclude-list, `isUserAnnotable()`/`isVisible()` checks, inverse-property generation) was extracted into a new `buildPropertiesList()` method, closing the scoping bug and making the logic directly unit-testable ([#67](https://github.com/SemanticMediaWiki/KnowledgeGraph/issues/67))
- `KnowledgeGraph::setSemanticDataFromApi()`: corrected the PHPDoc return type from `array` to `void`; the method has always populated the public static `self::$data` property as a side effect and never returns a value, and all five call sites already read the result from that property rather than from the return value ([#64](https://github.com/SemanticMediaWiki/KnowledgeGraph/issues/64))
- `KnowledgeGraph.php`, `KnowledgeGraphApiLoadCategories.php`: migrated `\SMW\DIProperty::findPropertyTypeID()` (removed in SMW 7.0.0) to `findPropertyValueType()`; the old call fataled under SMW 7.0.0 and was previously untested
- `KnowledgeGraph::getSubjectsByProperty()`: narrowed the `$propertyText` parameter to `\SMW\DIProperty` (the only type any real caller ever passes) and removed the dead `is_string( $propertyText )` branch, which silently discarded `$targetValue` for a code path no caller exercises ([#62](https://github.com/SemanticMediaWiki/KnowledgeGraph/issues/62))
- `KnowledgeGraphPropertyTypeLookupTest`: gated the `findPropertyTypeID()`-removed assertion on `SMW_VERSION >= 7.0.0`; the test unconditionally asserted the method was gone, which failed CI's SMW 6.0.1 matrix leg where the method still exists
- `KnowledgeGraph::parserFunctionKnowledgeGraph()`, `SpecialKnowledgeGraphDesigner::execute()`: confirmed the two `SecurityCheck-XSS` Phan findings on `wfMessage( 'knowledge-graph-wrapper-loading' )->text()` are false positives (hardcoded message key, plain-text i18n values, concatenated only with internal int indexes) and replaced the blanket `.phan/baseline.php` suppressions with inline `@phan-suppress-next-line` justifications ([#63](https://github.com/SemanticMediaWiki/KnowledgeGraph/issues/63))

### Added
- `codecov.yml`: set `coverage.status.project.default.target` to 70%, matching the PHP coverage baseline measured in [#66](https://github.com/SemanticMediaWiki/KnowledgeGraph/issues/66) (15.53% lines / 15.79% methods)
- `.phan/config.php` and `.phan/baseline.php`: activated Phan static analysis (declared as a dev dependency via `mediawiki/mediawiki-phan-config` but never configured or run); runs on the coverage matrix leg via a new `composer-phan` Makefile target chained onto `ci-coverage`
- `composer-phan-update-baseline` Makefile target to regenerate `.phan/baseline.php` with tab indentation (Phan hardcodes 4-space indentation, which fails PHPCS)
- First QUnit tests, with JS coverage wired into CI

### Changed
- `.github/workflows/ci.yml`: bumped `actions/checkout` from v4 to v7, resolving the "Node.js 20 is deprecated" warning (v4 is forced onto Node 24 by the runner, v7 targets it natively); no behavioral change for this workflow (only relevant v5 breaking change concerns `pull_request_target` checkout defaults, which this workflow doesn't use)
- Removed the `$exclude` static property duplicated verbatim on `KnowledgeGraphApiLoadNodes` and `KnowledgeGraphApiLoadCategories`; only `KnowledgeGraph::$exclude` was ever read, the two copies were dead weight
- CI matrix now tracks MediaWiki LTS (1.43) and the latest non-LTS release (1.46) instead of intermediate 1.44/1.45 legs; coverage and Phan moved onto the 1.43/SMW leg; PHP floor raised to 8.2
- CI matrix and local `Makefile` default bumped from SMW 7.0.0 to 7.2.0 (latest release); coverage baseline re-measured, unchanged at 15.53% lines / 15.79% methods
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
