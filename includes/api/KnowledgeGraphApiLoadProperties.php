<?php

/**
 * KnowledgeGraph
 *
 * @license GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

use MediaWiki\Extension\KnowledgeGraph\Aliases\Title as TitleClass;

class KnowledgeGraphApiLoadProperties extends ApiBase {

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
		$params['properties'] = explode( '|', $params['properties'] );
		if ( $params['inversePropsIncluded'] ) {
			foreach ( $params['properties'] as $property ) {
				$inverseKey = '-' . $property;
				$params['properties'][] = $inverseKey;
			}
		}

		$params['nodes'] = explode( '|', $params['nodes'] );
		foreach ( $params['nodes'] as $titleText ) {
			$title_ = TitleClass::newFromText( $titleText );
			if ( $title_ && $title_->isKnown() ) {
				if ( !isset( self::$data[$title_->getFullText()] ) ) {
					\KnowledgeGraph::setSemanticDataFromApi(
						$title_,
						$params['properties'],
						0,
						$params['depth']
					);
				}
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
			'properties' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => true
			],
			'nodes' => [
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
			'inversePropsIncluded' => [
				ApiBase::PARAM_TYPE => 'boolean',
				ApiBase::PARAM_REQUIRED => false
			]
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
			'action=knowledgegraph-load-properties'
			=> 'apihelp-knowledgegraph-load-properties-example-1'
		];
	}

}
