<?php

use PHPUnit\Framework\TestCase;

/**
 * setNestedValue() is private; accessed via reflection, matching the
 * pattern in KnowledgeGraphMakeRelationKeyTest.php.
 *
 * @see https://github.com/SemanticMediaWiki/KnowledgeGraph/issues/99
 * @covers KnowledgeGraph::setNestedValue
 */
class KnowledgeGraphSetNestedValueTest extends TestCase {

	private function invokeSetNestedValue( array $array, string $path, $value ): array {
		$reflection = new ReflectionClass( KnowledgeGraph::class );
		$method = $reflection->getMethod( 'setNestedValue' );
		$method->setAccessible( true );

		return $method->invoke( null, $array, $path, $value );
	}

	public function testSingleSegmentPathSetsTopLevelKey() {
		$result = $this->invokeSetNestedValue( [], 'color', '#ccc' );

		$this->assertSame( [ 'color' => '#ccc' ], $result );
	}

	public function testDottedPathCreatesNestedArray() {
		$result = $this->invokeSetNestedValue( [], 'color.background', '#ccc' );

		$this->assertSame( [ 'color' => [ 'background' => '#ccc' ] ], $result );
	}

	public function testDeeplyNestedPathCreatesAllIntermediateLevels() {
		$result = $this->invokeSetNestedValue( [], 'a.b.c', 'leaf' );

		$this->assertSame( [ 'a' => [ 'b' => [ 'c' => 'leaf' ] ] ], $result );
	}

	public function testSecondCallAccumulatesIntoExistingSiblingKeys() {
		$result = $this->invokeSetNestedValue( [], 'color.background', '#ccc' );
		$result = $this->invokeSetNestedValue( $result, 'color.border', '#0000FF' );

		$this->assertSame(
			[ 'color' => [ 'background' => '#ccc', 'border' => '#0000FF' ] ],
			$result
		);
	}

	public function testOverwritingTheSameLeafPathReplacesTheValue() {
		$result = $this->invokeSetNestedValue( [], 'color.background', '#ccc' );
		$result = $this->invokeSetNestedValue( $result, 'color.background', '#fff' );

		$this->assertSame( [ 'color' => [ 'background' => '#fff' ] ], $result );
	}

	public function testUnrelatedTopLevelKeysArePreserved() {
		$result = $this->invokeSetNestedValue( [ 'shape' => 'box' ], 'color.background', '#ccc' );

		$this->assertSame(
			[ 'shape' => 'box', 'color' => [ 'background' => '#ccc' ] ],
			$result
		);
	}
}
