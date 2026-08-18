<?php

use PHPUnit\Framework\TestCase;

/**
 * @covers KnowledgeGraph::parseParameters
 */
class KnowledgeGraphParseParametersTest extends TestCase {

	public function testKnownParameterIsExtractedIntoOptions() {
		[ $ret, $options ] = KnowledgeGraph::parseParameters(
			[ 'foo=bar' ],
			[ 'foo' ]
		);

		$this->assertSame( [], $ret );
		$this->assertSame( [ 'foo' => 'bar' ], $options );
	}

	public function testKeyNormalizesSpacesToHyphens() {
		[ $ret, $options ] = KnowledgeGraph::parseParameters(
			[ 'my key = value' ],
			[ 'my-key' ]
		);

		$this->assertSame( [], $ret );
		$this->assertSame( [ 'my-key' => 'value' ], $options );
	}

	public function testUnknownParameterKeyRemainsInReturnedList() {
		[ $ret, $options ] = KnowledgeGraph::parseParameters(
			[ 'unknown=value' ],
			[ 'known' ]
		);

		$this->assertSame( [ 'unknown=value' ], $ret );
		$this->assertSame( [], $options );
	}

	public function testValueWithoutEqualsSignRemainsInReturnedList() {
		[ $ret, $options ] = KnowledgeGraph::parseParameters(
			[ 'plainvalue' ],
			[ 'plainvalue' ]
		);

		$this->assertSame( [ 'plainvalue' ], $ret );
		$this->assertSame( [], $options );
	}

	public function testMixedParametersAreSplitBetweenRetAndOptions() {
		[ $ret, $options ] = KnowledgeGraph::parseParameters(
			[ 'foo=bar', 'plainvalue', 'other=baz' ],
			[ 'foo' ]
		);

		$this->assertSame( [ 'plainvalue', 'other=baz' ], $ret );
		$this->assertSame( [ 'foo' => 'bar' ], $options );
	}
}
