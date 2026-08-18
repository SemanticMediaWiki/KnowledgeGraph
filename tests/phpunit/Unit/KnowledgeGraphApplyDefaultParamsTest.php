<?php

use PHPUnit\Framework\TestCase;

/**
 * @covers KnowledgeGraph::applyDefaultParams
 */
class KnowledgeGraphApplyDefaultParamsTest extends TestCase {

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

	public function testNumberValidValueIsConvertedToFloat() {
		$result = KnowledgeGraph::applyDefaultParams(
			[ 'ratio' => [ 0.0, 'number' ] ],
			[ 'ratio' => '3.5' ]
		);

		$this->assertSame( [ 'ratio' => 3.5 ], $result );
	}

	/**
	 * filter_var( ..., FILTER_VALIDATE_FLOAT, FILTER_NULL_ON_FAILURE ) returns
	 * null for an invalid value, and settype( null, 'float' ) yields 0.0 —
	 * NOT the configured default value. This locks in that (surprising)
	 * current behavior rather than the documented "falls back to default"
	 * intent; see the reported findings for details.
	 */
	public function testNumberInvalidValueBecomesZeroNotDefault() {
		$result = KnowledgeGraph::applyDefaultParams(
			[ 'ratio' => [ 9.9, 'number' ] ],
			[ 'ratio' => 'not-a-number' ]
		);

		$this->assertSame( [ 'ratio' => 0.0 ], $result );
	}

	public function testIntegerValidValueIsConvertedToInt() {
		$result = KnowledgeGraph::applyDefaultParams(
			[ 'count' => [ 0, 'integer' ] ],
			[ 'count' => '42' ]
		);

		$this->assertSame( [ 'count' => 42 ], $result );
	}

	/**
	 * Same fallback-to-zero behavior as the 'number' type: an invalid int
	 * silently becomes 0 rather than falling back to the configured default.
	 */
	public function testIntegerInvalidValueBecomesZeroNotDefault() {
		$result = KnowledgeGraph::applyDefaultParams(
			[ 'count' => [ 7, 'int' ] ],
			[ 'count' => 'not-a-number' ]
		);

		$this->assertSame( [ 'count' => 0 ], $result );
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
