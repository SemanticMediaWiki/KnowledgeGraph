<?php

use PHPUnit\Framework\TestCase;

/**
 * makeRelationKey() is private; accessed via reflection, matching the
 * pattern in KnowledgeGraphSetSemanticDataFromApiProcessingTest.php.
 *
 * @covers KnowledgeGraph::makeRelationKey
 */
class KnowledgeGraphMakeRelationKeyTest extends TestCase {

	private function invokeMakeRelationKey( string $a, string $b, string $prop ): string {
		$reflection = new ReflectionClass( KnowledgeGraph::class );
		$method = $reflection->getMethod( 'makeRelationKey' );
		$method->setAccessible( true );

		return $method->invoke( null, $a, $b, $prop );
	}

	public function testKeyIsOrderIndependentBetweenAAndB() {
		$keyAB = $this->invokeMakeRelationKey( 'A', 'B', 'prop' );
		$keyBA = $this->invokeMakeRelationKey( 'B', 'A', 'prop' );

		$this->assertSame( $keyAB, $keyBA );
	}

	public function testKeyContainsSortedTitlesAndProperty() {
		$key = $this->invokeMakeRelationKey( 'Zebra', 'Alpha', 'related' );

		$this->assertSame( 'Alpha::related::Zebra', $key );
	}
}
