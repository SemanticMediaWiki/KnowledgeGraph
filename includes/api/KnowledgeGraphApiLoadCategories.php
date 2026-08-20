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
	 * merged into this list, and the merged result is used for that member
	 * and every subsequent one. Reset at the start of getTitlesToLoad().
	 *
	 * @var array
	 */
	private $accumulatedProperties = [];

	/**
	 * Snapshot of $accumulatedProperties taken right after each title yielded
	 * by getTitlesToLoad() is merged in, keyed by the same $titleText used as
	 * that generator's key. getPropertiesForTitle() reads from here instead
	 * of the live $accumulatedProperties, so its result for a given title
	 * does not depend on when the trait's execute() loop happens to call it
	 * relative to later titles being merged in.
	 *
	 * @var array<string, array>
	 */
	private $propertiesByTitle = [];

	/**
	 * @inheritDoc
	 */
	protected function getTitlesToLoad( array $params ): iterable {
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

		$this->accumulatedProperties = empty( $params['properties'] )
			? [] : explode( '|', $params['properties'] );

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
				$this->propertiesByTitle[$titleText] = $this->accumulatedProperties;

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
		return $this->propertiesByTitle[$titleText] ?? $this->accumulatedProperties;
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
		$semanticData = \SMW\StoreFactory::getStore()->getSemanticData( $subject );
		$dataValueFactory = SMW\DataValueFactory::getInstance();

		foreach ( $semanticData->getProperties() as $property ) {
			$key = $property->getKey();

			if ( in_array( $key, \KnowledgeGraph::$exclude ) ) {
				continue;
			}

			$propertyDv = $dataValueFactory->newDataValueByItem( $property, null );
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
			'properties' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => false
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
