<?php

use PHPUnit\Framework\TestCase;

/**
 * @covers KnowledgeGraph::applyDefaultParams
 */
class KnowledgeGraphApplyDefaultParamsTest extends TestCase {

	protected function tearDown(): void {
		unset( $GLOBALS['wgKnowledgeGraphListSeparator'] );
		parent::tearDown();
	}

	public function testBooleanValidValueIsConvertedToBool() {
		$result = KnowledgeGraph::applyDefaultParams(
			[ 'flag' => [ false, 'bool' ] ],
			[ 'flag' => 'true' ]
		);

		$this->assertSame( [ 'flag' => true ], $result );
	}

	public function testBooleanInvalidValueFallsBackToDefault() {
		$result = KnowledgeGraph::applyDefaultParams(
			[ 'flag' => [ true, 'boolean' ] ],
			[ 'flag' => 'not-a-bool' ]
		);

		$this->assertSame( [ 'flag' => true ], $result );
	}

	public function testArraySplitsCommaSeparatedStringAndRemovesEmptyEntries() {
		$result = KnowledgeGraph::applyDefaultParams(
			[ 'list' => [ [], 'array' ] ],
			[ 'list' => 'a, b ,,c' ]
		);

		$this->assertSame( [ 'a', 'b', 'c' ], array_values( $result['list'] ) );
	}

	/**
	 * @see https://github.com/SemanticMediaWiki/KnowledgeGraph/issues/33
	 * @see https://github.com/SemanticMediaWiki/KnowledgeGraph/issues/48
	 */
	public function testArrayUsesConfiguredSeparatorInsteadOfHardCodedComma() {
		$GLOBALS['wgKnowledgeGraphListSeparator'] = ';';

		$result = KnowledgeGraph::applyDefaultParams(
			[ 'nodes' => [ [], 'array' ] ],
			[ 'nodes' => 'Foo, Bar; Baz Inc., 1996 CanLII 153 (SCC)' ]
		);

		$this->assertSame(
			[ 'Foo, Bar', 'Baz Inc., 1996 CanLII 153 (SCC)' ],
			array_values( $result['nodes'] )
		);
	}

	public function testArrayFallsBackToCommaWhenSeparatorNotConfigured() {
		unset( $GLOBALS['wgKnowledgeGraphListSeparator'] );

		$result = KnowledgeGraph::applyDefaultParams(
			[ 'nodes' => [ [], 'array' ] ],
			[ 'nodes' => 'Foo, Bar ,Baz' ]
		);

		$this->assertSame( [ 'Foo', 'Bar', 'Baz' ], array_values( $result['nodes'] ) );
	}

	public function testNumberValidValueIsConvertedToFloat() {
		$result = KnowledgeGraph::applyDefaultParams(
			[ 'ratio' => [ 0.0, 'number' ] ],
			[ 'ratio' => '3.5' ]
		);

		$this->assertSame( [ 'ratio' => 3.5 ], $result );
	}

	public function testNumberInvalidValueFallsBackToDefault() {
		$result = KnowledgeGraph::applyDefaultParams(
			[ 'ratio' => [ 9.9, 'number' ] ],
			[ 'ratio' => 'not-a-number' ]
		);

		$this->assertSame( [ 'ratio' => 9.9 ], $result );
	}

	public function testIntegerValidValueIsConvertedToInt() {
		$result = KnowledgeGraph::applyDefaultParams(
			[ 'count' => [ 0, 'integer' ] ],
			[ 'count' => '42' ]
		);

		$this->assertSame( [ 'count' => 42 ], $result );
	}

	public function testIntegerInvalidValueFallsBackToDefault() {
		$result = KnowledgeGraph::applyDefaultParams(
			[ 'count' => [ 7, 'int' ] ],
			[ 'count' => 'not-a-number' ]
		);

		$this->assertSame( [ 'count' => 7 ], $result );
	}

	public function testUnknownTypeValueIsPassedThroughUnchanged() {
		$result = KnowledgeGraph::applyDefaultParams(
			[ 'raw' => [ 'default-raw', 'string' ] ],
			[ 'raw' => 'some-value' ]
		);

		$this->assertSame( [ 'raw' => 'some-value' ], $result );
	}

	public function testMissingKeyInParamsUsesDefaultValue() {
		$result = KnowledgeGraph::applyDefaultParams(
			[ 'raw' => [ 'default-raw', 'string' ] ],
			[]
		);

		$this->assertSame( [ 'raw' => 'default-raw' ], $result );
	}

	public function testMissingKeyInParamsStillAppliesTypeCoercion() {
		$result = KnowledgeGraph::applyDefaultParams(
			[ 'count' => [ '5', 'integer' ] ],
			[]
		);

		$this->assertSame( [ 'count' => 5 ], $result );
	}
}
