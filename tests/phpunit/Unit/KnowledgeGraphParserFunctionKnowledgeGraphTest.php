<?php

use MediaWiki\Title\Title;

/**
 * parserFunctionKnowledgeGraph() only calls getOutput() and getTitle() on the
 * Parser it receives, so a Parser mock stubbing just those two methods is
 * sufficient - no need for a real Parser/parse() round trip. getOutput() is
 * stubbed to return a real ParserOutput (a concrete class), so
 * setExtensionData()/addJsConfigVars() calls can be asserted against real
 * state instead of mock expectations.
 *
 * @covers KnowledgeGraph::parserFunctionKnowledgeGraph
 * @group Database
 */
class KnowledgeGraphParserFunctionKnowledgeGraphTest extends MediaWikiIntegrationTestCase {

	protected function setUp(): void {
		parent::setUp();

		KnowledgeGraph::initSMW();
		$this->resetKnowledgeGraphStatics();

		$this->setMwGlobals( [
			'wgKnowledgeGraphColorPalettes' => [
				'default' => [ '#1f77b4', '#ff7f0e', '#2ca02c' ],
				'pastel'  => [ '#aec7e8', '#ffbb78', '#98df8a' ],
			],
			'wgKnowledgeGraphShowImages' => true,
			'wgKnowledgeGraphDisableCredits' => false,
		] );
	}

	protected function tearDown(): void {
		$this->resetKnowledgeGraphStatics();
		parent::tearDown();
	}

	private function resetKnowledgeGraphStatics(): void {
		$reflection = new ReflectionClass( KnowledgeGraph::class );

		$dataProp = $reflection->getProperty( 'data' );
		$dataProp->setAccessible( true );
		$dataProp->setValue( null, [] );

		$graphsProp = $reflection->getProperty( 'graphs' );
		$graphsProp->setAccessible( true );
		$graphsProp->setValue( null, [] );
	}

	private function newParserMock( Title $title ): Parser {
		$parserOutput = new ParserOutput();

		$parser = $this->createMock( Parser::class );
		$parser->method( 'getOutput' )->willReturn( $parserOutput );
		$parser->method( 'getTitle' )->willReturn( $title );

		return $parser;
	}

	private function callParserFunction( Title $title, array $argv ): array {
		$parser = $this->newParserMock( $title );
		return KnowledgeGraph::parserFunctionKnowledgeGraph( $parser, ...$argv );
	}

	public function testDefaultParametersAreAppliedWhenNoArgumentsPassed() {
		$title = Title::makeTitle( NS_MAIN, 'KGParserFunctionDefaultsPage' );

		$this->callParserFunction( $title, [] );

		$params = KnowledgeGraph::$graphs[0];

		$this->assertSame( [], $params['nodes'] );
		$this->assertSame( [], $params['properties'] );
		$this->assertSame( 3, $params['depth'] );
		$this->assertSame( '', $params['graph-options'] );
		$this->assertSame( '400px', $params['width'] );
		$this->assertSame( '400px', $params['height'] );
		$this->assertFalse( $params['show-toolbar'] );
		$this->assertFalse( $params['show-property-type'] );
		$this->assertFalse( $params['properties-panel'] );
		$this->assertFalse( $params['categories-panel'] );
		$this->assertSame( 'default', $params['palette'] );
	}

	public function testShowToolbarParameterIsForcedFalseEvenWhenExplicitlyEnabled() {
		$title = Title::makeTitle( NS_MAIN, 'KGParserFunctionShowToolbarPage' );

		$this->callParserFunction( $title, [ 'show-toolbar=true' ] );

		$this->assertFalse( KnowledgeGraph::$graphs[0]['show-toolbar'] );
	}

	public function testPropertyOptionsParameterResolvesPropertyNameAndOptionsTitle() {
		$title = Title::makeTitle( NS_MAIN, 'KGParserFunctionPropertyOptionsPage' );
		$optionsTitle = Title::makeTitleSafe( NS_MEDIAWIKI, 'KGParserFunctionPropOptions' );
		$this->insertPage( $optionsTitle, 'graph options content' );

		$this->callParserFunction( $title, [
			'property-options?HasProperty1=Mediawiki:KGParserFunctionPropOptions',
		] );

		$propertyOptions = KnowledgeGraph::$graphs[0]['propertyOptions'];

		$this->assertArrayHasKey( 'HasProperty1', $propertyOptions );
		$this->assertSame( 'graph options content', $propertyOptions['HasProperty1'] );
	}

