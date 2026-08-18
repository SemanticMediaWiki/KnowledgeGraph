<?php

use PHPUnit\Framework\TestCase;

/**
 * getAllPropertiesForNode() drives an internal smwbrowse API request via
 * FauxRequest/ApiMain against the real SMW store (same pattern as
 * setSemanticDataFromApi(), see KnowledgeGraphSetSemanticDataFromApiTest for
 * the early-return-only TestCase and KnowledgeGraphSetSemanticDataFromApiProcessingTest
 * for the MediaWikiIntegrationTestCase pattern used for the real-store cases
 * below).
 *
 * @covers KnowledgeGraph::getAllPropertiesForNode
 */
class KnowledgeGraphGetAllPropertiesForNodeTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		KnowledgeGraph::initSMW();
	}

	public function testUnknownTitleReturnsEmptyArray() {
		$result = KnowledgeGraph::getAllPropertiesForNode( 'GetAllPropertiesForNodeUnknownTitle' );

		$this->assertSame( [], $result );
	}

	public function testInvalidTitleTextReturnsEmptyArray() {
		// '<' and '>' are illegal in a MediaWiki title, so Title::newFromText()
		// returns null and the method must short-circuit before any SMW/API work.
		$result = KnowledgeGraph::getAllPropertiesForNode( '<invalid>' );

		$this->assertSame( [], $result );
	}
}
