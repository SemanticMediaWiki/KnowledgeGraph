<?php

/**
 * onSidebarBeforeOutput() calls SpecialPage::getTitleFor(), which resolves
 * special-page aliases via the SpecialPageFactory service; that lookup
 * requires a fully bootstrapped service container (a plain
 * PHPUnit\Framework\TestCase fails with "Did not find alias for special
 * page"), so this extends MediaWikiIntegrationTestCase even though no
 * database write occurs.
 *
 * @covers KnowledgeGraph::onSidebarBeforeOutput
 */
class KnowledgeGraphOnSidebarBeforeOutputTest extends MediaWikiIntegrationTestCase {

	protected function tearDown(): void {
		unset( $GLOBALS['wgKnowledgeGraphShowSidebarLink'] );
		parent::tearDown();
	}

	public function testSidebarUnchangedWhenFlagIsFalse() {
		$GLOBALS['wgKnowledgeGraphShowSidebarLink'] = false;
		$skinMock = $this->createMock( Skin::class );
		$sidebar = [ 'TOOLBOX' => [ 'existing' ] ];

		KnowledgeGraph::onSidebarBeforeOutput( $skinMock, $sidebar );

		$this->assertSame( [ 'TOOLBOX' => [ 'existing' ] ], $sidebar );
	}

	public function testSidebarUnchangedWhenFlagIsEmptyString() {
		$GLOBALS['wgKnowledgeGraphShowSidebarLink'] = '';
		$skinMock = $this->createMock( Skin::class );
		$sidebar = [];

		KnowledgeGraph::onSidebarBeforeOutput( $skinMock, $sidebar );

		$this->assertSame( [], $sidebar );
	}

	public function testSidebarUnchangedWhenFlagIsUnset() {
		unset( $GLOBALS['wgKnowledgeGraphShowSidebarLink'] );
		$skinMock = $this->createMock( Skin::class );
		$sidebar = [];

		KnowledgeGraph::onSidebarBeforeOutput( $skinMock, $sidebar );

		$this->assertSame( [], $sidebar );
	}

	public function testToolboxEntryAddedWhenFlagIsTrue() {
		$GLOBALS['wgKnowledgeGraphShowSidebarLink'] = true;
		// getTitle() is called but its return value is never used by the
		// method; the mock only needs to avoid throwing when invoked.
		$skinMock = $this->createMock( Skin::class );
		$skinMock->method( 'getTitle' )->willReturn( null );
		$sidebar = [];

		KnowledgeGraph::onSidebarBeforeOutput( $skinMock, $sidebar );

		$this->assertArrayHasKey( 'TOOLBOX', $sidebar );
		$this->assertCount( 1, $sidebar['TOOLBOX'] );
		$entry = $sidebar['TOOLBOX'][0];
		$this->assertSame(
			wfMessage( 'knowledgegraph-knowledgegraphdesigner-label' )->text(),
			$entry['text']
		);
		$this->assertSame(
			SpecialPage::getTitleFor( 'KnowledgeGraphDesigner' )->getLocalURL(),
			$entry['href']
		);
	}

	public function testToolboxEntryAppendedToExistingEntries() {
		$GLOBALS['wgKnowledgeGraphShowSidebarLink'] = true;
		$skinMock = $this->createMock( Skin::class );
		$sidebar = [ 'TOOLBOX' => [ [ 'text' => 'existing', 'href' => '/existing' ] ] ];

		KnowledgeGraph::onSidebarBeforeOutput( $skinMock, $sidebar );

		$this->assertCount( 2, $sidebar['TOOLBOX'] );
		$this->assertSame( 'existing', $sidebar['TOOLBOX'][0]['text'] );
	}
}