	public function testPropertyOptionsWithUnresolvableOptionsTitleIsRemoved() {
		$title = Title::makeTitle( NS_MAIN, 'KGParserFunctionPropertyOptionsUnknownPage' );

		$this->callParserFunction( $title, [
			'property-options?HasProperty1=Mediawiki:KGParserFunctionPropOptionsDoesNotExist',
		] );

		$this->assertArrayNotHasKey( 'HasProperty1', KnowledgeGraph::$graphs[0]['propertyOptions'] );
	}

	public function testGraphOptionsResolvesContentForKnownMediawikiTitle() {
		$title = Title::makeTitle( NS_MAIN, 'KGParserFunctionGraphOptionsKnownPage' );
		$optionsTitle = Title::makeTitleSafe( NS_MEDIAWIKI, 'KGParserFunctionGraphOptions' );
		$this->insertPage( $optionsTitle, 'graph options wikitext' );

		$this->callParserFunction( $title, [
			'graph-options=Mediawiki:KGParserFunctionGraphOptions',
		] );

		$this->assertSame( 'graph options wikitext', KnowledgeGraph::$graphs[0]['graphOptions'] );
	}

	public function testGraphOptionsIsEmptyArrayForUnknownMediawikiTitle() {
		$title = Title::makeTitle( NS_MAIN, 'KGParserFunctionGraphOptionsUnknownPage' );

		$this->callParserFunction( $title, [
			'graph-options=Mediawiki:KGParserFunctionGraphOptionsDoesNotExist',
		] );

		$this->assertSame( [], KnowledgeGraph::$graphs[0]['graphOptions'] );
	}

	public function testExplicitPaletteParameterSelectsMatchingColors() {
		$title = Title::makeTitle( NS_MAIN, 'KGParserFunctionPalettePage' );

		$parser = $this->newParserMock( $title );
		KnowledgeGraph::parserFunctionKnowledgeGraph( $parser, 'palette=pastel' );

		$jsConfigVars = $parser->getOutput()->getJsConfigVars();

		$this->assertSame(
			[ '#aec7e8', '#ffbb78', '#98df8a' ],
			$jsConfigVars['wgKnowledgeGraphColorPalette']
		);
	}

	public function testUnknownPaletteParameterFallsBackToDefaultColors() {
		$title = Title::makeTitle( NS_MAIN, 'KGParserFunctionUnknownPalettePage' );

		$parser = $this->newParserMock( $title );
		KnowledgeGraph::parserFunctionKnowledgeGraph( $parser, 'palette=doesnotexist' );

		$jsConfigVars = $parser->getOutput()->getJsConfigVars();

		$this->assertSame(
			[ '#1f77b4', '#ff7f0e', '#2ca02c' ],
			$jsConfigVars['wgKnowledgeGraphColorPalette']
		);
	}

	public function testMissingPaletteParameterFallsBackToDefaultColors() {
		$title = Title::makeTitle( NS_MAIN, 'KGParserFunctionNoPalettePage' );

		$parser = $this->newParserMock( $title );
		KnowledgeGraph::parserFunctionKnowledgeGraph( $parser );

		$jsConfigVars = $parser->getOutput()->getJsConfigVars();

		$this->assertSame(
			[ '#1f77b4', '#ff7f0e', '#2ca02c' ],
			$jsConfigVars['wgKnowledgeGraphColorPalette']
		);
	}

