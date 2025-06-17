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

		$visited = [];
		foreach ( $params['nodes'] as $titleText ) {
			$title_ = TitleClass::newFromText( $titleText );
			if ( $title_ && $title_->isKnown() ) {
				if ( !isset( self::$data[$title_->getFullText()] ) ) {
					self::setSemanticDataForParserFunction(
						$title_,
						$params['properties'],
						0,
						$params['depth'],
						$visited
					);
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

		$out->addJsConfigVars( [
			'KnowledgeGraphShowImages' => $GLOBALS['wgKnowledgeGraphShowImages'],
			'KnowledgeGraphDisableCredits' => $GLOBALS['wgKnowledgeGraphDisableCredits']
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
	 * Retrieves semantic data for the given page title, used within the Knowledge Graph Designer context.
	 * Unlike the parser function version, this method includes additional metadata (such as 'context')
	 * to support frontend logic specific to the visual graph designer.
	 *
	 * @see https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/PageProperties/+/refs/heads/1.0.3/includes/PageProperties.php
	 * @param Title|MediaWiki\Title\Title $title
	 * @param array $onlyProperties
	 * @param int $depth
	 * @param int $maxDepth
	 * @param array &$visited
	 * @return array
	 */
	public static function setSemanticDataForDesigner(
		Title $title,
		$onlyProperties,
		$depth,
		$maxDepth,
		array &$visited = []
	) {
		$services = MediaWikiServices::getInstance();
		$langCode = \RequestContext::getMain()->getLanguage()->getCode();
		$propertyRegistry = \SMW\PropertyRegistry::getInstance();
		$dataTypeRegistry = \SMW\DataTypeRegistry::getInstance();

		$wikiPage = self::getWikiPage( $title );
		$fullTitleText = $title->getFullText();
		if ( !in_array( $fullTitleText, $visited, true ) ) {
			$visited[] = $fullTitleText;
		}

		$categories = [];
		$iterator = $wikiPage->getCategories();

		while ( $iterator->valid() ) {
			$text_ = $iterator->current()->getText();
			$categories[] = $text_;
			$iterator->next();
		}

		$output = [
			'properties' => [],
			'categories' => $categories
		];

		if ( $title->getNamespace() === NS_FILE ) {
			$img = $services->getRepoGroup()->findFile( $title );
			if ( $img ) {
				$output['src'] = $img->getFullUrl();
			}
		}

		// ***important, this prevents infinite recursion
		// no properties
		self::$data[$title->getFullText()] = [];

		$subject = new \SMW\DIWikiPage( $title->getDbKey(), $title->getNamespace() );
		$semanticData = self::$SMWStore->getSemanticData( $subject );

		foreach ( $semanticData->getProperties() as $property ) {
			$key = $property->getKey();
			if ( in_array( $key, self::$exclude ) ) {
				continue;
			}

			$propertyDv = self::$SMWDataValueFactory->newDataValueByItem( $property, null );
			if ( !$property->isUserAnnotable() || !$propertyDv->isVisible() ) {
				continue;
			}

			$canonicalLabel = $property->getCanonicalLabel();
			$preferredLabel = $property->getPreferredLabel();

			if ( count( $onlyProperties )
				&& !in_array( $canonicalLabel, $onlyProperties )
				&& !in_array( $preferredLabel, $onlyProperties )
			) {
				$onlyProperties[] = $canonicalLabel;
			}

			$description = $propertyRegistry->findPropertyDescriptionMsgKeyById( $key );
			$typeID = $property->findPropertyTypeID();

			if ( $description ) {
				$description = wfMessage( $description )->text();
			}
			$typeLabel = $dataTypeRegistry->findTypeLabel( $typeID );

			if ( empty( $typeLabel ) ) {
				$typeId_ = $dataTypeRegistry->getFieldType( $typeID );
				$typeLabel = $dataTypeRegistry->findTypeLabel( $typeId_ );
			}

			$propertyTitle = $property->getCanonicalDiWikiPage()->getTitle();
			$objKey = $propertyTitle->getFullText();

			$output['properties'][$objKey] = [
				// 'url' => $propertyTitle->getFullURL(),
				'key' => $key,
				'typeId' => $typeID,
				'canonicalLabel' => $canonicalLabel,
				'preferredLabel' => $preferredLabel,
				'typeLabel' => $typeLabel,
				'description' => $description,
				'values' => []
			];

			foreach ( $semanticData->getPropertyValues( $property ) as $dataItem ) {
				$dataValue = self::$SMWDataValueFactory->newDataValueByItem( $dataItem, $property );
				if ( $dataValue->isValid() ) {
					// *** are they necessary ?
					$dataValue->setOption( 'no.text.transformation', true );
					$dataValue->setOption( 'form/short', true );

					$obj_ = [];
					if ( $typeID === '_wpg' ) {
						$title_ = $dataItem->getTitle();
						if ( $title_ && $title_->isKnown() ) {
							if ( !isset( self::$data[$title_->getFullText()] ) ) {
								if ( $depth < $maxDepth ) {
									self::setSemanticDataForDesigner(
										$title_,
										$onlyProperties,
										++$depth,
										$maxDepth,
										$visited
									);
								} else {
									// not loaded
									self::$data[$title_->getFullText()] = null;
								}
							}
							$obj_['value'] = $title_->getFullText();

							if ( $title_->getNamespace() === NS_FILE ) {
								$img_ = $services->getRepoGroup()->findFile( $title_ );
								if ( $img_ ) {
									$obj_['src'] = $img_->getFullUrl();
								}
							}
						} elseif ( !isset( self::$data[str_replace( '_', ' ', $dataValue->getWikiValue() )] ) ) {
							$obj_['value'] = str_replace( '_', ' ', $dataValue->getWikiValue() );
						}
					} else {
						$obj_['value'] = $dataValue->getWikiValue();
					}

					$output['properties'][$objKey]['values'][] = $obj_;
				}

				$propertyDI = \SMW\DIProperty::newFromUserLabel( $canonicalLabel );
				$results = self::getSubjectsByProperty(
					$propertyDI,
					$limit,
					0,
					$fullTitleText
				);

				foreach ( $results as $subjectDI ) {
					$sourceTitle = Title::newFromText(
						$subjectDI->getDBkey(),
						$subjectDI->getNamespace()
					);

					$subject = new \SMW\DIWikiPage( $sourceTitle->getDbKey(), $sourceTitle->getNamespace() );
					$semanticData = self::$SMWStore->getSemanticData( $subject );

					foreach ( $semanticData->getProperties() as $property ) {
						$key = $property->getKey();
						if ( str_replace( '_', ' ', $key ) === $propertyLabel ) {
							$typeID = $property->findPropertyTypeID();
							$typeLabel = $dataTypeRegistry->findTypeLabel( $typeID );

							if ( $sourceTitle && !in_array( $sourceTitle->getFullText(), $visited, true ) ) {
								self::addInversePropertyToOutput(
									$canonicalLabel,
									$sourceTitle,
									$preferredLabel,
									$typeID,
									$typeLabel,
									$output
								);

								if ( !isset( self::$data[$sourceTitle->getFullText()] ) ) {
									if ( $depth < $maxDepth ) {
										self::setSemanticDataForDesigner(
											$sourceTitle,
											$onlyProperties,
											$depth + 1,
											$maxDepth,
											$visited
										);
									} else {
										self::$data[$sourceTitle->getFullText()] = null;
									}
								}
							}
						}
					}
				}
			}
		}

		$resultsToCheck = [];
		if ( count( $onlyProperties ) > 0 ) {
			$countProps = 0;
			foreach ( $onlyProperties as $property ) {
				$propertyLabel = str_replace( '_', ' ', $property );
				$propertyDI = \SMW\DIProperty::newFromUserLabel( $propertyLabel );
				$results = self::getSubjectsByProperty(
					$propertyDI,
					$limit,
					0,
					$fullTitleText
				);
				$countProps++;
				$countResults = 0;

				if ( count( $results ) === 0 ) {
					$visitedTitle = [];
					foreach ( $resultsToCheck as $subjectDI ) {
						$sourceTitle = Title::newFromText(
							$subjectDI->getDBkey(),
							$subjectDI->getNamespace()
						);

						if ( in_array( $sourceTitle->getFullText(), $visitedTitle, true ) ) {
							continue;
						}

						if ( !isset( self::$data[$sourceTitle->getFullText()] ) ) {
							if ( $depth < $maxDepth ) {
								self::setSemanticDataForDesigner(
									$sourceTitle,
									$onlyProperties,
									$depth + 1,
									$maxDepth,
									$visited
								);
							} else {
								self::$data[$sourceTitle->getFullText()] = null;
							}

							$visitedTitle[] = $sourceTitle->getFullText();
						}
					}
				}

				foreach ( $results as $subjectDI ) {
					$resultsToCheck[] = $subjectDI;
					$sourceTitle = Title::newFromText(
						$subjectDI->getDBkey(),
						$subjectDI->getNamespace()
					);
					$countResults++;

					$subject = new \SMW\DIWikiPage( $sourceTitle->getDbKey(), $sourceTitle->getNamespace() );
					$semanticData = self::$SMWStore->getSemanticData( $subject );

					foreach ( $semanticData->getProperties() as $property ) {
						$key = $property->getKey();

						if ( str_replace( '_', ' ', $key ) === $propertyLabel ) {
							$typeID = $property->findPropertyTypeID();
							$typeLabel = $dataTypeRegistry->findTypeLabel( $typeID );

							if ( $sourceTitle && !in_array( $sourceTitle->getFullText(), $visited, true ) ) {
								self::addInversePropertyToOutput(
									$propertyLabel,
									$sourceTitle,
									"",
									$typeID,
									$typeLabel,
									$output
								);

								foreach ( $semanticData->getProperties() as $property ) {
									$key = $property->getKey();
									if ( in_array( $key, self::$exclude ) ) {
										continue;
									}

									$propertyDv = self::$SMWDataValueFactory->newDataValueByItem( $property, null );
									if ( !$property->isUserAnnotable() || !$propertyDv->isVisible() ) {
										continue;
									}

									$typeID = $property->findPropertyTypeID();

									if ( $typeID === '_wpg' ) {
										$typeLabel = $dataTypeRegistry->findTypeLabel( $typeID );

										if ( empty( $typeLabel ) ) {
											$typeId_ = $dataTypeRegistry->getFieldType( $typeID );
											$typeLabel = $dataTypeRegistry->findTypeLabel( $typeId_ );
										}

										$canonicalName = MediaWikiServices::getInstance()
										->getNamespaceInfo()
										->getCanonicalName( SMW_NS_PROPERTY );

										$inverseKey = $canonicalName . ':' . $propertyLabel;

										$output['properties'][$inverseKey]['typeLabel'] = $typeLabel;
									}
								}

								if ( count( $onlyProperties ) === $countProps ) {
									$visitedTitle = [];
									foreach ( $resultsToCheck as $subjectDI ) {
										$sourceTitle = Title::newFromText(
											$subjectDI->getDBkey(),
											$subjectDI->getNamespace()
										);

										if ( in_array( $sourceTitle->getFullText(), $visitedTitle, true ) ) {
											continue;
										}

										if ( !isset( self::$data[$sourceTitle->getFullText()] ) ) {
											if ( $depth < $maxDepth ) {
												self::setSemanticDataForDesigner(
													$sourceTitle,
													$onlyProperties,
													$depth + 1,
													$maxDepth,
													$visited
												);
											} else {
												self::$data[$sourceTitle->getFullText()] = null;
											}

											$visitedTitle[] = $sourceTitle->getFullText();
										}
									}
								}
							}

							if ( $sourceTitle ) {
								self::addInversePropertyToOutput(
									$propertyLabel,
									$sourceTitle,
									"",
									$typeID,
									$typeLabel,
									$output
								);

								foreach ( $semanticData->getProperties() as $property ) {
									$key = $property->getKey();
									if ( in_array( $key, self::$exclude ) ) {
										continue;
									}

									$propertyDv = self::$SMWDataValueFactory->newDataValueByItem( $property, null );
									if ( !$property->isUserAnnotable() || !$propertyDv->isVisible() ) {
										continue;
									}

									$typeID = $property->findPropertyTypeID();

									if ( $typeID === '_wpg' ) {
										$typeLabel = $dataTypeRegistry->findTypeLabel( $typeID );

										if ( empty( $typeLabel ) ) {
											$typeId_ = $dataTypeRegistry->getFieldType( $typeID );
											$typeLabel = $dataTypeRegistry->findTypeLabel( $typeId_ );
										}

										$canonicalName = MediaWikiServices::getInstance()
										->getNamespaceInfo()
										->getCanonicalName( SMW_NS_PROPERTY );

										$inverseKey = $canonicalName . ':' . $propertyLabel;

										$output['properties'][$inverseKey]['typeLabel'] = $typeLabel;
									}
								}

								if ( count( $onlyProperties ) === $countProps ) {
									$visitedTitle = [];
									foreach ( $resultsToCheck as $subjectDI ) {
										$sourceTitle = Title::newFromText(
											$subjectDI->getDBkey(),
											$subjectDI->getNamespace()
										);

										if ( in_array( $sourceTitle->getFullText(), $visitedTitle, true ) ) {
											continue;
										}

										if ( !isset( self::$data[$sourceTitle->getFullText()] ) ) {
											if ( $depth < $maxDepth ) {
												self::setSemanticDataForDesigner(
													$sourceTitle,
													$onlyProperties,
													$depth + 1,
													$maxDepth,
													$visited
												);
											} else {
												self::$data[$sourceTitle->getFullText()] = null;
											}

											$visitedTitle[] = $sourceTitle->getFullText();
										}
									}
								}
							}
						}
					}
				}
			}
		}

		$output['context'] = 'KnowledgeGraphDesigner';
		self::$data[$title->getFullText()] = $output;
	}

	/**
	 * Retrieves semantic data for the given page title, used within a parser function context.
	 * Supports recursive traversal of linked pages up to a defined depth.
	 *
	 * @see https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/PageProperties/+/refs/heads/1.0.3/includes/PageProperties.php
	 * @param Title|MediaWiki\Title\Title $title
	 * @param array $onlyProperties
	 * @param int $depth
	 * @param int $maxDepth
	 * @param array &$visited
	 * @return array
	 */
	public static function setSemanticDataForParserFunction(
		Title $title,
		$onlyProperties,
		$depth,
		$maxDepth,
		array &$visited = []
	) {
		$services = MediaWikiServices::getInstance();
		$langCode = \RequestContext::getMain()->getLanguage()->getCode();
		$propertyRegistry = \SMW\PropertyRegistry::getInstance();
		$dataTypeRegistry = \SMW\DataTypeRegistry::getInstance();

		$wikiPage = self::getWikiPage( $title );
		$fullTitleText = $title->getFullText();
		if ( !in_array( $fullTitleText, $visited, true ) ) {
			$visited[] = $fullTitleText;
		}

		$categories = [];
		$iterator = $wikiPage->getCategories();

		while ( $iterator->valid() ) {
			$text_ = $iterator->current()->getText();
			$categories[] = $text_;
			$iterator->next();

			// if ( !array_key_exists( $text_, self::$categories ) ) {
			// 	self::$categories[$text_] = [];
			// }

			// if ( !in_array( $title->getFullText(), self::$categories[$text_] ) ) {
			// 	self::$categories[$text_][] = $title->getFullText();
			// }
		}

		$output = [
			'properties' => [],
			'categories' => $categories
		];

		if ( $title->getNamespace() === NS_FILE ) {
			$img = $services->getRepoGroup()->findFile( $title );
			if ( $img ) {
				$output['src'] = $img->getFullUrl();
			}
		}

		// ***important, this prevents infinite recursion
		// no properties
		self::$data[$title->getFullText()] = [];

		$subject = new \SMW\DIWikiPage( $title->getDbKey(), $title->getNamespace() );
		$semanticData = self::$SMWStore->getSemanticData( $subject );
		$preferredLabel = '';

		foreach ( $semanticData->getProperties() as $property ) {
			$key = $property->getKey();
			if ( in_array( $key, self::$exclude ) ) {
				continue;
			}

			$propertyDv = self::$SMWDataValueFactory->newDataValueByItem( $property, null );
			if ( !$property->isUserAnnotable() || !$propertyDv->isVisible() ) {
				continue;
			}

			$canonicalLabel = $property->getCanonicalLabel();
			$preferredLabel = $property->getPreferredLabel();

			$description = $propertyRegistry->findPropertyDescriptionMsgKeyById( $key );
			$typeID = $property->findPropertyTypeID();

			if ( count( $onlyProperties )
				&& !in_array( $canonicalLabel, $onlyProperties )
				&& !in_array( $preferredLabel, $onlyProperties )
			) {
				continue;
			}

			if ( $description ) {
				$description = wfMessage( $description )->text();
			}
			$typeLabel = $dataTypeRegistry->findTypeLabel( $typeID );

			if ( empty( $typeLabel ) ) {
				$typeId_ = $dataTypeRegistry->getFieldType( $typeID );
				$typeLabel = $dataTypeRegistry->findTypeLabel( $typeId_ );
			}

			$propertyTitle = $property->getCanonicalDiWikiPage()->getTitle();
			$objKey = $propertyTitle->getFullText();

			$output['properties'][$objKey] = [
				// 'url' => $propertyTitle->getFullURL(),
				'key' => $key,
				'typeId' => $typeID,
				'canonicalLabel' => $canonicalLabel,
				'preferredLabel' => $preferredLabel,
				'typeLabel' => $typeLabel,
				'description' => $description,
				'isInverse' => false,
				'values' => [],
			];

			foreach ( $semanticData->getPropertyValues( $property ) as $dataItem ) {
				$dataValue = self::$SMWDataValueFactory->newDataValueByItem( $dataItem, $property );
				if ( $dataValue->isValid() ) {
					// *** are they necessary ?
					$dataValue->setOption( 'no.text.transformation', true );
					$dataValue->setOption( 'form/short', true );

					$obj_ = [];
					$title_ = null;
					if ( $typeID === '_wpg' ) {
						$title_ = $dataItem->getTitle();
						if ( $title_ && $title_->isKnown() ) {
							if ( !isset( self::$data[$title_->getFullText()] ) ) {
								if ( $depth < $maxDepth ) {
									$obj_['direction'] = 'direct';
									self::setSemanticDataForParserFunction(
										$title_,
										$onlyProperties,
										$depth + 1,
										$maxDepth,
										$visited
									);
								} else {
									// not loaded
									self::$data[$title_->getFullText()] = null;
								}
							}

							$obj_['value'] = $title_->getFullText();

							if ( $title_->getNamespace() === NS_FILE ) {
								$img_ = $services->getRepoGroup()->findFile( $title_ );
								if ( $img_ ) {
									$obj_['src'] = $img_->getFullUrl();
								}
							}
						} elseif ( !isset( self::$data[str_replace( '_', ' ', $dataValue->getWikiValue() )] ) ) {
							$obj_['direction'] = 'direct';
							$obj_['value'] = str_replace( '_', ' ', $dataValue->getWikiValue() );
						}
					} else {
						$obj_['direction'] = 'direct';
						$obj_['value'] = $dataValue->getWikiValue();
					}

					self::processInverseProperties(
						$typeID,
						$typeLabel,
						$onlyProperties,
						$fullTitleText,
						$preferredLabel,
						$depth,
						$maxDepth,
						$visited,
						$output
					);

					$output['properties'][$objKey]['values'][] = $obj_;
				}
			}
		}

		self::processInverseProperties(
			$typeID,
			$typeLabel,
			$onlyProperties,
			$fullTitleText,
			$preferredLabel,
			$depth,
			$maxDepth,
			$visited,
			$output
		);

		self::$data[$title->getFullText()] = $output;
	}

	/**
	 * Processes inverse semantic properties for entities of type `_wpg`.
	 *
	 * This method identifies and processes all properties from the `$onlyProperties` list that are marked as
	 * inverse (i.e., start with a `-` prefix). For each such property, it retrieves all subjects that reference
	 * the current entity (`$fullTitleText`) using that property.
	 *
	 * The results are added to the `$output` array, marking them as inverse relationships. If the depth limit
	 * (`$maxDepth`) has not been reached, the method recursively processes each related subject to build a
	 * deeper semantic graph.
	 *
	 * @param string|null $typeID The type ID of the entity; must be `_wpg` or null to proceed.
	 * @param string|null $typeLabel The label associated with the type, used for display purposes.
	 * @param array $onlyProperties A list of property labels to filter by; inverse properties start with `-`.
	 * @param string $fullTitleText The full title text of the current page, used to match incoming references.
	 * @param string $preferredLabel The display label to associate with the found inverse properties.
	 * @param int $depth The current recursion depth.
	 * @param int $maxDepth The maximum allowed recursion depth.
	 * @param array &$visited A list of already visited page titles to prevent infinite loops.
	 * @param array &$output The data structure where inverse property results will be added.
	 */
	private static function processInverseProperties(
		?string $typeID,
		?string $typeLabel,
		array $onlyProperties,
		string $fullTitleText,
		string $preferredLabel,
		int $depth,
		int $maxDepth,
		array &$visited,
		array &$output
	): void {
		$dataTypeRegistry = \SMW\DataTypeRegistry::getInstance();
		if ( ( $typeID !== '_wpg' && $typeID !== null ) || count( $onlyProperties ) === 0 ) {

			if ( $typeID === '_txt' ) {
				$inverseProps = array_filter( $onlyProperties, static function ( $property ) {
					return strpos( $property, '-' ) === 0;
				} );

				foreach ( $inverseProps as $inversePropertyLabel ) {
					$cleanLabel = ltrim( $inversePropertyLabel, '-' );
					$propertyDI = \SMW\DIProperty::newFromUserLabel( $cleanLabel );

					$results = self::getSubjectsByProperty(
						$propertyDI,
						$limit,
						0,
						$fullTitleText
					);

					$nodes = [];
					foreach ( $results as $subjectDI ) {
						$sourceTitle = Title::newFromText(
							$subjectDI->getDBkey(),
							$subjectDI->getNamespace()
						);
						if ( !in_array( $sourceTitle->getFullText(), $nodes, true ) ) {
							$nodes[] = $sourceTitle->getFullText();
						}
					}

					foreach ( $results as $subjectDI ) {
						$sourceTitle = Title::newFromText(
							$subjectDI->getDBkey(),
							$subjectDI->getNamespace()
						);

						$subject = new \SMW\DIWikiPage( $sourceTitle->getDbKey(), $sourceTitle->getNamespace() );
						$semanticData = self::$SMWStore->getSemanticData( $subject );

						foreach ( $semanticData->getProperties() as $property ) {
							$key = $property->getKey();

							if ( str_replace( '_', ' ', $key ) === $cleanLabel ) {
								$typeID = $property->findPropertyTypeID();
								$typeLabel = $dataTypeRegistry->findTypeLabel( $typeID );

								if ( $sourceTitle && !in_array( $sourceTitle->getFullText(), $visited, true ) ) {
									self::addInversePropertyToOutput(
										$cleanLabel,
										$sourceTitle,
										$preferredLabel,
										$typeID,
										$typeLabel,
										$output
									);

									if ( !isset( self::$data[$sourceTitle->getFullText()] ) ) {
										if ( $depth < $maxDepth ) {
											self::setSemanticDataForParserFunction(
												$sourceTitle,
												$onlyProperties,
												$depth + 1,
												$maxDepth,
												$visited
											);
										} else {
											self::$data[$sourceTitle->getFullText()] = null;
										}
									}
								}
							}
						}
					}
				}
			}
		}

		$typeID = '_wpg';

		$inverseProps = array_filter( $onlyProperties, static function ( $property ) {
			return strpos( $property, '-' ) === 0;
		} );

		foreach ( $inverseProps as $inversePropertyLabel ) {
			$cleanLabel = ltrim( $inversePropertyLabel, '-' );
			$propertyDI = \SMW\DIProperty::newFromUserLabel( $cleanLabel );

			$results = self::getSubjectsByProperty(
				$propertyDI,
				$limit,
				0,
				$fullTitleText
			);

			$nodes = [];
			foreach ( $results as $subjectDI ) {
				$sourceTitle = Title::newFromText(
					$subjectDI->getDBkey(),
					$subjectDI->getNamespace()
				);
				if ( !in_array( $sourceTitle->getFullText(), $nodes, true ) ) {
					$nodes[] = $sourceTitle->getFullText();
				}
			}

			foreach ( $results as $subjectDI ) {
				$sourceTitle = Title::newFromText(
					$subjectDI->getDBkey(),
					$subjectDI->getNamespace()
				);

				$subject = new \SMW\DIWikiPage( $sourceTitle->getDbKey(), $sourceTitle->getNamespace() );
				$semanticData = self::$SMWStore->getSemanticData( $subject );

				foreach ( $semanticData->getProperties() as $property ) {
					$key = $property->getKey();

					if ( str_replace( '_', ' ', $key ) === $cleanLabel ) {
						$typeID = $property->findPropertyTypeID();
						$typeLabel = $dataTypeRegistry->findTypeLabel( $typeID );

						if ( $sourceTitle && !in_array( $sourceTitle->getFullText(), $visited, true ) ) {
							self::addInversePropertyToOutput(
								$cleanLabel,
								$sourceTitle,
								$preferredLabel,
								$typeID,
								$typeLabel,
								$output
							);

							if ( !isset( self::$data[$sourceTitle->getFullText()] ) ) {
								if ( $depth < $maxDepth ) {
									self::setSemanticDataForParserFunction(
										$sourceTitle,
										$onlyProperties,
										$depth + 1,
										$maxDepth,
										$visited
									);
								} else {
									self::$data[$sourceTitle->getFullText()] = null;
								}
							}
						}

						if ( $sourceTitle ) {
							self::addInversePropertyToOutput(
								$cleanLabel,
								$sourceTitle,
								$preferredLabel,
								$typeID,
								$typeLabel,
								$output
							);

							if ( !isset( self::$data[$sourceTitle->getFullText()] ) ) {
								if ( $depth < $maxDepth ) {
									self::setSemanticDataForParserFunction(
										$sourceTitle,
										$onlyProperties,
										$depth + 1,
										$maxDepth,
										$visited
									);
								} else {
									self::$data[$sourceTitle->getFullText()] = null;
								}
							}
						}
					}
				}
			}
		}
	}

	/**
	 * Adds an inverse property entry to the output array.
	 *
	 * This method populates the `$output['properties']` structure with details about an inverse property
	 * relationship, including the source page that references the current entity. The property is marked
	 * as inverse and is associated with labels and type information.
	 *
	 * @param string $cleanLabel The user-defined label of the property, with the '-' prefix removed.
	 * @param Title $sourceTitle The MediaWiki title object of the page that links to the current entity.
	 * @param string $preferredLabel The label to use for display purposes.
	 * @param string $typeID The type ID of the property, usually `_wpg`.
	 * @param string|null $typeLabel The label associated with the type, used for display purposes.
	 * @param array &$output The data structure where the inverse property information is stored.
	 */
	private static function addInversePropertyToOutput(
		string $cleanLabel,
		Title $sourceTitle,
		string $preferredLabel,
		string $typeID,
		?string $typeLabel,
		array &$output
	): void {
		$canonicalName = MediaWikiServices::getInstance()
							->getNamespaceInfo()
							->getCanonicalName( SMW_NS_PROPERTY );

		$inverseKey = $canonicalName . ':' . $cleanLabel;

		$obj_inv = [
			'direction' => 'inverse',
			'value' => $sourceTitle->getFullText(),
		];

		$output['properties'][$inverseKey]['values'][] = $obj_inv;
		$output['properties'][$inverseKey]['canonicalLabel'] = $cleanLabel;
		$output['properties'][$inverseKey]['preferredLabel'] = $preferredLabel;
		$output['properties'][$inverseKey]['typeId'] = $typeID;
		$output['properties'][$inverseKey]['typeLabel'] = $typeLabel;
		$output['properties'][$inverseKey]['isInverse'] = true;
	}
}