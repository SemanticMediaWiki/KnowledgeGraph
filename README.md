# KnowledgeGraph

This extension provides the `#knowledgegraph` parser function to visualize the [knowledge graph](https://en.wikipedia.org/wiki/Knowledge_graph) in Semantic MediaWiki with [vis-network.js](https://github.com/visjs/vis-network)

Includes a KnowledgeGraph Designer through which interactively create/export graphs.


## Requirements

Requirements for KnowledgeGraph 1.x:

- PHP 7.4 or later
- MediaWiki 1.39 or later
- SemanticMediaWiki 4.x or later

## Usage

Insert a parser function like

```
{{#knowledgegraph:
nodes=Page A, Page B
|properties=HasProperty1,HasProperty2
|depth=3
|graph-options=Mediawiki:KnowledgegraphGraphOptions
|property-options?HasProperty1=Mediawiki:KnowledgegraphNodeOptionsHasProperty1
|show-toolbar=false
|show-property-type=false
|width=100%
|height=400px
}}
```


## Credits
https://github.com/OpenSemanticLab/mediawiki-extensions-InteractiveSemanticGraph


