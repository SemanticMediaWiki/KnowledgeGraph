<?php

/**
 * KnowledgeGraph
 *
 * @license GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

use MediaWiki\Title\Title;

/**
 * Serves the initial recursive graph load for {{#knowledgegraph:}} (see
 * KnowledgeGraph::parserFunctionKnowledgeGraph()), which no longer resolves
 * semantic data synchronously during the parse (see #102: doing so tied the
 * rendered graph's correctness to a save request's timing). The client
 * fetches the same data this endpoint returns right after the page loads.
 *
 * Deliberately not folded into KnowledgeGraphApiLoadNodes despite sharing its
 * getTitlesToLoad()/getPropertiesForTitle() shape: that endpoint also serves
 * the interactive, authenticated context-menu node-expansion flow, which is
 * correctly kept behind mustBePosted()/needsToken('csrf'). This endpoint must
 * work as a read-only, anonymous GET for ordinary (including logged-out)
 * page views, so it overrides both explicitly here rather than making the
 * shared trait's default overridable per-subclass, which would make "is this
 * endpoint safe for anonymous GET" a property silently decided by whichever
 * subclass happens to override it.
 */
class KnowledgeGraphApiLoadGraph extends ApiBase {

	use KnowledgeGraphApiLoadTrait;

	/**
	 * @inheritDoc
	 */
	public function mustBePosted(): bool {
		return false;
	}

	/**
	 * @inheritDoc
	 */
	public function needsToken() {
		return false;
	}

	/**
	 * @inheritDoc
	 */
	protected function getTitlesToLoad( array $params ): iterable {
		return $this->resolveKnownTitles( $params['titles'] );
	}

	/**
	 * @inheritDoc
	 */
	protected function getPropertiesForTitle( array $params, Title $title_, string $titleText ): array {
		if ( !empty( $params['properties'] ) ) {
			return explode( '|', $params['properties'] );
		}
		return \KnowledgeGraph::getAllPropertiesForNode( $titleText );
	}

	/**
	 * @inheritDoc
	 */
	public function getAllowedParams() {
		return [
			'titles' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => true
			],
			'properties' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => false
			],
			'depth' => [
				ApiBase::PARAM_TYPE => 'integer',
				ApiBase::PARAM_REQUIRED => true
			],
		];
	}

	/**
	 * @inheritDoc
	 */
	public function getExamplesMessages() {
		return [
			'action=knowledgegraph-load-graph'
			=> 'apihelp-knowledgegraph-load-graph-example-1'
		];
	}

}
