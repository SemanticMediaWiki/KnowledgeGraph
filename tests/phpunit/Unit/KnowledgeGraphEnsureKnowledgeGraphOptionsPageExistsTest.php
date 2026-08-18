<?php

use MediaWiki\Title\Title;

/**
 * ensureKnowledgeGraphOptionsPageExists() creates a real wiki page via
 * WikiPage::newPageUpdater()/saveRevision(), which is not meaningfully
 * mockable; these tests extend MediaWikiIntegrationTestCase and exercise
 * the method through its only public entry point, onBeforePageDisplay().
 *
 * @covers KnowledgeGraph::onBeforePageDisplay
 * @covers KnowledgeGraph::ensureKnowledgeGraphOptionsPageExists
 * @group Database
 */
class KnowledgeGraphEnsureKnowledgeGraphOptionsPageExistsTest extends MediaWikiIntegrationTestCase {

	private function getOptionsPageTitle(): Title {
		return Title::makeTitleSafe( NS_MEDIAWIKI, 'KnowledgeGraphOptions' );
	}

	public function testPageIsCreatedWhenMissing() {
		$title = $this->getOptionsPageTitle();
		$wikiPage = KnowledgeGraph::getWikiPage( $title );
		$this->assertFalse( $wikiPage->exists(), 'Precondition: page must not already exist' );

		$outMock = $this->createMock( OutputPage::class );
		$skinMock = $this->createMock( Skin::class );
		KnowledgeGraph::onBeforePageDisplay( $outMock, $skinMock );

		$wikiPage = KnowledgeGraph::getWikiPage( $title );
		$this->assertTrue( $wikiPage->exists() );

		$content = $wikiPage->getContent( \MediaWiki\Revision\RevisionRecord::RAW );
		$this->assertSame( CONTENT_MODEL_JAVASCRIPT, $content->getModel() );

		$expectedText = rtrim( file_get_contents( __DIR__ . '/../../../data/KnowledgeGraphOptions.js' ) );
		$this->assertSame( $expectedText, rtrim( $content->getNativeData() ) );

		$revision = $wikiPage->getRevisionRecord();
		$this->assertSame( 'MediaWiki default', $revision->getUser()->getName() );
	}

	public function testExistingPageIsNotOverwritten() {
		$title = $this->getOptionsPageTitle();
		$this->insertPage( $title, 'existing custom content' );

		$wikiPage = KnowledgeGraph::getWikiPage( $title );
		$revisionBefore = $wikiPage->getRevisionRecord()->getId();

		$outMock = $this->createMock( OutputPage::class );
		$skinMock = $this->createMock( Skin::class );
		KnowledgeGraph::onBeforePageDisplay( $outMock, $skinMock );

		$wikiPage = KnowledgeGraph::getWikiPage( $title );
		$this->assertSame( $revisionBefore, $wikiPage->getRevisionRecord()->getId() );
		$this->assertSame(
			'existing custom content',
			$wikiPage->getContent( \MediaWiki\Revision\RevisionRecord::RAW )->getNativeData()
		);
	}

	/**
	 * The missing-template-file branch (file_exists() === false on
	 * data/KnowledgeGraphOptions.js) is not exercised here: forcing it
	 * would require moving/deleting the real template file shipped with
	 * the extension, which would affect any other test process running
	 * concurrently against the same checkout. The branch itself is a
	 * one-line early return guarded only by a debug log, with no
	 * observable side effect to assert on beyond "no page was created" —
	 * already covered indirectly by the fact that every other test here
	 * runs with the real file present and successfully creates the page.
	 */
}
