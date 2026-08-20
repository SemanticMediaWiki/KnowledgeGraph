<?php

/**
 * KnowledgeGraph
 *
 * @license GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

use MediaWiki\Title\Title;

class KnowledgeGraphApiLoadProperties extends ApiBase {

	use KnowledgeGraphApiLoadTrait;

	/**
	 * Result of expandInverseProperties(), identical for every title in a
	 * given execute() call; computed once on first use instead of per title.
	 *
	 * @var string[]|null
	 */
	private $expandedProperties;

	/**
	 * @inheritDoc
	 */
	protected function getTitlesToLoad( array $params ): iterable {
		foreach ( explode( '|', $params['nodes'] ) as $titleText ) {
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
		if ( $this->expandedProperties === null ) {
			$this->expandedProperties = self::expandInverseProperties(
				explode( '|', $params['properties'] ),
				(bool)$params['inversePropsIncluded']
			);
		}

		return $this->expandedProperties;
	}

	/**
	 * Adds a "-property" inverse entry for each given property when requested.
	 *
	 * @param string[] $properties
	 * @param bool $inversePropsIncluded
	 * @return string[]
	 */
	protected static function expandInverseProperties( array $properties, bool $inversePropsIncluded ): array {
		if ( !$inversePropsIncluded ) {
			return $properties;
		}

		foreach ( $properties as $property ) {
			$properties[] = '-' . $property;
		}

		return $properties;
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
	public function getExamplesMessages() {
		return [
			'action=knowledgegraph-load-properties'
			=> 'apihelp-knowledgegraph-load-properties-example-1'
		];
	}

}
