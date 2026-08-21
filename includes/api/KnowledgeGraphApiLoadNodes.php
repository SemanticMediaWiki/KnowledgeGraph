<?php

/**
 * KnowledgeGraph
 *
 * @license GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

use MediaWiki\Title\Title;

class KnowledgeGraphApiLoadNodes extends ApiBase {

	use KnowledgeGraphApiLoadTrait;

	/**
	 * @inheritDoc
	 */
	protected function getTitlesToLoad( array $params ): iterable {
		foreach ( explode( '|', $params['titles'] ) as $titleText ) {
			$title_ = Title::newFromText( $titleText );
			if ( !$title_ || !$title_->isKnown() ) {
				continue;
			}

			yield $titleText => $title_;
		}
	}

	/**
	 * @inheritDoc
	 */
	protected function getPropertiesForTitle( array $params, Title $title_, string $titleText ): array {
		$properties = json_decode( $params['properties'] ?? '', true );
		if ( is_array( $properties ) && $properties !== [] ) {
			return $properties;
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
			'action=knowledgegraph-load-nodes'
			=> 'apihelp-knowledgegraph-load-nodes-example-1'
		];
	}

}
