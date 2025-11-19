<?php

use MediaWiki\Extension\KnowledgeGraph\Aliases\Title as TitleClass;

/**
 * @ingroup SpecialPage
 */
class SpecialKnowledgeGraphDesigner extends SpecialPage {
	/**
	 * @inheritDoc
	 */
	public function __construct() {
		$listed = true;
		parent::__construct( 'KnowledgeGraphDesigner', '', $listed );
	}

	/**
	 * @inheritDoc
	 */
	public function execute( $par ) {
		$this->setHeaders();
		$this->outputHeader();

		$out = $this->getOutput();

		$out->addModules( [ 'ext.KnowledgeGraph' ] );

		$this->addHelpLink( 'Extension:KnowledgeGraph' );

		$defaultParameters = [
			'nodes' => [ '', 'array' ],
			'properties' => [ '', 'array' ],
			'nodes-by-properties' => [ '', 'array' ],
			'depth' => [ '3', 'integer' ],
			'graph-options' => [ '', 'string' ],
			'width' => [ '100%', 'string' ],
			'height' => [ '600px', 'string' ],
			'show-toolbar' => [ 'true', 'boolean' ],
			'show-property-type' => [ 'false', 'boolean' ],
			'properties-panel' => [ 'false', 'boolean' ],
			'categories-panel' => [ 'false', 'boolean' ]
		];

		$params = [];
		$params = \KnowledgeGraph::applyDefaultParams( $defaultParameters, $params );

		\KnowledgeGraph::initSMW();
		$title_ = TitleClass::makeTitleSafe( NS_MEDIAWIKI, 'KnowledgeGraphOptions' );

		$graphOptions = [];
		if ( $title_ && $title_->isKnown() ) {
			$graphOptions = \KnowledgeGraph::getWikipageContent( $title_ );
		}
		$propertyOptions = [];

		$params['data'] = \KnowledgeGraph::$data;
		$params['graphOptions'] = $graphOptions;
		$params['propertyOptions'] = $propertyOptions;
		$params['context'] = 'specialpage';

		\KnowledgeGraph::$graphs[] = $params;

		$paletteName = $params['palette'] ?? 'default';
		$colors = $GLOBALS['wgKnowledgeGraphColorPalettes'][$paletteName]
				?? $GLOBALS['wgKnowledgeGraphColorPalettes']['default'];

		$out->addJsConfigVars( [
			'knowledgegraphs' => json_encode( \KnowledgeGraph::$graphs ),
			'KnowledgeGraphShowImages' => $GLOBALS['wgKnowledgeGraphShowImages'],
			'KnowledgeGraphDisableCredits' => $GLOBALS['wgKnowledgeGraphDisableCredits'],
			'wgKnowledgeGraphColorPalette' => $colors,
			'wgExtraNamespaces' => $GLOBALS['wgExtraNamespaces']
		] );

		$out->addHTML(
			'<div class="KnowledgeGraph" id="knowledgegraph-wrapper-' . key( \KnowledgeGraph::$graphs ) . '">'
				. wfMessage( 'knowledge-graph-wrapper-loading' )->text() . '</div>'
		);
	}

	/**
	 * @return string
	 */
	protected function getGroupName() {
		return 'knowledgegraph';
	}
}
