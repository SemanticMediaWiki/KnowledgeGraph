<?php

use PHPUnit\Framework\TestCase;

class KnowledgeGraphTest extends TestCase {

	protected function setUp(): void {
		// Call parent setup
		parent::setUp();

		// Initialize Semantic MediaWiki (SMW) for testing
		KnowledgeGraph::initSMW();
	}

	/**
	 * @covers KnowledgeGraph::exclude
	 */
	public function testExcludeArray() {
		$this->assertContains( '_SOBJ', KnowledgeGraph::$exclude, 'Exclude array should contain _SOBJ' );
		$this->assertNotContains( '_INVALID', KnowledgeGraph::$exclude, 'Exclude array should not contain _INVALID' );
	}

	/**
	 * @covers KnowledgeGraph::onBeforePageDisplay
	 */
	public function testOnBeforePageDisplay() {
		$outMock = $this->createMock( OutputPage::class );
		$skinMock = $this->createMock( Skin::class );

		$result = KnowledgeGraph::onBeforePageDisplay( $outMock, $skinMock );

		$this->assertTrue( $result );
	}

	/**
	 * @covers KnowledgeGraph::onParserFirstCallInit
	 */
	public function testOnParserFirstCallInit() {
		$parserMock = $this->createMock( Parser::class );

		$parserMock->expects( $this->once() )
				   ->method( 'setFunctionHook' )
				   ->with( 'knowledgegraph', [ KnowledgeGraph::class, 'parserFunctionKnowledgeGraph' ] );

		KnowledgeGraph::onParserFirstCallInit( $parserMock );
	}

	/**
	 * @covers KnowledgeGraph::onOutputPageParserOutput
	 */
	public function testOnOutputPageParserOutputDoesNothingWithoutExtensionData() {
		$outMock = $this->createMock( OutputPage::class );
		$parserOutputMock = $this->createMock( ParserOutput::class );

		$parserOutputMock->method( 'getExtensionData' )
						 ->with( 'knowledgegraphs' )
						 ->willReturn( null );

		$outMock->expects( $this->never() )
				->method( 'addJsConfigVars' );

		$outMock->expects( $this->never() )
				->method( 'addModules' );

		KnowledgeGraph::onOutputPageParserOutput( $outMock, $parserOutputMock );
	}

	/**
	 * @covers KnowledgeGraph::onOutputPageParserOutput
	 */
	public function testOnOutputPageParserOutputAddsJsConfigVarsAndModuleWithExtensionData() {
		$outMock = $this->createMock( OutputPage::class );
		$parserOutputMock = $this->createMock( ParserOutput::class );

		$data = [ 'nodes' => [], 'edges' => [] ];

		$parserOutputMock->method( 'getExtensionData' )
						 ->with( 'knowledgegraphs' )
						 ->willReturn( $data );

		$outMock->expects( $this->once() )
				->method( 'addJsConfigVars' )
				->with( [ 'knowledgegraphs' => json_encode( $data ) ] );

		$outMock->expects( $this->once() )
				->method( 'addModules' )
				->with( 'ext.KnowledgeGraph' );

		KnowledgeGraph::onOutputPageParserOutput( $outMock, $parserOutputMock );
	}
}
