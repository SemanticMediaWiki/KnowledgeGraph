<?php

use PHPUnit\Framework\TestCase;

class KnowledgeGraphApiLoadPropertiesTest extends TestCase {

	/**
	 * @covers KnowledgeGraphApiLoadProperties::getExamplesMessages
	 */
	public function testGetExamples() {
		$instance = new KnowledgeGraphApiLoadProperties( new ApiMain(), null );
		$messages = $instance->getExamplesMessages();
		$this->assertCount( 1, $messages );
	}
}
