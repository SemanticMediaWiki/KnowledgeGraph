<?php

use PHPUnit\Framework\TestCase;

/**
 * @covers KnowledgeGraph::resetSeenRelations
 */
class KnowledgeGraphResetSeenRelationsTest extends TestCase {

	public function testResetsRelationsSeenToEmptyArray() {
		$reflection = new ReflectionClass( KnowledgeGraph::class );
		$property = $reflection->getProperty( 'relationsSeen' );
		$property->setAccessible( true );
		$property->setValue( null, [ 'A::rel::B' => true ] );

		KnowledgeGraph::resetSeenRelations();

		$this->assertSame( [], $property->getValue( null ) );
	}
}
