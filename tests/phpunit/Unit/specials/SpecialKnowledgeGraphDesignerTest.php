<?php

use PHPUnit\Framework\TestCase;

class SpecialKnowledgeGraphDesignerTest extends TestCase {

	/**
	 * @var specialPage SpecialPage mock object for testing.
	 */
	protected $specialPage;

	protected function setUp(): void {
		parent::setUp();
		$this->specialPage = new SpecialKnowledgeGraphDesigner();

		$GLOBALS['wgKnowledgeGraphColorPalettes'] = [
			'default' => [ '#1f77b4', '#ff7f0e', '#2ca02c' ],
			'pastel'  => [ '#aec7e8', '#ffbb78', '#98df8a' ],
		];
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
		$specialPage = new SpecialKnowledgeGraphDesigner();
		$specialPage->execute( '' );

		$output = $specialPage->getOutput();

		$this->assertInstanceOf( OutputPage::class, $output );
		$this->assertSame( $specialPage->getDescription()->text(), $output->getPageTitle() );
	}

	/**
	 * @covers SpecialKnowledgeGraphDesigner::execute
	 */
	public function testExecuteAddsModules() {
		$specialPage = new SpecialKnowledgeGraphDesigner();
		$specialPage->execute( '' );

		$this->assertContains( 'ext.KnowledgeGraph', $specialPage->getOutput()->getModules() );
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

	/**
	 * @covers SpecialKnowledgeGraphDesigner::getGroupName
	 */
	public function testGetGroupName() {
		$specialPage = new SpecialKnowledgeGraphDesigner();

		$reflectionMethod = new ReflectionMethod( $specialPage, 'getGroupName' );
		$reflectionMethod->setAccessible( true );

		$this->assertSame( 'knowledgegraph', $reflectionMethod->invoke( $specialPage ) );
	}
}
