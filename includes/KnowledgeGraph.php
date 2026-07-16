<?php

/**
 * KnowledgeGraph
 *
 * @license GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 * @author gesinn.it
 */

// use MediaWiki\Category\Category;
use MediaWiki\MediaWikiServices;
use MediaWiki\Revision\SlotRecord;
use MediaWiki\Title\Title;
use SMW\MediaWiki\Specials\SearchByProperty\PageRequestOptions;

class KnowledgeGraph {

	/**
	 * Tracks seen relations to prevent duplicate processing.
	 *
	 * @var array<string, bool>
	 */
	private static $relationsSeen = [];

	/**
	 * Configuration options for Semantic MediaWiki.
	 *
	 * @var array|null
	 */
	protected static $SMWOptions = null;

	/**
	 * Factory instance for creating Semantic MediaWiki application components.
	 *
	 * @var SMW\ApplicationFactory|null
	 */
	protected static $SMWApplicationFactory = null;

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
	 * An array to hold various data values.
	 *
	 * @var array
	 */
	public static $data = [];

	public static function initSMW() {
		if ( !defined( 'SMW_VERSION' ) ) {
			return;
		}
		// self::$SMWOptions = new \SMWRequestOptions();
		// self::$SMWOptions->limit = 500;
		// self::$SMWApplicationFactory = SMW\ApplicationFactory::getInstance();
		self::$SMWStore = \SMW\StoreFactory::getStore();
		self::$SMWDataValueFactory = SMW\DataValueFactory::getInstance();
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

	/** @var array */
	public static $graphs = [];

	/** @var array */
	public static $categories = [];

	/**
	 * @param OutputPage $out
	 * @param Skin $skin
	 * @return void
	 */
	public static function onBeforePageDisplay( $out, $skin ) {
		// Ensure that the KnowledgeGraphOptions page exists
		self::ensureKnowledgeGraphOptionsPageExists();
		return true;
	}

	/**
	 * Ensure that the KnowledgeGraphOptions page exists in the MediaWiki namespace.
	 * Creates it lazily if missing.
	 *
	 * @return void
	 */
	private static function ensureKnowledgeGraphOptionsPageExists() {
		$title = Title::makeTitleSafe( NS_MEDIAWIKI, 'KnowledgeGraphOptions' );
		if ( !$title ) {
			return;
		}

		$wikiPage = self::getWikiPage( $title );
		if ( $wikiPage->exists() ) {
			return;
		}

		// Create page content
		$filePath = __DIR__ . '/../data/KnowledgeGraphOptions.js';
		if ( !file_exists( $filePath ) ) {
			wfDebugLog( 'KnowledgeGraph', 'Missing KnowledgeGraphOptions.js template file.' );
			return;
		}

		$text = file_get_contents( $filePath );
		$content = ContentHandler::makeContent(
			$text,
			$title,
			CONTENT_MODEL_JAVASCRIPT
		);

		$user = User::newSystemUser( 'MediaWiki default', [ 'steal' => true ] );

		$pageUpdater = $wikiPage->newPageUpdater( $user );
		$pageUpdater->setContent( SlotRecord::MAIN, $content );
		$pageUpdater->saveRevision(
			CommentStoreComment::newUnsavedComment( 'Initialize KnowledgeGraphOptions' ),
			EDIT_SUPPRESS_RC
		);
	}

	/**
	 * @param Parser $parser
	 */
	public static function onParserFirstCallInit( Parser $parser ) {
		$parser->setFunctionHook( 'knowledgegraph', [ self::class, 'parserFunctionKnowledgeGraph' ] );
	}

	/**
	 * @param Skin $skin
	 * @param array &$sidebar
	 * @return void
	 */
	public static function onSidebarBeforeOutput( $skin, &$sidebar ) {
		if ( empty( $GLOBALS['wgKnowledgeGraphShowSidebarLink'] ) ) {
			return;
		}
		$title = $skin->getTitle();
		$specialpage_title = SpecialPage::getTitleFor( 'KnowledgeGraphDesigner' );

		$sidebar['TOOLBOX'][] = [
			'text'   => wfMessage( 'knowledgegraph-knowledgegraphdesigner-label' )->text(),
			'href'   => $specialpage_title->getLocalURL()
		];
	}

	/**
	 * @see https://github.com/SemanticMediaWiki/KnowledgeGraph/issues/48
	 * @param array $nodes
	 * @return array
	 */
	private static function extractTitleWithCommas( $nodes ) {
		$validTitles = [];
		$i = 0;
		$totalNodes = count( $nodes );

		while ( $i < $totalNodes ) {
			$titleText = $nodes[$i];
			$title_ = Title::newFromText( $titleText );

			// If this title doesn't exist and there are more elements, try joining with next values
			if ( ( !$title_ || !$title_->isKnown() ) && ( $i + 1 ) < $totalNodes ) {
				$combinedText = $titleText;
				$j = $i + 1;

				// Try joining with subsequent values until we find an existing title
				while ( $j < $totalNodes ) {
					$combinedText .= ', ' . $nodes[$j];
					$testTitle = Title::newFromText( $combinedText );

					if ( $testTitle && $testTitle->isKnown() ) {
						$title_ = $testTitle;

						// Skip the consumed elements
						$i = $j;
						break;
					}
					$j++;
				}
			}

			if ( $title_ && $title_->isKnown() ) {
				$validTitles[] = $title_;
			}

			$i++;
		}

		return $validTitles;
	}

	/**
	 * @see https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/PageProperties/+/c997fbd2583ccc088dc232288f883716ca2f5777/includes/PageProperties.php
	 * @param Parser $parser
	 * @param mixed ...$argv
	 * @return array
	 */
	public static function parserFunctionKnowledgeGraph( Parser $parser, ...$argv ) {
		$out = $parser->getOutput();
		$title = $parser->getTitle();

/*
{{#knowledgegraph:
nodes=TestPage
|properties=HasProperty1,HasProperty2
|depth=3
|graph-options=Mediawiki:knowledgegraphGraphOptions
|property-options?HasProperty1=Mediawiki:knowledgegraphNodeOptionsHasProperty1
|show-toolbar=false
|show-property-type=false
|width= 400px
|height= 400px
}}
*/
		$defaultParameters = [
			'nodes' => [ '', 'array' ],
			'properties' => [ '', 'array' ],
			// 'nodes-by-properties' => [ '', 'array' ],
			// 'autoexpand' => [ 'false', 'boolean' ],
			'depth' => [ '3', 'integer' ],
			'graph-options' => [ '', 'string' ],
			'width' => [ '400px', 'string' ],
			'height' => [ '400px', 'string' ],
			'show-toolbar' => [ 'false', 'boolean' ],
			'show-property-type' => [ 'false', 'boolean' ],
			'properties-panel' => [ 'false', 'boolean' ],
			'categories-panel' => [ 'false', 'boolean' ],
			'palette' => [ 'default', 'string' ],
		];

		self::initSMW();

		[ $values, $params ] = self::parseParameters( $argv, array_keys( $defaultParameters ) );

		$params = self::applyDefaultParams( $defaultParameters, $params );
		$params['show-toolbar'] = false;

		$propertyOptions = [];
		$propAttributes = [];
		// property-related options
		foreach ( $values as $val ) {
			if ( preg_match( '/^property-options(\?(.+))?=(.+)/', $val, $match ) ) {
				// allow to to express attributes in this form
				// |property-options?Prop_a#color.background=#ccc
				// |property-options?Prop_a#color.border=#0000FF
				$isAttribute = false;
				$attr = '';
				if ( strpos( $match[2], '#' ) !== false ) {
					[ $match[2], $attr ] = explode( '#', $match[2], 2 );
					$isAttribute = true;
				}

				$title_ = Title::makeTitleSafe( \SMW_NS_PROPERTY, $match[2] );
				if ( !$title_ ) {
					continue;
				}

				if ( $isAttribute ) {
					$propAttributes[ $title_->getText() ][ $attr ] = $match[3];
				} else {
					$propertyOptions[ $title_->getText() ] = $match[3];
				}
			}
		}

		foreach ( $propAttributes as $key => $value ) {
			foreach ( $value as $k => $v ) {
				$propAttributes[$key] = array_merge_recursive(
					self::plainToNestedObj( $k, $v ),
					$propAttributes[$key]
				);
				unset( $propAttributes[$key][$k] );
			}
			$propertyOptions[$key] = $propAttributes[$key];
		}

		$nodes = self::extractTitleWithCommas( $params['nodes'] );

		foreach ( $nodes as $title_ ) {
			if ( $title_ && $title_->isKnown() ) {
				if ( !isset( self::$data[$title_->getFullText()] ) ) {
					self::setSemanticDataFromApi( $title_, $params['properties'], 0, $params['depth'] );
				}
			}
		}

		$graphOptions = [];
		if ( !empty( $params['graph-options'] ) ) {
			// , NS_KNOWLEDGEGRAPH
			$title_ = Title::newFromText( $params['graph-options'], NS_MEDIAWIKI );

			if ( $title_ && $title_->isKnown() ) {
				// $graphOptions = json_decode( self::getWikipageContent( $title_ ), true );
				$graphOptions = self::getWikipageContent( $title_ );
			}
		}

		foreach ( $propertyOptions as $property => $value ) {
			if ( is_array( $value ) ) {
				continue;
			}
			$title_ = Title::newFromText( $value, NS_MEDIAWIKI );
			if ( $title_ && $title_->isKnown() ) {
				// $propertyOptions[$property] = json_decode( self::getWikipageContent( $title_ ), true );
				$propertyOptions[$property] = self::getWikipageContent( $title_ );
			} else {
				unset( $propertyOptions[$property] );
			}
		}

		$params['data'] = self::$data;
		$params['graphOptions'] = $graphOptions;
		$params['propertyOptions'] = $propertyOptions;
		self::$graphs[] = $params;

		self::$data = [];
		$out->setExtensionData( 'knowledgegraphs', self::$graphs );

		$paletteName = $params['palette'] ?? 'default';
		$colors = $GLOBALS['wgKnowledgeGraphColorPalettes'][$paletteName]
				?? $GLOBALS['wgKnowledgeGraphColorPalettes']['default'];

		$out->addJsConfigVars( [
			'KnowledgeGraphShowImages' => $GLOBALS['wgKnowledgeGraphShowImages'],
			'KnowledgeGraphDisableCredits' => $GLOBALS['wgKnowledgeGraphDisableCredits'],
			'wgKnowledgeGraphColorPalette' => $colors
		] );

		$index = count( self::$graphs ) - 1;
		return [
			'<div class="KnowledgeGraph" id="knowledgegraph-wrapper-' . $index . '">'
				. wfMessage( 'knowledge-graph-wrapper-loading' )->text() . '</div>',
			'noparse' => true,
			'isHTML' => true
		];
	}

	/**
	 * Converts strings like columns.searchPanes.show o nested objects.
	 */
	public static function plainToNestedObj( string $key, mixed $value ): array {
		$arr = explode( '.', $key );
		$ret = [];

		// link to first level
		$t = &$ret;
		foreach ( $arr as $key => $k ) {
			if ( !array_key_exists( $k, $t ) ) {
				$t[$k] = [];
			}
			// link to deepest level
			$t = &$t[$k];
			if ( $key === count( $arr ) - 1 ) {
				$t = $value;
			}
		}
		return $ret;
	}

	/**
	 * @param string $propertyText
	 * @param int $limit
	 * @param int $offset
	 * @param string|null $targetValue
	 * @return array
	 */
	public static function getSubjectsByProperty( $propertyText, $limit = 100, $offset = 0, $targetValue = null ) {
		$requestOptions = [
			'limit'    => $limit,
			'offset'   => $offset,
			// 'property' => $this->getRequest()->getVal( 'property' ),
			'property' => $propertyText,
			'value'    => null,
			// 'nearbySearchForType' => $applicationFactory->getSettings()->get( 'smwgSearchByPropertyFuzzy' )
		];

		$pageRequestOptions = new PageRequestOptions( '', $requestOptions );
		$pageRequestOptions->initialize();

		$DIProperty = $pageRequestOptions->property->getDataItem();
		$requestOptions = new \SMW\RequestOptions();
		$requestOptions->setLimit( $limit );
		$requestOptions->setOffset( $offset );

		$targetDIValue = null;
		if ( $targetValue instanceof Title ) {
			$targetDIValue = \SMW\DIWikiPage::newFromTitle( $targetValue );
		} elseif ( is_string( $targetValue ) && $targetValue !== '' ) {
			$title = Title::newFromText( $targetValue );
			if ( $title ) {
				$targetDIValue = \SMW\DIWikiPage::newFromTitle( $title );
			}
		}

		$results = [];
		if ( is_string( $propertyText ) ) {
			$results = self::$SMWStore->getPropertySubjects( $DIProperty, null, $requestOptions );
		} else {
			if ( $propertyText->isInverse() ) {
				$props = $propertyText->getKey();
				$props = str_replace( '-', '', $props );
				$propertyText = \SMW\DIProperty::newFromUserLabel( $props );
				$results = self::$SMWStore->getPropertySubjects( $propertyText, $targetDIValue, $requestOptions );
				$propertyText->setInverse( true );
			} else {
				$results = self::$SMWStore->getPropertySubjects( $DIProperty, $targetDIValue, $requestOptions );
			}
		}

		$ret = [];
		foreach ( $results as $result ) {
			$title_ = $result->getTitle();
			if ( $title_ && $title_->isKnown() ) {
				$ret[] = $title_;
			}
		}
		return $ret;
	}

	/**
	 * Get all properties for a given node.
	 * @param string $nodeTitleText
	 * @return array
	 */
	public static function getAllPropertiesForNode( string $nodeTitleText ): array {
		$ret = [];

		$title = Title::newFromText( $nodeTitleText );
		if ( !$title || !$title->isKnown() ) {
			wfDebugLog( 'KnowledgeGraph', "Invalid or unknown node: '$nodeTitleText'" );
			return [];
		}

		$apiParams = [
			'action' => 'smwbrowse',
			'format' => 'json',
			'browse' => 'subject',
			'params' => json_encode( [
				'subject' => $nodeTitleText,
				'ns' => $title->getNamespace(),
			] ),
		];

		$request = new \FauxRequest( $apiParams, false );
		$api = new \ApiMain( $request );
		$api->execute();
		$data = $api->getResult()->getResultData();

		if ( empty( $data[ 'query' ][ 'data' ] ) ) {
			wfDebugLog( 'KnowledgeGraph', "No properties returned from smwbrowse for '$nodeTitleText'" );
			return [];
		}

		foreach ( $data['query']['data'] as $propertyEntry ) {
			$propKey = $propertyEntry['property'] ?? null;
			$direction = $propertyEntry['direction'] ?? 'direct';

			if ( !$propKey ) {
				continue;
			}

			if (
				( isset( self::$exclude ) && in_array( $propKey, self::$exclude ) ) ||
				str_starts_with( $propKey, '_' ) ||
				str_starts_with( $propKey, '___' ) ||
				ctype_upper( str_replace( '_', '', $propKey ) )
			) {
				continue;
			}

			$propKey = str_replace( '_', ' ', $propKey );

			if ( $direction === 'inverse' ) {
				$propKey = '-' . $propKey;
			}

			$ret[] = $propKey;
		}

		wfDebugLog( 'KnowledgeGraph', sprintf(
			"getAllPropertiesForNode (smwbrowse): node=%s, properties=%d",
			$nodeTitleText,
			count( $ret )
		) );

		return array_unique( $ret );
	}

	/**
	 * @param Title $title $title
	 * @return string|null
	 */
	public static function getWikipageContent( $title ) {
		$wikiPage = self::getWikiPage( $title );
		if ( !$wikiPage ) {
			return null;
		}
		$content = $wikiPage->getContent( \MediaWiki\Revision\RevisionRecord::RAW );

		if ( !$content ) {
			return null;
		}
		return $content->getNativeData();
	}

	/**
	 * @param Title $title
	 * @return WikiPage|null
	 */
	public static function getWikiPage( $title ) {
		if ( !$title || !$title->canExist() ) {
			return null;
		}
		// MW 1.36+
		if ( method_exists( MediaWikiServices::class, 'getWikiPageFactory' ) ) {
			return MediaWikiServices::getInstance()->getWikiPageFactory()->newFromTitle( $title );
		}
		return WikiPage::factory( $title );
	}

	/**
	 * @see https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/PageProperties/+/c997fbd2583ccc088dc232288f883716ca2f5777/includes/PageProperties.php
	 * @param OutputPage $out
	 * @param ParserOutput $parserOutput
	 * @return void
	 */
	public static function onOutputPageParserOutput( OutputPage $out, ParserOutput $parserOutput ) {
		$data = $parserOutput->getExtensionData( 'knowledgegraphs' );

		if ( $data !== null ) {
			$out->addJsConfigVars( [
				'knowledgegraphs' => json_encode( $data )
			] );

			// add the required JavaScript module if graphs are present
			$out->addModules( 'ext.KnowledgeGraph' );
		}
	}

	/**
	 * @see https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/PageProperties/+/c997fbd2583ccc088dc232288f883716ca2f5777/includes/PageProperties.php
	 * @param array $defaultParams
	 * @param array $params
	 * @return array
	 */
	public static function applyDefaultParams( $defaultParams, $params ) {
		$ret = [];
		foreach ( $defaultParams as $key => $value ) {
			[ $defaultValue, $type ] = $value;
			$val = $defaultValue;
			if ( array_key_exists( $key, $params ) ) {
				$val = $params[$key];
			}

			switch ( $type ) {
				case 'bool':
				case 'boolean':
					$val = filter_var( $val, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE );
					if ( $val === null ) {
						$val = filter_var( $defaultValue, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE );
					}
					settype( $val, "bool" );
					break;

				case 'array':
					$val = array_filter(
						preg_split( '/\s*,\s*/', $val, -1, PREG_SPLIT_NO_EMPTY ) );
					break;

				case 'number':
					$val = filter_var( $val, FILTER_VALIDATE_FLOAT, FILTER_NULL_ON_FAILURE );
					settype( $val, "float" );
					break;

				case 'int':
				case 'integer':
					$val = filter_var( $val, FILTER_VALIDATE_INT, FILTER_NULL_ON_FAILURE );
					settype( $val, "integer" );
					break;

				default:
			}

			$ret[$key] = $val;
		}

		return $ret;
	}

	/**
	 * @see https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/PageProperties/+/c997fbd2583ccc088dc232288f883716ca2f5777/includes/PageProperties.php
	 * @param array $parameters
	 * @param array $defaultParameters
	 * @return array
	 */
	public static function parseParameters( $parameters, $defaultParameters ) {
		$ret = [];
		$options = [];
		foreach ( $parameters as $value ) {
			if ( strpos( $value, '=' ) !== false ) {
				[ $k, $v ] = explode( '=', $value, 2 );
				$k = str_replace( ' ', '-', trim( $k ) );

				if ( in_array( $k, $defaultParameters ) ) {
					$options[$k] = trim( $v );
					continue;
				}
			}
			$ret[] = $value;
		}

		return [ $ret, $options ];
	}

	/**
	 * @param string $category
	 * @param int $limit
	 * @param int $offset
	 * @return array
	 */
	public static function articlesInCategories( $category, $limit, $offset ) {
		$options = [
			'LIMIT' => $limit,
			'OFFSET' => $offset
		];
		$dbr = wfGetDB( DB_REPLICA );

		// @credits paladox
		if ( version_compare( MW_VERSION, '1.45', '>=' ) ) {
			$res = $dbr->select(
				[ 'categorylinks', 'linktarget' ],
				[ 'pageid' => 'cl_from' ],
				[
					'lt_title' => str_replace( ' ', '_', $category ),
					'lt_namespace' => NS_CATEGORY,
				],
				__METHOD__,
				$options,
				[
					'linktarget' => [ 'JOIN', 'cl_target_id = lt_id' ],
				]
			);
		} else {
			 $res = $dbr->select( 'categorylinks',
				[ 'pageid' => 'cl_from' ],
				[ 'cl_to' => str_replace( ' ', '_', $category ) ],
				__METHOD__,
				$options
			 );
		}
		$ret = [];
		foreach ( $res as $row ) {
			$title_ = Title::newFromID( $row->pageid );
			if ( $title_ ) {
				$ret[] = $title_;
			}
		}
		return $ret;

		// *** this does not work with numerical offset
		// $cat = Category::newFromName( str_replace( ' ', '_', $category ) );
		// $iterator_ = $cat->getMembers( $limit, $offset );
		// $ret = [];
		// while ( $iterator_->valid() ) {
		// 	$ret[] = $iterator_->current();
		// 	$iterator_->next();
		// }
		// return $ret;
	}

	/**
	 * @see https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/PageProperties/+/refs/heads/1.0.3/includes/PageProperties.php
	 * @param Title $title
	 * @param array $onlyProperties
	 * @param int $depth
	 * @param int $maxDepth
	 * @return array
	 */
	public static function setSemanticDataFromApi( Title $title, $onlyProperties, $depth, $maxDepth ) {
		$titleText = $title->getFullText();

		if ( isset( self::$data[$titleText] ) ) {
			return;
		}

		// If maxDepth is 0, only create the root node without loading SMW data
		if ( $maxDepth === 0 ) {
			self::$data[$titleText] = [
				'properties' => [],
				'categories' => [],
			];
			return;
		}

		if ( $depth >= $maxDepth ) {
			return;
		}

		self::$data[$titleText] = [
			'properties' => [],
			'categories' => [],
		];

		$apiParams = [
			'action' => 'smwbrowse',
			'format' => 'json',
			'browse' => 'subject',
			'params' => json_encode( [
				'subject' => $titleText,
				'ns' => $title->getNamespace(),
			] ),
		];

		$request = new \FauxRequest( $apiParams, false );
		$api = new \ApiMain( $request );
		$api->execute();
		$result = $api->getResult()->getResultData();

		if ( isset( $result['error'] ) ) {
			wfDebugLog( 'SemanticData', 'SMW API error: ' . json_encode( $result['error'] ) );
			return;
		}

		$data = $result['query']['data'] ?? [];
		$output = &self::$data[$titleText];

		if ( $title->getNamespace() === NS_FILE ) {
			$file = MediaWikiServices::getInstance()->getRepoGroup()->findFile( $title );
			if ( $file ) {
				$output['src'] = $file->getFullUrl();
			}
		}

		$propertyRegistry = \SMW\PropertyRegistry::getInstance();
		$dataTypeRegistry = \SMW\DataTypeRegistry::getInstance();
		$pendingRecursiveTitles = [];

		foreach ( $data as $entry ) {
			$direction = $entry['direction'] ?? 'direct';
			$keyRaw = $entry['property'] ?? null;
			$key = $keyRaw ? str_replace( '_', ' ', $keyRaw ) : null;
			if ( !$key ) {
				continue;
			}

			$isInverse = $direction === 'inverse';
			$propKey = $isInverse ? '-' . $key : $key;

			if ( count( $onlyProperties ) ) {
				$allowed = in_array( $propKey, $onlyProperties )
					|| in_array( $key, $onlyProperties );

				if ( $isInverse && !in_array( $propKey, $onlyProperties ) ) {
					continue;
				}

				if ( !$allowed ) {
					continue;
				}
			}

			if ( !isset( $output['properties'][$propKey] ) ) {
				$propertyTitle = \Title::newFromText( ltrim( $propKey, '-' ) );

				if ( $propertyTitle ) {
					$diProperty = \SMW\DIProperty::newFromUserLabel( $propKey );
					if ( $diProperty ) {
						$typeID = $diProperty->findPropertyTypeID();
						$canonicalLabel = $diProperty->getCanonicalLabel();
						$preferredLabel = $diProperty->getPreferredLabel();
						$typeLabel = $dataTypeRegistry->findTypeLabel( $typeID );
						$descriptionKey = $propertyRegistry->findPropertyDescriptionMsgKeyById( $diProperty->getKey() );
						$description = $descriptionKey ? wfMessage( $descriptionKey )->text() : null;

						$output['properties'][$propKey] = [
							'key' => $propKey,
							'typeId' => $typeID,
							'canonicalLabel' => $canonicalLabel,
							'preferredLabel' => $preferredLabel,
							'typeLabel' => $typeLabel,
							'description' => $description,
							'inverse' => $isInverse,
							'values' => [],
						];
					} else {
						$output['properties'][$propKey] = [
							'key' => $propKey,
							'values' => [],
						];
					}
				} else {
					$output['properties'][$propKey] = [
						'key' => $propKey,
						'values' => [],
					];
				}
			}

			foreach ( $entry['dataitem'] ?? [] as $item ) {
				if ( $item['type'] === 9 ) {
					$parts = explode( '#', $item['item'] );
					$dbkey = $parts[0] ?? '';
					$nsId = isset( $parts[1] ) && is_numeric( $parts[1] ) ? (int)$parts[1] : 0;

					$namespaceInfo = MediaWiki\MediaWikiServices::getInstance()->getNamespaceInfo();
					$nsName = $namespaceInfo->getCanonicalName( $nsId );

					$linkedTitle = $dbkey;
					if ( $nsName !== '' && $nsName !== false ) {
						$linkedTitle = $nsName . ':' . $dbkey;
					}

					$linkedTitle = str_replace( '_', ' ', $linkedTitle );
					if ( !$linkedTitle ) {
						continue;
					}

					$source = $titleText;
					$target = $linkedTitle;
					$relation = ltrim( $propKey, '-' );
					$relKey = self::makeRelationKey( $source, $target, $relation );

					if ( isset( self::$relationsSeen[$relKey] ) ) {
						continue;
					}
					self::$relationsSeen[$relKey] = true;

					$output['properties'][$propKey]['values'][] = [ 'value' => $linkedTitle ];

					if ( $depth < $maxDepth && !isset( self::$data[$linkedTitle] ) ) {
						$pendingRecursiveTitles[] = $linkedTitle;
					}
				} else {
					$output['properties'][$propKey]['values'][] = [
						'value' => $item['item'],
						'type' => $item['type'],
					];
				}
			}
		}

		$page = self::getWikiPage( $title );
		if ( $page ) {
			$iterator = $page->getCategories();
			while ( $iterator->valid() ) {
				$output['categories'][] = $iterator->current()->getText();
				$iterator->next();
			}
		}

		foreach ( $pendingRecursiveTitles as $linkedTitle ) {
			$title_ = \Title::newFromText( $linkedTitle );
			if ( $title_ && $title_->isKnown() ) {
				self::setSemanticDataFromApi( $title_, $onlyProperties, $depth + 1, $maxDepth );
			}
		}
	}

	private static function makeRelationKey( string $a, string $b, string $prop ): string {
		$sorted = [ $a, $b ];
		sort( $sorted, SORT_STRING );
		return $sorted[0] . '::' . $prop . '::' . $sorted[1];
	}

	public static function resetSeenRelations(): void {
		self::$relationsSeen = [];
	}
}
