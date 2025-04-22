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

## Updating `vis-network` Library

This extension uses the [`vis-network`](https://www.npmjs.com/package/vis-network) JavaScript library for rendering network diagrams. The version is managed via `npm` and bundled into the extension using a post-install script.

### How It Works

After running `npm install`, the following happens automatically:

1. **Copying Files**  
   The `copy-files-from-to` tool copies the minified `vis-network` files from `node_modules` to the `resources/visNetwork/` directory:
   - `vis-network.min.js`
   - `vis-network.min.js.map`

2. **Injecting Comment**  
   A custom script (`inject-nomin.js`) prepends the line `/*@nomin*/` to `vis-network.min.js`.  
   This comment prevents MediaWiki's ResourceLoader from re-minifying the file.

### To Update `vis-network`

1. Open `package.json` and change the version under `"vis-network"`  
   (e.g., `"vis-network": "latest"` or a specific version like `"9.1.9"`).

2. Run:

   ```bash
   npm install
   ```


## Credits
https://github.com/OpenSemanticLab/mediawiki-extensions-InteractiveSemanticGraph


