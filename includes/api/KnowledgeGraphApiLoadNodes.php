<?php

/**
 * KnowledgeGraph
 *
 * @license GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

use MediaWiki\Title\Title;

class KnowledgeGraphApiLoadNodes extends ApiBase {

	/**
	 * Store instance for Semantic MediaWiki data.
	 *
	 * @var SMW\Store|null
	 */
	protected static $SMWStore = null;

	/**
	 * Factory instance for creating Semantic MediaWiki data values.
	 *
	 * @var SMW\DataValueFactory|null
	 */
	protected static $SMWDataValueFactory = null;

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
	public function execute() {
		$result = $this->getResult();
		$params = $this->extractRequestParams();
		$context = $this->getContext();

		\KnowledgeGraph::initSMW();
		self::$SMWStore = \SMW\StoreFactory::getStore();
		self::$SMWDataValueFactory = SMW\DataValueFactory::getInstance();

		$titles = explode( '|', $params['titles'] );
		foreach ( $titles as $titleText ) {
			$title_ = Title::newFromText( $titleText );
			if ( !$title_ || !$title_->isKnown() ) {
				continue;
			}

			$listOfProps = \KnowledgeGraph::getAllPropertiesForNode( $titleText );

			if ( !isset( \KnowledgeGraph::$data[$title_->getFullText()] ) ) {
				\KnowledgeGraph::setSemanticDataFromApi(
					$title_,
					$listOfProps,
					0,
					$params['depth']
				);
			}
		}

		$res = json_encode( \KnowledgeGraph::$data );
		$result->addValue( [ $this->getModuleName() ], 'data', $res, ApiResult::NO_VALIDATE );
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
	public function needsToken() {
		return 'csrf';
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
