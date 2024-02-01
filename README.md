# KnowledgeGraph
[![CI](https://github.com/SemanticMediaWiki/KnowledgeGraph/actions/workflows/main.yml/badge.svg)](https://github.com/SemanticMediaWiki/KnowledgeGraph/actions/workflows/main.yml)
[![codecov](https://codecov.io/gh/SemanticMediaWiki/KnowledgeGraph/branch/master/graph/badge.svg?token=65C6fSUmuO)](https://codecov.io/gh/SemanticMediaWiki/KnowledgeGraph)
[![Latest Stable Version](https://poser.pugx.org/mediawiki/KnowledgeGraph/version.png)](https://packagist.org/packages/mediawiki/KnowledgeGraph)
[![Packagist download count](https://poser.pugx.org/mediawiki/KnowledgeGraph/d/total.png)](https://packagist.org/packages/mediawiki/KnowledgeGraph)

This extension provides the `#knowledgegraph` parser function to visualize the [knowledge graph](https://en.wikipedia.org/wiki/Knowledge_graph) in Semantic MediaWiki with [vis-network.js](https://github.com/visjs/vis-network)

## Requirements

Requirements for KnowledgeGraph 1.x:

- PHP 7.4 or later
- MediaWiki 1.39 or later
- SemanticMediaWiki 4.x or later


## Usage

Insert a parser function like

```
{{#knowledgegraph:
root=TestPage
|properties=HasProperty1,HasProperty2
|permalink=false
|autoexpand=false
|depth=3
}}
```

'root' is the page to start with. 'properties' are the properties that a queried with a double-click on any node by default. 'permalink = true' will create a permalink every time you modify the graph restore it. 'autoexpand' will auto-query the given properties upon the given 'depth'.

## Contribution and support

If you want to contribute work to the project please subscribe to the developers mailing list and
have a look at the contribution guideline.

* [File an issue](https://github.com/SemanticMediaWiki/KnowledgeGraph/issues)
* [Submit a pull request](https://github.com/SemanticMediaWiki/KnowledgeGraph/pulls)
* Ask a question on [the mailing list](https://www.semantic-mediawiki.org/wiki/Mailing_list)


## Tests

This extension provides unit and integration tests that are run by a [continues integration platform][travis]
but can also be executed using `composer phpunit` from the extension base directory.

## License

[GNU General Public License, version 2 or later][gpl-licence].

[gpl-licence]: https://www.gnu.org/copyleft/gpl.html
[travis]: https://travis-ci.org/SemanticMediaWiki/KnowledgeGraph
[smw]: https://github.com/SemanticMediaWiki/SemanticMediaWiki
[composer]: https://getcomposer.org/
[installing and configuring]: https://github.com/SemanticMediaWiki/KnowledgeGraph/blob/master/docs/INSTALL.md
[using]: https://github.com/SemanticMediaWiki/KnowledgeGraph/blob/master/docs/USAGE.md
