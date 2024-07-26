<?php

/**
 * KnowledgeGraph
 *
 * @license GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

class KnowledgeGraphApiLoadCategories extends ApiBase {

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
		$output = $context->getOutput();

		\KnowledgeGraph::initSMW();

		$categories = explode( '|', $params['categories'] );

		$titles = [];
		foreach ( $categories as $categoryText ) {
			$category_ = Title::makeTitleSafe( NS_CATEGORY, $categoryText );
			// && $category_->isKnown()
			if ( $category_ ) {
				$titles_ = \KnowledgeGraph::articlesInCategories( $categoryText );

				foreach ( $titles_ as $title_ ) {
					$titles[$title_->getFullText()] = $title_;
				}
			}
		}

		$params['properties'] = [];
		// $params['depth'] = 0;

		foreach ( $titles as $titleText => $title_ ) {
			if ( !isset( self::$data[$titleText] ) ) {
				\KnowledgeGraph::setSemanticData( $title_, $params['properties'], 0, $params['depth'] );
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
			'categories' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => true
			],
			'depth' => [
				ApiBase::PARAM_TYPE => 'integer',
				ApiBase::PARAM_REQUIRED => true
			],
			'limit' => [
				ApiBase::PARAM_TYPE => 'integer',
				ApiBase::PARAM_REQUIRED => true
			],
			'offset' => [
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
	protected function getExamplesMessages() {
		return [
			'action=knowledgegraph-load-categories'
			=> 'apihelp-knowledgegraph-load-categories-example-1'
		];
	}

}
