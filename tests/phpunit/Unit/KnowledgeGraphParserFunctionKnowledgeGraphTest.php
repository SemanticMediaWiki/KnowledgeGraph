<?php

use MediaWiki\Title\Title;

/**
 * parserFunctionKnowledgeGraph() only calls getOutput(), getTitle() and
 * getUserIdentity() on the Parser it receives, so a Parser mock stubbing just
 * those methods is sufficient - no need for a real Parser/parse() round trip.
 * getOutput() is stubbed to return a real ParserOutput (a concrete class), so
 * setExtensionData()/addJsConfigVars() calls can be asserted against real
 * state instead of mock expectations. getUserIdentity() defaults to the test
 * runner's User (which has full rights), so the read-permission early-return
 * doesn't trigger unless a test explicitly overrides it.
 *
 * @covers KnowledgeGraph::parserFunctionKnowledgeGraph
 * @group Database
 */
class KnowledgeGraphParserFunctionKnowledgeGraphTest extends MediaWikiIntegrationTestCase {

	/** @var ParserOutput|null set by newParserMock() to the ParserOutput of the most recently created Parser mock */
	private static $lastParserOutput;

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

		$graphsProp = $reflection->getProperty( 'graphs' );
		$graphsProp->setAccessible( true );
		$graphsProp->setValue( null, [] );
	}

	private function newParserMock( Title $title, ?\MediaWiki\User\UserIdentity $user = null ): Parser {
		$parserOutput = new ParserOutput();
		self::$lastParserOutput = $parserOutput;

		$parser = $this->createMock( Parser::class );
		$parser->method( 'getOutput' )->willReturn( $parserOutput );
		$parser->method( 'getTitle' )->willReturn( $title );
		$parser->method( 'getUserIdentity' )->willReturn( $user ?? $this->getTestUser()->getUser() );

		return $parser;
	}

	/**
	 * @return array|string parserFunctionKnowledgeGraph()'s normal return is an
	 *  array wrapper, but the read-permission early-return yields a plain string.
	 */
	private function callParserFunction(
		Title $title,
		array $argv,
		?\MediaWiki\User\UserIdentity $user = null
	) {
		$parser = $this->newParserMock( $title, $user );
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

	/**
	 * @see https://github.com/SemanticMediaWiki/KnowledgeGraph/issues/99
	 */
	public function testInlinePropertyOptionAttributeSetsNestedValueWithoutAnOptionsPage() {
		$title = Title::makeTitle( NS_MAIN, 'KGParserFunctionInlineAttrPage' );

		$this->callParserFunction( $title, [
			'property-options?HasProperty1#color.background=#ccc',
		] );

		$propertyOptions = KnowledgeGraph::$graphs[0]['propertyOptions'];

		$this->assertSame( [ 'color' => [ 'background' => '#ccc' ] ], $propertyOptions['HasProperty1'] );
	}

	public function testMultipleInlinePropertyOptionAttributesAccumulateOnTheSameProperty() {
		$title = Title::makeTitle( NS_MAIN, 'KGParserFunctionInlineAttrAccumulatePage' );

		$this->callParserFunction( $title, [
			'property-options?HasProperty1#color.background=#ccc',
			'property-options?HasProperty1#color.border=#0000FF',
		] );

		$propertyOptions = KnowledgeGraph::$graphs[0]['propertyOptions'];

		$this->assertSame(
			[ 'color' => [ 'background' => '#ccc', 'border' => '#0000FF' ] ],
			$propertyOptions['HasProperty1']
		);
	}

	/**
	 * A page-based property-options reference resolves to a client-side JS module
	 * string (see getWikipageContent()); inline attributes resolve to a plain
	 * options array instead. The two cannot be merged server-side without
	 * executing the module, so when both are present for the same property the
	 * inline attributes win and replace the page-based reference entirely.
	 */
	public function testInlineAttributeTakesPrecedenceOverPageBasedOptionsForTheSameProperty() {
		$title = Title::makeTitle( NS_MAIN, 'KGParserFunctionInlineAttrPrecedencePage' );
		$optionsTitle = Title::makeTitleSafe( NS_MEDIAWIKI, 'KGParserFunctionInlineAttrPrecedenceOptions' );
		$this->insertPage( $optionsTitle, 'module content' );

		$this->callParserFunction( $title, [
			'property-options?HasProperty1=Mediawiki:KGParserFunctionInlineAttrPrecedenceOptions',
			'property-options?HasProperty1#color.background=#ccc',
		] );

		$propertyOptions = KnowledgeGraph::$graphs[0]['propertyOptions'];

		$this->assertSame( [ 'color' => [ 'background' => '#ccc' ] ], $propertyOptions['HasProperty1'] );
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

	/**
	 * Reproduces https://github.com/SemanticMediaWiki/KnowledgeGraph/issues/102:
	 * even after Phase 1 was slimmed down to only resolve title existence (no
	 * more SMW/API calls during the parse), a page carrying a graph could still
	 * be written to the ParserCache with an empty ParserOutput, if a save's
	 * redirect-follow GET raced ahead and its own, independently-parsed output
	 * won the write. Making the page fully uncacheable sidesteps that race
	 * entirely: MediaWiki never persists it, so a stale/empty version can never
	 * be served from cache in the first place. See KnowledgeGraph.php's
	 * updateCacheExpiry(0) call for the full rationale.
	 */
	public function testGraphPageIsMarkedUncacheable() {
		$title = Title::makeTitle( NS_MAIN, 'KGParserFunctionUncacheablePage' );

		$this->callParserFunction( $title, [] );

		$this->assertSame( 0, self::$lastParserOutput->getCacheExpiry() );
	}

	public function testReturnsHtmlWrapperWithRunningIndexAcrossMultipleCalls() {
		$title = Title::makeTitle( NS_MAIN, 'KGParserFunctionWrapperPage' );
		$parser = $this->newParserMock( $title );

		$resultA = KnowledgeGraph::parserFunctionKnowledgeGraph( $parser );
		$resultB = KnowledgeGraph::parserFunctionKnowledgeGraph( $parser );

		$this->assertStringContainsString( 'knowledgegraph-wrapper-0', $resultA[0] );
		$this->assertStringContainsString( 'knowledgegraph-wrapper-1', $resultB[0] );
		$this->assertTrue( $resultA['noparse'] );
		$this->assertTrue( $resultA['isHTML'] );
	}

	public function testNodesAreNotCarriedOverToSubsequentCalls() {
		$this->insertPage( 'KGParserFunctionResetNode' );

		$titleA = Title::makeTitle( NS_MAIN, 'KGParserFunctionResetPageA' );
		$titleB = Title::makeTitle( NS_MAIN, 'KGParserFunctionResetPageB' );

		$this->callParserFunction( $titleA, [ 'nodes=KGParserFunctionResetNode', 'depth=0' ] );

		$this->assertSame( [ 'KGParserFunctionResetNode' ], KnowledgeGraph::$graphs[0]['nodes'] );

		$this->callParserFunction( $titleB, [] );

		$this->assertSame( [], KnowledgeGraph::$graphs[0]['nodes'] );
	}

	/**
	 * Reproduces https://github.com/SemanticMediaWiki/KnowledgeGraph/issues/102:
	 * self::$graphs previously was a static class property that accumulated
	 * across every parse handled by the same PHP worker process, instead of
	 * being scoped to the specific ParserOutput being built. A page with no
	 * {{#knowledgegraph:}} calls of its own could inherit another page's
	 * graphs, and a page's own graphs could be numbered starting above 0,
	 * desyncing the "knowledge-graph-wrapper-N" divs from the "knowledgegraphs"
	 * JS config array built from getExtensionData() in onOutputPageParserOutput().
	 */
	public function testGraphIndexAndDataDoNotLeakBetweenParserOutputs() {
		$this->insertPage( 'KGParserFunctionLeakNodeA' );
		$this->insertPage( 'KGParserFunctionLeakNodeB' );

		$titleA = Title::makeTitle( NS_MAIN, 'KGParserFunctionLeakPageA' );
		$titleB = Title::makeTitle( NS_MAIN, 'KGParserFunctionLeakPageB' );

		$resultA = $this->callParserFunction( $titleA, [ 'nodes=KGParserFunctionLeakNodeA' ] );
		$parserOutputA = self::$lastParserOutput;

		$resultB = $this->callParserFunction( $titleB, [ 'nodes=KGParserFunctionLeakNodeB' ] );
		$parserOutputB = self::$lastParserOutput;

		$this->assertStringContainsString( 'knowledgegraph-wrapper-0', $resultA[0] );
		$this->assertStringContainsString( 'knowledgegraph-wrapper-0', $resultB[0] );

		$graphsA = $parserOutputA->getExtensionData( 'knowledgegraphs' );
		$graphsB = $parserOutputB->getExtensionData( 'knowledgegraphs' );

		$this->assertCount( 1, $graphsA );
		$this->assertCount( 1, $graphsB );
		$this->assertSame( [ 'KGParserFunctionLeakNodeA' ], $graphsA[0]['nodes'] );
		$this->assertSame( [ 'KGParserFunctionLeakNodeB' ], $graphsB[0]['nodes'] );
	}

	/**
	 * Reproduces https://github.com/SemanticMediaWiki/KnowledgeGraph/issues/102:
	 * the parser function used to resolve each root node's semantic data
	 * synchronously via setSemanticDataFromApi() during the parse itself, which
	 * tied the rendered graph's correctness to the parse's timing (e.g. a save's
	 * redirect race could freeze an empty result into the ParserOutput). It now
	 * only resolves title existence at parse time; the client fetches the actual
	 * data asynchronously afterwards (see ext.KnowledgeGraph's loadInitialGraph()).
	 */
	public function testKnownNodeIsResolvedIntoNodesWithoutCallingSetSemanticDataFromApi() {
		$this->insertPage( 'KGParserFunctionKnownNode' );
		$title = Title::makeTitle( NS_MAIN, 'KGParserFunctionKnownNodeCallerPage' );

		$this->callParserFunction( $title, [ 'nodes=KGParserFunctionKnownNode', 'depth=0' ] );

		$this->assertSame( [ 'KGParserFunctionKnownNode' ], KnowledgeGraph::$graphs[0]['nodes'] );
		$this->assertSame( [], KnowledgeGraph::$graphs[0]['data'] );
	}

	public function testUnknownNodeIsSkipped() {
		$title = Title::makeTitle( NS_MAIN, 'KGParserFunctionUnknownNodeCallerPage' );

		$this->callParserFunction( $title, [ 'nodes=KGParserFunctionNodeDoesNotExistAnywhere', 'depth=0' ] );

		$this->assertSame( [], KnowledgeGraph::$graphs[0]['nodes'] );
	}

	/**
	 * Locks in that the parser function never resolves semantic data itself
	 * (see #102), regardless of the params given -- guards against regressing
	 * back to synchronous setSemanticDataFromApi() resolution during the parse.
	 */
	public function testDataIsAlwaysEmptyRegardlessOfParams() {
		$this->insertPage( 'KGParserFunctionAlwaysEmptyDataNode' );
		$title = Title::makeTitle( NS_MAIN, 'KGParserFunctionAlwaysEmptyDataCallerPage' );

		$this->callParserFunction( $title, [
			'nodes=KGParserFunctionAlwaysEmptyDataNode',
			'properties=HasProperty1',
			'depth=3',
		] );

		$this->assertSame( [], KnowledgeGraph::$graphs[0]['data'] );
	}

	/**
	 * Reproduces https://github.com/SemanticMediaWiki/KnowledgeGraph/issues/79:
	 * on a closed wiki ($wgGroupPermissions['*']['read'] = false), the ambient
	 * user under a maintenance script like rebuildData.php is anonymous and has
	 * no read right. Without an early return, the internal smwbrowse ApiMain
	 * call in setSemanticDataFromApi() throws an uncaught ApiUsageException,
	 * aborting the whole page parse/rebuild. Since this parser function only
	 * reads and renders SMW data, skipping it entirely for a user who can't
	 * read the page is safe and avoids the crash.
	 */
	public function testSkipsEntirelyWhenActingUserCannotReadThePage() {
		$this->setGroupPermissions( '*', 'read', false );

		$this->insertPage( 'KGParserFunctionNoReadNode' );
		$title = Title::makeTitle( NS_MAIN, 'KGParserFunctionNoReadCallerPage' );
		$anonUser = User::newFromName( '127.0.0.1', false );

		$result = $this->callParserFunction(
			$title,
			[ 'nodes=KGParserFunctionNoReadNode', 'depth=0' ],
			$anonUser
		);

		$this->assertSame( '', $result );
		$this->assertSame( [], KnowledgeGraph::$graphs );
	}
}