	/**
	 * Reproduces https://github.com/SemanticMediaWiki/KnowledgeGraph/issues/98:
	 * without this, an unset $wgKnowledgeGraphColorPalettes (e.g. a wiki that never
	 * configured it, before extension.json declared a config default) raised a PHP
	 * "Undefined global variable" error instead of falling back to a usable palette.
	 */
	public function testFallsBackToLiteralDefaultPaletteWhenGlobalIsEntirelyUnset() {
		unset( $GLOBALS['wgKnowledgeGraphColorPalettes'] );

		$title = Title::makeTitle( NS_MAIN, 'KGParserFunctionNoColorPalettesConfiguredPage' );
		$parser = $this->newParserMock( $title );
		KnowledgeGraph::parserFunctionKnowledgeGraph( $parser );

		$jsConfigVars = $parser->getOutput()->getJsConfigVars();

		$this->assertSame(
			[
				'#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
				'#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
			],
			$jsConfigVars['wgKnowledgeGraphColorPalette']
		);
	}

	public function testAddsExpectedJsConfigVars() {
		$title = Title::makeTitle( NS_MAIN, 'KGParserFunctionJsConfigVarsPage' );

		$parser = $this->newParserMock( $title );
		KnowledgeGraph::parserFunctionKnowledgeGraph( $parser );

		$jsConfigVars = $parser->getOutput()->getJsConfigVars();

		$this->assertArrayHasKey( 'KnowledgeGraphShowImages', $jsConfigVars );
		$this->assertArrayHasKey( 'KnowledgeGraphDisableCredits', $jsConfigVars );
		$this->assertArrayHasKey( 'wgKnowledgeGraphColorPalette', $jsConfigVars );
		$this->assertTrue( $jsConfigVars['KnowledgeGraphShowImages'] );
		$this->assertFalse( $jsConfigVars['KnowledgeGraphDisableCredits'] );
	}

	public function testReturnsHtmlWrapperWithRunningIndexAcrossMultipleCalls() {
		$titleA = Title::makeTitle( NS_MAIN, 'KGParserFunctionWrapperPageA' );
		$titleB = Title::makeTitle( NS_MAIN, 'KGParserFunctionWrapperPageB' );

		$resultA = $this->callParserFunction( $titleA, [] );
		$resultB = $this->callParserFunction( $titleB, [] );

		$this->assertStringContainsString( 'knowledgegraph-wrapper-0', $resultA[0] );
		$this->assertStringContainsString( 'knowledgegraph-wrapper-1', $resultB[0] );
		$this->assertTrue( $resultA['noparse'] );
		$this->assertTrue( $resultA['isHTML'] );
	}

	public function testDataIsResetAfterProcessingSoSubsequentCallsAreNotContaminated() {
		$this->insertPage( 'KGParserFunctionResetNode' );

		$titleA = Title::makeTitle( NS_MAIN, 'KGParserFunctionResetPageA' );
		$titleB = Title::makeTitle( NS_MAIN, 'KGParserFunctionResetPageB' );

		$this->callParserFunction( $titleA, [ 'nodes=KGParserFunctionResetNode', 'depth=0' ] );

		$this->assertSame( [], KnowledgeGraph::$data );
		$this->assertArrayHasKey(
			'KGParserFunctionResetNode',
			KnowledgeGraph::$graphs[0]['data']
		);

		$this->callParserFunction( $titleB, [] );

		$this->assertArrayNotHasKey( 'KGParserFunctionResetNode', KnowledgeGraph::$graphs[1]['data'] );
	}

	public function testKnownNodeTriggersSetSemanticDataFromApi() {
		$this->insertPage( 'KGParserFunctionKnownNode' );
		$title = Title::makeTitle( NS_MAIN, 'KGParserFunctionKnownNodeCallerPage' );

		$this->callParserFunction( $title, [ 'nodes=KGParserFunctionKnownNode', 'depth=0' ] );

		$this->assertArrayHasKey( 'KGParserFunctionKnownNode', KnowledgeGraph::$graphs[0]['data'] );
	}

	public function testUnknownNodeIsSkipped() {
		$title = Title::makeTitle( NS_MAIN, 'KGParserFunctionUnknownNodeCallerPage' );

		$this->callParserFunction( $title, [ 'nodes=KGParserFunctionNodeDoesNotExistAnywhere', 'depth=0' ] );

		$this->assertSame( [], KnowledgeGraph::$graphs[0]['data'] );
	}
}
