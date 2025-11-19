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
}
