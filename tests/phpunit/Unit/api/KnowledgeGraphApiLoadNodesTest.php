<?php

use PHPUnit\Framework\TestCase;

class KnowledgeGraphApiLoadNodesTest extends TestCase {

	/**
	 * @covers KnowledgeGraphApiLoadNodes::getExamplesMessages
	 */
	public function testGetExamples() {
		$instance = new KnowledgeGraphApiLoadNodes( new ApiMain(), '' );
		$messages = $instance->getExamplesMessages();
		$this->assertCount( 1, $messages );
	}
}
