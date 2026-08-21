<?php

/**
 * KnowledgeGraph
 *
 * @license GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

use MediaWiki\Title\Title;

/**
 * Shared request/response shape for the knowledgegraph-load-* API endpoints:
 * initialise SMW, resolve each requested title to semantic data via
 * KnowledgeGraph::setSemanticDataFromApi(), then json_encode() the result
 * onto the module's "data" value. Subclasses supply only how the set of
 * titles to load (and, per title, which properties to load for it) is
 * determined.
 *
 * Only usable on an ApiBase subclass; Phan cannot see that constraint on a
 * trait, hence the PhanUndeclaredMethod suppressions below for ApiBase's own
 * getResult()/extractRequestParams()/getModuleName().
 */
trait KnowledgeGraphApiLoadTrait {

	/**
	 * @inheritDoc
	 */
	public function isWriteMode() {
		return false;
	}

	/**
	 * @inheritDoc
	 */
	public function mustBePosted(): bool {
		return true;
	}

	/**
	 * @inheritDoc
	 */
	public function needsToken() {
		return 'csrf';
	}

	/**
	 * @inheritDoc
	 */
	public function execute() {
		// @phan-suppress-next-line PhanUndeclaredMethod ApiBase::getResult()
		$result = $this->getResult();
		// @phan-suppress-next-line PhanUndeclaredMethod ApiBase::extractRequestParams()
		$params = $this->extractRequestParams();

		\KnowledgeGraph::initSMW();

		$data = [];
		$relationsSeen = [];

		foreach ( $this->getTitlesToLoad( $params ) as $titleText => $title_ ) {
			// KnowledgeGraph::setSemanticDataFromApi() already no-ops on a
			// title already present in $data, using the same key.
			\KnowledgeGraph::setSemanticDataFromApi(
				$title_,
				$this->getPropertiesForTitle( $params, $title_, $titleText ),
				0,
				$params['depth'],
				$data,
				$relationsSeen
			);
		}

		$res = json_encode( $data );
		// @phan-suppress-next-line PhanUndeclaredMethod ApiBase::getModuleName()
		$result->addValue( [ $this->getModuleName() ], 'data', $res, ApiResult::NO_VALIDATE );
	}

	/**
	 * Yields the known titles to load, keyed by the raw title text they were
	 * requested with. Implementations resolve their endpoint-specific source
	 * (a list of titles, or the members of a list of categories) and must
	 * skip entries that fail to resolve to a known Title.
	 *
	 * @param array $params
	 * @return iterable<string, Title>
	 */
	abstract protected function getTitlesToLoad( array $params ): iterable;

	/**
	 * Returns the list of properties to load for the given title.
	 *
	 * @param array $params
	 * @param Title $title_
	 * @param string $titleText the raw key yielded alongside $title_ by getTitlesToLoad()
	 * @return array
	 */
	abstract protected function getPropertiesForTitle( array $params, Title $title_, string $titleText ): array;

}
