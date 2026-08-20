<?php

/**
 * KnowledgeGraph
 *
 * @license GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

use MediaWiki\Title\Title;

class KnowledgeGraphApiLoadCategories extends ApiBase {

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
		$output = $context->getOutput();

		\KnowledgeGraph::initSMW();
		self::$SMWStore = \SMW\StoreFactory::getStore();
		self::$SMWDataValueFactory = SMW\DataValueFactory::getInstance();

		$queryParams = [
			'action' => 'query',
			'list' => 'allpages',
			'apnamespace' => \SMW_NS_PROPERTY,
			'aplimit' => 'max',
			'format' => 'json'
		];

		$api = new ApiMain( \KnowledgeGraph::newDerivativeApiContext( $context, $queryParams, false ) );
		$api->execute();
		$data = $api->getResult()->getResultData();

		$propertyTitles = $data['query']['allpages'] ?? [];
		$propertyTitles = array_column( $propertyTitles, 'title' );
		$propertyNames = array_map( static function ( $title ) {
			return substr( $title, strrpos( $title, ':' ) + 1 );
		}, $propertyTitles );

		$params['properties'] = ( !empty( $params['properties'] ) ?
			json_decode( $params['properties'], true ) : [] );

		$categories = explode( '|', $params['categories'] );

		$data = [];
		$relationsSeen = [];
		$titles = [];
		foreach ( $categories as $categoryText ) {
			$category_ = Title::makeTitleSafe( NS_CATEGORY, $categoryText );
			// && $category_->isKnown()
			if ( $category_ ) {
				$titles_ = \KnowledgeGraph::articlesInCategories(
					$categoryText,
					$params['limit'],
					$params['offset']
				);

				foreach ( $titles_ as $title_ ) {
					$titles[$title_->getFullText()] = $title_;

					$titleText = $title_->getDbKey();
					$titleText = str_replace( '_', ' ', $titleText );

					$params['properties'] = $this->buildPropertiesList(
						$propertyNames,
						$title_,
						$titleText,
						$params['properties'],
						$params['limit']
					);

					if ( $title_ && $title_->isKnown() ) {
						if ( !isset( $data[$title_->getFullText()] ) ) {
							\KnowledgeGraph::setSemanticDataFromApi(
								$title_,
								$params['properties'],
								0,
								$params['depth'],
								$data,
								$relationsSeen
							);
						}
					}
				}
			}
		}

		$res = json_encode( $data );
		$result->addValue( [ $this->getModuleName() ], 'data', $res, ApiResult::NO_VALIDATE );
	}

	/**
	 * Builds the list of properties to load for a category member: properties
	 * for which the member is a target value (via $propertyNames), plus the
	 * member's own semantic properties, filtered by self::$exclude and
	 * isUserAnnotable()/isVisible(), merged with their inverse ("-property")
	 * counterparts.
	 *
	 * @param string[] $propertyNames
	 * @param Title $title_
	 * @param string $titleText
	 * @param array $properties
	 * @param int $limit
	 * @return array
	 */
	private function buildPropertiesList(
		array $propertyNames,
		Title $title_,
		string $titleText,
		array $properties,
		int $limit
	): array {
		foreach ( $propertyNames as $propertyName ) {
			$propertyDI = \SMW\DIProperty::newFromUserLabel( $propertyName );
			$results = \KnowledgeGraph::getSubjectsByProperty( $propertyDI, $limit, 0, $titleText );
			if ( count( $results ) > 0 ) {
				$properties[] = $propertyName;
			}
		}

		$subject = new \SMW\DIWikiPage( $title_->getDbKey(), $title_->getNamespace() );
		$semanticData = self::$SMWStore->getSemanticData( $subject );

		foreach ( $semanticData->getProperties() as $property ) {
			$key = $property->getKey();

			if ( in_array( $key, \KnowledgeGraph::$exclude ) ) {
				continue;
			}

			$propertyDv = self::$SMWDataValueFactory->newDataValueByItem( $property, null );
			if ( !$property->isUserAnnotable() || !$propertyDv->isVisible() ) {
				continue;
			}

			$key = str_replace( '_', ' ', $property->getKey() );

			$properties[] = $key;
		}

		$properties = array_unique( $properties );

		return array_unique(
			array_merge(
				$properties,
				array_map(
					static fn ( $prop ) => '-' . $prop,
					$properties
				)
			)
		);
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
	public function getExamplesMessages() {
		return [
			'action=knowledgegraph-load-categories'
			=> 'apihelp-knowledgegraph-load-categories-example-1'
		];
	}

}
