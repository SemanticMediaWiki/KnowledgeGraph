<?php

use PHPUnit\Framework\TestCase;

class KnowledgeGraphApiLoadCategoriesTest extends TestCase {

	/**
	 * @covers KnowledgeGraphApiLoadCategories::getExamplesMessages
	 */
	public function testGetExamples() {
		$instance = new KnowledgeGraphApiLoadCategories( new ApiMain(), '' );
		$messages = $instance->getExamplesMessages();
		$this->assertCount( 1, $messages );
	}
}
