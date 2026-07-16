# Changelog

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](https://semver.org/) and
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- `.phan/config.php` and `.phan/baseline.php`: activated Phan static analysis (declared as a dev dependency via `mediawiki/mediawiki-phan-config` but never configured or run); runs on the coverage matrix leg via a new `composer-phan` Makefile target chained onto `ci-coverage`
- First QUnit tests, with JS coverage wired into CI

### Changed
- CI matrix now tracks MediaWiki LTS (1.43) and the latest non-LTS release (1.46) instead of intermediate 1.44/1.45 legs; coverage and Phan moved onto the 1.43/SMW 7.0.0 leg; PHP floor raised to 8.2
- `mediawiki/mediawiki-phan-config` bumped from 0.14.0 to 0.20.0
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
