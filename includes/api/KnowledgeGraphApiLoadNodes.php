<?php

/**
 * KnowledgeGraph
 *
 * @license GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

use MediaWiki\Extension\KnowledgeGraph\Aliases\Title as TitleClass;
use MediaWiki\MediaWikiServices;

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
	 * @see extensions/SemanticMediaWiki/import/groups/predefined.properties.json
	 * @var string[]
	 */
	public static $exclude = [
		// content_group
		"_SOBJ",
		"_ASK",
		"_MEDIA",
		"_MIME",
		"_ATTCH_LINK",
		"_FILE_ATTCH",
		"_CONT_TYPE",
		"_CONT_AUTHOR",
		"_CONT_LEN",
		"_CONT_LANG",
		"_CONT_TITLE",
		"_CONT_DATE",
		"_CONT_KEYW",
		"_TRANS",
		"_TRANS_SOURCE",
		"_TRANS_GROUP",
		// declarative
		"_TYPE",
		"_UNIT",
		"_IMPO",
		"_CONV",
		"_SERV",
		"_PVAL",
		"_LIST",
		"_PREC",
		"_PDESC",
		"_PPLB",
		"_PVAP",
		"_PVALI",
		"_PVUC",
		"_PEID",
		"_PEFU",
		// schema
		"_SCHEMA_TYPE",
		"_SCHEMA_DEF",
		"_SCHEMA_DESC",
		"_SCHEMA_TAG",
		"_SCHEMA_LINK",
		"_FORMAT_SCHEMA",
		"_CONSTRAINT_SCHEMA",
		"_PROFILE_SCHEMA",
		// classification_group
		"_INST",
		"_PPGR",
		"_SUBP",
		"_SUBC"
	];

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

		$services = MediaWikiServices::getInstance();
		$urlUtils = $services->getUrlUtils();
		$httpRequestFactory = $services->getHttpRequestFactory();

		$scriptPath = $services->getMainConfig()->get( 'ScriptPath' );
		$server = $services->getMainConfig()->get( 'Server' );
		$apiUrl = $server . $scriptPath . '/api.php';

		$queryParams = [
			'action' => 'query',
			'list' => 'allpages',
			'apnamespace' => 102,
			'aplimit' => 'max',
			'format' => 'json'
		];

		$query = http_build_query( $queryParams );
		$response = $httpRequestFactory->get( "$apiUrl?$query", [], __METHOD__ );
		$data = json_decode( $response, true );

		$propertyTitles = array_column( $data['query']['allpages'], 'title' );
		$propertyNames = array_map( static function ( $title ) {
			return substr( $title, strrpos( $title, ':' ) + 1 );
		}, $propertyTitles );

		$params['properties'] = ( !empty( $params['properties'] ) ?
			json_decode( $params['properties'], true ) : [] );

		$titles = explode( '|', $params['titles'] );
		foreach ( $titles as $titleText ) {
			$title_ = TitleClass::newFromText( $titleText );

			foreach ( $propertyNames as $propertyName ) {
				$propertyDI = \SMW\DIProperty::newFromUserLabel( $propertyName );
				$results = \KnowledgeGraph::getSubjectsByProperty( $propertyDI, $limit, 0, $titleText );
				if ( count( $results ) > 0 ) {
					$params['properties'][] = $propertyName;
				}
			}

			$subject = new \SMW\DIWikiPage( $title_->getDbKey(), $title_->getNamespace() );
			$semanticData = self::$SMWStore->getSemanticData( $subject );

			foreach ( $semanticData->getProperties() as $property ) {
				$key = $property->getKey();

				$typeID = $property->findPropertyTypeID();

				if ( in_array( $key, self::$exclude ) ) {
					continue;
				}

				$propertyDv = self::$SMWDataValueFactory->newDataValueByItem( $property, null );
				if ( !$property->isUserAnnotable() || !$propertyDv->isVisible() ) {
					continue;
				}

				$key = str_replace( '_', ' ', $property->getKey() );

				$params['properties'][] = $key;

			}

			$params['properties'] = array_unique( $params['properties'] );
			if ( $title_ && $title_->isKnown() ) {
				if ( !isset( self::$data[$title_->getFullText()] ) ) {
					\KnowledgeGraph::setSemanticDataForDesigner( $title_, $params['properties'], 0, $params['depth'] );
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
