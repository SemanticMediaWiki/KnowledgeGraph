#!/bin/bash
# Creates the pages the browser tests expect: three pages linked by the property "Knows" and
# a page that renders them with {{#knowledgegraph:}}.
#
# Usage: seed-wiki.sh <wiki-container>      (e.g. knowledgegraph-mysql-wiki-1)
set -euo pipefail

container="${1:?usage: $0 <wiki-container>}"

edit() {
	docker exec -i "$container" sudo -u www-data php maintenance/run.php edit -u WikiSysop "$1"
}

printf '[[Has type::Page]]' | edit 'Property:Knows'
printf 'Alice. [[Knows::Bob]] [[Knows::Carol]]' | edit 'Alice'
printf 'Bob. [[Knows::Carol]]' | edit 'Bob'
printf 'Carol.' | edit 'Carol'
printf '{{#knowledgegraph:nodes=Alice|properties=Knows|depth=2|width=100%%|height=400px}}' | edit 'KG e2e graph'

docker exec "$container" sudo -u www-data php maintenance/run.php runJobs >/dev/null
