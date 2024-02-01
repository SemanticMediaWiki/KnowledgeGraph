# mediawiki-extensions-KnowledgeGraph

Visualizes SemanticMediawiki data with VisNetwork.js

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
