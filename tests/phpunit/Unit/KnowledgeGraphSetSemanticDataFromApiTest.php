<?php

use MediaWiki\Title\Title;
use PHPUnit\Framework\TestCase;

/**
 * setSemanticDataFromApi() populates the public static self::$data
 * property as a side effect; every caller (KnowledgeGraph::parserFunctionKnowledgeGraph,
 * KnowledgeGraphApiLoadProperties, KnowledgeGraphApiLoadCategories,
 * KnowledgeGraphApiLoadNodes) reads the result from that property rather
 * than from a return value. This test locks in that contract: the method
 * returns void/null and self::$data is populated regardless.
 *
 * @covers KnowledgeGraph::setSemanticDataFromApi
 */
class KnowledgeGraphSetSemanticDataFromApiTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		KnowledgeGraph::initSMW();

		$reflection = new ReflectionClass( KnowledgeGraph::class );
		$property = $reflection->getProperty( 'data' );
		$property->setAccessible( true );
		$property->setValue( null, [] );
	}

	public function testReturnsNullAndPopulatesDataWhenMaxDepthIsZero() {
		$title = Title::makeTitle( NS_MAIN, 'SetSemanticDataFromApiTestPage' );

		$result = KnowledgeGraph::setSemanticDataFromApi( $title, [], 0, 0 );

		$this->assertNull( $result );
		$this->assertSame(
			[ 'properties' => [], 'categories' => [] ],
			KnowledgeGraph::$data[ $title->getFullText() ]
		);
	}

	public function testReturnsNullAndLeavesDataUnsetWhenDepthReachesMaxDepth() {
		$title = Title::makeTitle( NS_MAIN, 'SetSemanticDataFromApiTestPage2' );

		$result = KnowledgeGraph::setSemanticDataFromApi( $title, [], 1, 1 );

		$this->assertNull( $result );
		$this->assertArrayNotHasKey( $title->getFullText(), KnowledgeGraph::$data );
	}

	public function testReturnsNullWhenTitleAlreadyPresentInData() {
		$title = Title::makeTitle( NS_MAIN, 'SetSemanticDataFromApiTestPage3' );

		KnowledgeGraph::$data[ $title->getFullText() ] = [ 'properties' => [], 'categories' => [ 'Preexisting' ] ];

		$result = KnowledgeGraph::setSemanticDataFromApi( $title, [], 0, 5 );

		$this->assertNull( $result );
		$this->assertSame(
			[ 'properties' => [], 'categories' => [ 'Preexisting' ] ],
			KnowledgeGraph::$data[ $title->getFullText() ]
		);
	}
}
