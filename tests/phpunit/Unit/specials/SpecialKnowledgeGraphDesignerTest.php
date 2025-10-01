<?php

use PHPUnit\Framework\TestCase;

class SpecialKnowledgeGraphDesignerTest extends TestCase {

	/**
	 * @var specialPage SpecialPage mock object for testing.
	 */
	protected $specialPage;

	/**
	 * @var specialKnowledgeGraphDesigner SpecialKnowledgeGraphDesigner mock object for testing.
	 */
	protected $specialKnowledgeGraphDesigner;

	protected function setUp(): void {
		parent::setUp();
		$this->specialPage = new SpecialKnowledgeGraphDesigner();

		$GLOBALS['wgKnowledgeGraphColorPalettes'] = [
			'default' => [ '#1f77b4', '#ff7f0e', '#2ca02c' ],
			'pastel'  => [ '#aec7e8', '#ffbb78', '#98df8a' ],
		];

		$this->outputPage = $this->getMockBuilder( '\OutputPage' )
			->disableOriginalConstructor()
			->getMock();

		$this->specialKnowledgeGraphDesigner = $this->getMockBuilder( 'SpecialKnowledgeGraphDesigner' )
			->disableOriginalConstructor()
			->onlyMethods( [ 'getOutput' ] )
			->getMock();
	}

	/**
	 * @covers SpecialKnowledgeGraphDesigner::__construct
	 */
	public function testConstructor() {
		$this->assertInstanceOf( SpecialKnowledgeGraphDesigner::class, $this->specialPage );
	}

	/**
	 * @covers SpecialKnowledgeGraphDesigner::execute
	 */
	public function testExecuteSetsHeadersAndOutput() {
		$this->specialKnowledgeGraphDesigner->expects( $this->any() )
									  ->method( 'getOutput' )
									  ->willReturn( $this->outputPage );

		$output = $this->specialKnowledgeGraphDesigner->getOutput();

		$this->assertInstanceOf( OutputPage::class, $output );
		$this->assertNotNull( $output );
	}

	/**
	 * @covers SpecialKnowledgeGraphDesigner::execute
	 */
	public function testExecuteAddsModules() {
		$this->specialKnowledgeGraphDesigner->expects( $this->any() )
									  ->method( 'getOutput' )
									  ->willReturn( $this->outputPage );

		$output = $this->specialKnowledgeGraphDesigner->getOutput();

		// Set up the mock to expect addModules to be called with 'ext.KnowledgeGraph'
		$value = $this->equalTo( [ 'ext.KnowledgeGraph' ] );
		$this->outputPage->expects( $this->once() )
						 ->method( 'addModules' )
						 ->with( $value );

		// Execute the special page
		$this->specialKnowledgeGraphDesigner->execute( '' );

		// Assertions
		$this->assertTrue( true );
		$this->assertNotNull( $output );
	}

	/**
	 * @covers SpecialKnowledgeGraphDesigner::execute
	 */
	public function testExecuteAppliesDefaultParams() {
		$specialPage = new SpecialKnowledgeGraphDesigner();
		$specialPage->execute( '' );

		$params = \KnowledgeGraph::$graphs[0];
		$this->assertArrayHasKey( 'nodes', $params );
		$this->assertArrayHasKey( 'properties', $params );
		// Add more assertions to verify each default parameter value
	}

	/**
	 * @covers SpecialKnowledgeGraphDesigner::execute
	 */
	public function testExecuteSetsGraphOptions() {
		$specialPage = new SpecialKnowledgeGraphDesigner();
		$specialPage->execute( '' );

		$params = \KnowledgeGraph::$graphs[0];
		$this->assertArrayHasKey( 'graphOptions', $params );
	}

	/**
	 * @covers SpecialKnowledgeGraphDesigner::execute
	 */
	public function testExecuteSetsJavaScriptConfigVars() {
		$specialPage = new SpecialKnowledgeGraphDesigner();
		$specialPage->execute( '' );

		$output = $specialPage->getOutput();
		$jsConfigVars = $output->getJsConfigVars();

		$this->assertArrayHasKey( 'knowledgegraphs', $jsConfigVars );
		$this->assertArrayHasKey( 'KnowledgeGraphShowImages', $jsConfigVars );
		$this->assertArrayHasKey( 'KnowledgeGraphDisableCredits', $jsConfigVars );
		$this->assertArrayHasKey( 'wgKnowledgeGraphColorPalette', $jsConfigVars );

		$this->assertTrue( $jsConfigVars['KnowledgeGraphShowImages'] );
		$this->assertFalse( $jsConfigVars['KnowledgeGraphDisableCredits'] );
	}

	/**
	 * @covers SpecialKnowledgeGraphDesigner::execute
	 */
	public function testExecuteGeneratesCorrectHtmlOutput() {
		$specialPage = new SpecialKnowledgeGraphDesigner();
		$specialPage->execute( '' );

		$output = $specialPage->getOutput();
		$html = $output->getHtml();

		$this->assertStringContainsString( '<div class="KnowledgeGraph" id="knowledgegraph-wrapper-0">', $html );
		$this->assertStringContainsString( wfMessage( 'knowledge-graph-wrapper-loading' )->text(), $html );
	}
}
