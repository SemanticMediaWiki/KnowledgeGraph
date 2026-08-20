<?php

/**
 * KnowledgeGraph
 *
 * @license GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

use MediaWiki\Title\Title;

class KnowledgeGraphApiLoadCategories extends ApiBase {

	use KnowledgeGraphApiLoadTrait;

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
	 * Names (without namespace prefix) of all known Property: pages, used by
	 * buildPropertiesList() to find properties for which a category member is
	 * a target value. Populated once per execute() call.
	 *
	 * @var string[]
	 */
	private $propertyNames = [];

	/**
	 * Running list of properties accumulated across category members already
	 * processed in the current execute() call; each member's properties are
	 * merged into this list, and the merged result is used for every
	 * subsequent member. Reset at the start of getTitlesToLoad().
	 *
	 * @var array
	 */
	private $accumulatedProperties = [];

	/**
	 * @inheritDoc
	 */
	protected function getTitlesToLoad( array $params ): iterable {
		self::$SMWStore = \SMW\StoreFactory::getStore();
		self::$SMWDataValueFactory = SMW\DataValueFactory::getInstance();

		$queryParams = [
			'action' => 'query',
			'list' => 'allpages',
			'apnamespace' => \SMW_NS_PROPERTY,
			'aplimit' => 'max',
			'format' => 'json'
		];

		$api = new ApiMain(
			\KnowledgeGraph::newDerivativeApiContext( $this->getContext(), $queryParams, false )
		);
		$api->execute();
		$allPagesData = $api->getResult()->getResultData();

		$propertyTitles = $allPagesData['query']['allpages'] ?? [];
		$propertyTitles = array_column( $propertyTitles, 'title' );
		$this->propertyNames = array_map( static function ( $title ) {
			return substr( $title, strrpos( $title, ':' ) + 1 );
		}, $propertyTitles );

		$this->accumulatedProperties = ( !empty( $params['properties'] ) ?
			json_decode( $params['properties'], true ) : [] );

		$categories = explode( '|', $params['categories'] );

		foreach ( $categories as $categoryText ) {
			$category_ = Title::makeTitleSafe( NS_CATEGORY, $categoryText );
			// && $category_->isKnown()
			if ( !$category_ ) {
				continue;
			}

			$titles_ = \KnowledgeGraph::articlesInCategories(
				$categoryText,
				$params['limit'],
				$params['offset']
			);

			foreach ( $titles_ as $title_ ) {
				$titleText = str_replace( '_', ' ', $title_->getDbKey() );

				$this->accumulatedProperties = $this->buildPropertiesList(
					$this->propertyNames,
					$title_,
					$titleText,
					$this->accumulatedProperties,
					$params['limit']
				);

				if ( $title_->isKnown() ) {
					yield $titleText => $title_;
				}
			}
		}
	}

	/**
	 * @inheritDoc
	 */
	protected function getPropertiesForTitle( array $params, Title $title_, string $titleText ): array {
		return $this->accumulatedProperties;
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
	public function getExamplesMessages() {
		return [
			'action=knowledgegraph-load-categories'
			=> 'apihelp-knowledgegraph-load-categories-example-1'
		];
	}

}
