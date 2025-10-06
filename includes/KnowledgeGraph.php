<?php

/**
 * KnowledgeGraph
 *
 * @license GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

// use MediaWiki\Extension\KnowledgeGraph\Aliases\Category as CategoryClass;
use MediaWiki\Extension\KnowledgeGraph\Aliases\Title as TitleClass;
use MediaWiki\MediaWikiServices;
use MediaWiki\Revision\SlotRecord;
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
		$out->addModules( 'ext.KnowledgeGraph' );
		return true;
	}

	/**
	 * @param Parser $parser
	 */
	public static function onParserFirstCallInit( Parser $parser ) {
		$parser->setFunctionHook( 'knowledgegraph', [ self::class, 'parserFunctionKnowledgeGraph' ] );
	}

	/**
	 * @param DatabaseUpdater|null $updater
	 */
	public static function onLoadExtensionSchemaUpdates( DatabaseUpdater $updater = null ) {
		$text = file_get_contents( __DIR__ . '/../data/KnowledgeGraphOptions.js' );
		$user = RequestContext::getMain()->getUser();
		$title = TitleClass::makeTitleSafe( NS_MEDIAWIKI, 'KnowledgeGraphOptions' );

		$wikiPage = self::getWikiPage( $title );
		$pageUpdater = $wikiPage->newPageUpdater( $user );

		// @see includes/Defines.php
		$modelId = CONTENT_MODEL_JAVASCRIPT;
		$slotContent = ContentHandler::makeContent( $text, $title, $modelId );
		$slotName = SlotRecord::MAIN;
		$pageUpdater->setContent( $slotName, $slotContent );

		$summary = "KnowledgeGraph";
		$flags = EDIT_INTERNAL;
		$comment = CommentStoreComment::newUnsavedComment( $summary );
		$pageUpdater->saveRevision( $comment, $flags );
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
		// property-related options
		foreach ( $values as $val ) {
			if ( preg_match( '/^property-options(\?(.+))?=(.+)/', $val, $match ) ) {
				$title_ = TitleClass::makeTitleSafe( \SMW_NS_PROPERTY, $match[2] );
				if ( $title_ ) {
					$propertyOptions[$title_->getText()] = $match[3];
				}
			}
		}

		foreach ( $params['nodes'] as $titleText ) {
			$title_ = TitleClass::newFromText( $titleText );
			if ( $title_ && $title_->isKnown() ) {
				if ( !isset( self::$data[$title_->getFullText()] ) ) {
					self::setSemanticDataFromApi( $title_, $params['properties'], 0, $params['depth'] );
				}
			}
		}

		$graphOptions = [];
		if ( !empty( $params['graph-options'] ) ) {
			// , NS_KNOWLEDGEGRAPH
			$title_ = TitleClass::newFromText( $params['graph-options'], NS_MEDIAWIKI );

			if ( $title_ && $title_->isKnown() ) {
				// $graphOptions = json_decode( self::getWikipageContent( $title_ ), true );
				$graphOptions = self::getWikipageContent( $title_ );
			}
		}

		foreach ( $propertyOptions as $property => $titleText ) {
			$title_ = TitleClass::newFromText( $titleText, NS_MEDIAWIKI );
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

		$out->setExtensionData( 'knowledgegraphs', self::$graphs );

		$paletteName = $params['palette'] ?? 'default';
		$colors = $GLOBALS['wgKnowledgeGraphColorPalettes'][$paletteName]
				?? $GLOBALS['wgKnowledgeGraphColorPalettes']['default'];

		$out->addJsConfigVars( [
			'KnowledgeGraphShowImages' => $GLOBALS['wgKnowledgeGraphShowImages'],
			'KnowledgeGraphDisableCredits' => $GLOBALS['wgKnowledgeGraphDisableCredits'],
			'wgKnowledgeGraphColorPalette' => $colors
		] );

		return [
			'<div class="KnowledgeGraph" id="knowledgegraph-wrapper-' . key( self::$graphs ) . '">'
				. wfMessage( 'knowledge-graph-wrapper-loading' )->text() . '</div>',
			'noparse' => true,
			'isHTML' => true
		];
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
	 * @param Title|MediaWiki\Title\Title $title $title
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
	 * @param Title|MediaWiki\Title\Title $title
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
		 $res = $dbr->select( 'categorylinks',
			[ 'pageid' => 'cl_from' ],
			[ 'cl_to' => str_replace( ' ', '_', $category ) ],
			__METHOD__,
			$options
		 );
		 $ret = [];
		foreach ( $res as $row ) {
			$title_ = TitleClass::newFromID( $row->pageid );
			if ( $title_ ) {
				$ret[] = $title_;
			}
		}
		return $ret;

		// *** this does not work with numerical offset
		// $cat = CategoryClass::newFromName( str_replace( ' ', '_', $category ) );
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
	 * @param Title|MediaWiki\Title\Title $title
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

		if ( $depth > $maxDepth ) {
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
					$linkedTitle = explode( '#', $item['item'] )[0];
					$linkedTitle = $linkedTitle ? str_replace( '_', ' ', $linkedTitle ) : null;
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
