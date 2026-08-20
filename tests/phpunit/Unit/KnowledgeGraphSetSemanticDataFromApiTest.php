<?php

use MediaWiki\Title\Title;
use PHPUnit\Framework\TestCase;

/**
 * setSemanticDataFromApi() accumulates into and returns the $data map passed
 * by reference, rather than mutating a shared static property; callers
 * thread their own local $data (and $relationsSeen) through the call.
 *
 * @covers KnowledgeGraph::setSemanticDataFromApi
 */
class KnowledgeGraphSetSemanticDataFromApiTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		KnowledgeGraph::initSMW();
	}

	public function testReturnsDataWithRootNodeWhenMaxDepthIsZero() {
		$title = Title::makeTitle( NS_MAIN, 'SetSemanticDataFromApiTestPage' );
		$data = [];
		$relationsSeen = [];

		$result = KnowledgeGraph::setSemanticDataFromApi( $title, [], 0, 0, $data, $relationsSeen );

		$this->assertSame(
			[ 'properties' => [], 'categories' => [], 'displayTitle' => null ],
			$result[ $title->getFullText() ]
		);
		$this->assertSame( $data, $result );
	}

	public function testLeavesDataUnsetWhenDepthReachesMaxDepth() {
		$title = Title::makeTitle( NS_MAIN, 'SetSemanticDataFromApiTestPage2' );
		$data = [];
		$relationsSeen = [];

		$result = KnowledgeGraph::setSemanticDataFromApi( $title, [], 1, 1, $data, $relationsSeen );

		$this->assertArrayNotHasKey( $title->getFullText(), $result );
	}

	public function testLeavesExistingEntryUnchangedWhenTitleAlreadyPresentInData() {
		$title = Title::makeTitle( NS_MAIN, 'SetSemanticDataFromApiTestPage3' );
		$data = [
			$title->getFullText() => [ 'properties' => [], 'categories' => [ 'Preexisting' ] ],
		];
		$relationsSeen = [];

		$result = KnowledgeGraph::setSemanticDataFromApi( $title, [], 0, 5, $data, $relationsSeen );

		$this->assertSame(
			[ 'properties' => [], 'categories' => [ 'Preexisting' ] ],
			$result[ $title->getFullText() ]
		);
	}
}
