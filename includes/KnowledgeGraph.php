<?php

/**
 * KnowledgeGraph
 *
 * @license GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
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
	 * Caches resolved `_PEFU` external-formatter DataValues per property key,
	 * for `formatLinkForValue()` to reuse across values of the same property.
	 *
	 * @var array<string, \SMW\DataValues\ExternalFormatterUriValue>
	 */
	private static $externalFormatterValues = [];

	/**
	 * Fallback node-color palette used when `$wgKnowledgeGraphColorPalettes` is
	 * entirely unset (e.g. `extension.json`'s registered config default did not
	 * load). Mirrors `extension.json`'s `KnowledgeGraphColorPalettes` default.
	 *
	 * @var string[]
	 */
	private const DEFAULT_COLOR_PALETTE = [
		'#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
		'#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
	];

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

	/**
	 * MediaWiki\Request\FauxRequest exists since MW 1.40; the global \FauxRequest
	 * alias was removed in MW 1.41. The extension supports MW 1.39+, so both
	 * class names must be handled.
	 *
	 * @param array $params
	 * @param bool $wasPosted
	 * @return \WebRequest
	 */
	private static function newFauxRequest( array $params, bool $wasPosted ) {
		if ( class_exists( \MediaWiki\Request\FauxRequest::class ) ) {
			return new \MediaWiki\Request\FauxRequest( $params, $wasPosted );
		}
		return new \FauxRequest( $params, $wasPosted );
	}

	/**
	 * Builds a context for an in-process ApiMain call that carries the
	 * given request params while preserving the base context's
	 * authenticated user/session, so permission checks inside the invoked
	 * API module see the real caller instead of an anonymous default.
	 *
	 * @param \IContextSource $baseContext
	 * @param array $params
	 * @param bool $wasPosted
	 * @return \IContextSource
	 */
	public static function newDerivativeApiContext( $baseContext, array $params, bool $wasPosted ) {
		$derivativeContextClass = class_exists( \MediaWiki\Context\DerivativeContext::class ) ?
			\MediaWiki\Context\DerivativeContext::class : \DerivativeContext::class;

		$context = new $derivativeContextClass( $baseContext );
		$context->setRequest( self::newFauxRequest( $params, $wasPosted ) );
		return $context;
	}

	/**
	 * @return \IContextSource
	 */
	private static function getMainRequestContext() {
		$requestContextClass = class_exists( \MediaWiki\Context\RequestContext::class ) ?
			\MediaWiki\Context\RequestContext::class : \RequestContext::class;
		return $requestContextClass::getMain();
	}

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
				$title_ = Title::makeTitleSafe( \SMW_NS_PROPERTY, $match[2] );
				if ( $title_ ) {
					$propertyOptions[$title_->getText()] = $match[3];
				}
			}
		}

		foreach ( $params['nodes'] as $titleText ) {
			$title_ = Title::newFromText( $titleText );
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

		foreach ( $propertyOptions as $property => $titleText ) {
			$title_ = Title::newFromText( $titleText, NS_MEDIAWIKI );
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
		$palettes = $GLOBALS['wgKnowledgeGraphColorPalettes'] ?? [ 'default' => self::DEFAULT_COLOR_PALETTE ];
		$colors = $palettes[$paletteName] ?? $palettes['default'];

		$out->setJsConfigVar( 'KnowledgeGraphShowImages', $GLOBALS['wgKnowledgeGraphShowImages'] );
		$out->setJsConfigVar( 'KnowledgeGraphDisableCredits', $GLOBALS['wgKnowledgeGraphDisableCredits'] );
		$out->setJsConfigVar( 'wgKnowledgeGraphColorPalette', $colors );

		$index = count( self::$graphs ) - 1;
		return [
			// False positive: $index is an internal int counter and the message key is a
			// hardcoded literal with plain-text i18n values.
			// @phan-suppress-next-line SecurityCheck-XSS
			'<div class="KnowledgeGraph" id="knowledgegraph-wrapper-' . $index . '">'
				. wfMessage( 'knowledge-graph-wrapper-loading' )->text() . '</div>',
			'noparse' => true,
			'isHTML' => true
		];
	}

	/**
	 * @param \SMW\DIProperty $property
	 * @param int $limit
	 * @param int $offset
	 * @param string|null $targetValue
	 * @return array
	 */
	public static function getSubjectsByProperty( $property, $limit = 100, $offset = 0, $targetValue = null ) {
		$requestOptions = [
			'limit'    => $limit,
			'offset'   => $offset,
			// 'property' => $this->getRequest()->getVal( 'property' ),
			'property' => $property,
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

		$results = self::$SMWStore->getPropertySubjects( $DIProperty, $targetDIValue, $requestOptions );

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

		$api = new \ApiMain( self::newDerivativeApiContext( self::getMainRequestContext(), $apiParams, false ) );
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
					$separator = $GLOBALS['wgKnowledgeGraphListSeparator'] ?? ',';
					$val = array_filter(
						preg_split(
							'/\s*' . preg_quote( $separator, '/' ) . '\s*/',
							$val,
							-1,
							PREG_SPLIT_NO_EMPTY
						) );
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
		$dbr = MediaWikiServices::getInstance()->getConnectionProvider()->getReplicaDatabase();

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
	 * Populates self::$data[$title->getFullText()] as a side effect; callers
	 * read the result from that static property rather than a return value.
	 *
	 * @see https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/PageProperties/+/refs/heads/1.0.3/includes/PageProperties.php
	 * @param Title $title
	 * @param array $onlyProperties
	 * @param int $depth
	 * @param int $maxDepth
	 * @return void
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

		$api = new \ApiMain( self::newDerivativeApiContext( self::getMainRequestContext(), $apiParams, false ) );
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
				$propertyTitle = Title::newFromText( ltrim( $propKey, '-' ) );

				if ( $propertyTitle ) {
					$diProperty = \SMW\DIProperty::newFromUserLabel( $propKey );
					if ( $diProperty ) {
						$typeID = $diProperty->findPropertyValueType();
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
							'linkFormatter' => self::getLinkFormatterInfo( $diProperty, $typeID, $propKey ),
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
					$value = [
						'value' => $item['item'],
						'type' => $item['type'],
					];

					$linkFormatter = $output['properties'][$propKey]['linkFormatter'] ?? null;
					if ( $linkFormatter !== null ) {
						$value['formattedUrl'] = self::formatLinkForValue( $linkFormatter, $propKey, $item['item'] );
					}

					$output['properties'][$propKey]['values'][] = $value;
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
			$title_ = Title::newFromText( $linkedTitle );
			if ( $title_ && $title_->isKnown() ) {
				self::setSemanticDataFromApi( $title_, $onlyProperties, $depth + 1, $maxDepth );
			}
		}
	}

	/**
	 * Resolves link-formatter metadata for a property, if any is configured.
	 * Only the JSON-serializable `kind` is kept on the property's metadata
	 * (this array is sent to the client as-is); an 'external' formatter's
	 * live SMW DataValue is cached separately, keyed by property, for
	 * `formatLinkForValue()` to reuse when appending each value.
	 *
	 * - `_keyw` (Keyword) properties can carry a `_FORMAT_SCHEMA` pointing at a
	 *   `LINK_FORMAT_SCHEMA` page, which SMW itself only renders as a link to
	 *   Special:Ask/Special:SearchByProperty (never an arbitrary external URL);
	 *   JS builds that Special:Ask link client-side from the property's
	 *   canonical label plus the value.
	 * - `_eid` (External Identifier) properties can carry a `_PEFU` formatter
	 *   URI (a URL template containing `$1`), substituted per value via
	 *   `ExternalFormatterUriValue::substituteAndFormatUri()`.
	 *
	 * @param \SMW\DIProperty $diProperty
	 * @param string $typeID
	 * @param string $propKey
	 * @return array{kind:string}|null
	 */
	private static function getLinkFormatterInfo(
		\SMW\DIProperty $diProperty,
		string $typeID,
		string $propKey
	): ?array {
		if ( $typeID === \SMW\DataValues\KeywordValue::TYPE_ID ) {
			$lookup = \SMW\Services\ServicesFactory::getInstance()->getPropertySpecificationLookup();
			$schema = $lookup->getSpecification( $diProperty, new \SMW\DIProperty( '_FORMAT_SCHEMA' ) );

			if ( is_array( $schema ) && $schema !== [] ) {
				return [ 'kind' => 'ask' ];
			}

			return null;
		}

		if ( $typeID === \SMW\DataValues\ExternalIdentifierValue::TYPE_ID ) {
			$lookup = \SMW\Services\ServicesFactory::getInstance()->getPropertySpecificationLookup();
			$formatterUriItem = $lookup->getExternalFormatterUri( $diProperty );

			if ( $formatterUriItem === null ) {
				return null;
			}

			$formatterValue = \SMW\DataValueFactory::getInstance()->newDataValueByItem(
				$formatterUriItem,
				new \SMW\DIProperty( '_PEFU' )
			);

			if ( !( $formatterValue instanceof \SMW\DataValues\ExternalFormatterUriValue ) ) {
				return null;
			}

			self::$externalFormatterValues[$propKey] = $formatterValue;

			return [ 'kind' => 'external' ];
		}

		return null;
	}

	/**
	 * Builds the formatted link URL for a single value, given the property's
	 * resolved link-formatter info.
	 *
	 * @param array{kind:string} $linkFormatter
	 * @param string $propKey
	 * @param string $value
	 * @return string|null
	 */
	private static function formatLinkForValue( array $linkFormatter, string $propKey, string $value ): ?string {
		if ( $linkFormatter['kind'] !== 'external' || !isset( self::$externalFormatterValues[$propKey] ) ) {
			// 'ask' formatting is built client-side (Special:Ask needs no server round-trip).
			return null;
		}

		$formatterValue = self::$externalFormatterValues[$propKey];
		return $formatterValue->substituteAndFormatUri( $value ) ?: null;
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
