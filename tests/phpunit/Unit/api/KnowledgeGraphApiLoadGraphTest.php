<?php

use PHPUnit\Framework\TestCase;

class KnowledgeGraphApiLoadGraphTest extends TestCase {

	/**
	 * @covers KnowledgeGraphApiLoadGraph::getExamplesMessages
	 */
	public function testGetExamples() {
		$instance = new KnowledgeGraphApiLoadGraph( new ApiMain(), '' );
		$messages = $instance->getExamplesMessages();
		$this->assertCount( 1, $messages );
	}

	/**
	 * Regression guard: this endpoint must remain a read-only, anonymous-safe
	 * GET (see #102 -- the initial graph load must work for logged-out page
	 * views without a CSRF token round-trip). Unlike the other
	 * knowledgegraph-load-* endpoints, mustBePosted()/needsToken() are
	 * deliberately overridden here rather than inherited from
	 * KnowledgeGraphApiLoadTrait's protected defaults.
	 *
	 * @covers KnowledgeGraphApiLoadGraph::mustBePosted
	 * @covers KnowledgeGraphApiLoadGraph::needsToken
	 */
	public function testIsReadOnlyAndAnonymousSafe() {
		$instance = new KnowledgeGraphApiLoadGraph( new ApiMain(), '' );
		$this->assertFalse( $instance->mustBePosted() );
		$this->assertFalse( $instance->needsToken() );
		$this->assertFalse( $instance->isWriteMode() );
	}
}
