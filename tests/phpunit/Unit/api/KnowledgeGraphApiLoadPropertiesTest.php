<?php

use PHPUnit\Framework\TestCase;

class KnowledgeGraphApiLoadPropertiesTest extends TestCase {

	/**
	 * @covers KnowledgeGraphApiLoadProperties::getExamplesMessages
	 */
	public function testGetExamples() {
		$instance = new KnowledgeGraphApiLoadProperties( new ApiMain(), '' );
		$messages = $instance->getExamplesMessages();
		$this->assertCount( 1, $messages );
	}

	private function callExpandInverseProperties( array $properties, bool $inversePropsIncluded ): array {
		$reflection = new ReflectionMethod( KnowledgeGraphApiLoadProperties::class, 'expandInverseProperties' );
		$reflection->setAccessible( true );
		return $reflection->invoke( null, $properties, $inversePropsIncluded );
	}

	/**
	 * @covers KnowledgeGraphApiLoadProperties::expandInverseProperties
	 */
	public function testExpandInversePropertiesAddsInverseEntryPerProperty() {
		$result = $this->callExpandInverseProperties( [ 'Foo', 'Bar' ], true );

		$this->assertSame( [ 'Foo', 'Bar', '-Foo', '-Bar' ], $result );
	}

	/**
	 * @covers KnowledgeGraphApiLoadProperties::expandInverseProperties
	 */
	public function testExpandInversePropertiesLeavesListUnchangedWhenNotIncluded() {
		$result = $this->callExpandInverseProperties( [ 'Foo', 'Bar' ], false );

		$this->assertSame( [ 'Foo', 'Bar' ], $result );
	}
}
