<?php

use MediaWiki\Title\Title;

/**
 * getAllPropertiesForNode() drives an internal smwbrowse API request via
 * FauxRequest/ApiMain against the real SMW store beyond the early-return
 * case covered in KnowledgeGraphGetAllPropertiesForNodeTest, so these tests
 * extend MediaWikiIntegrationTestCase and exercise the real processing body:
 * exclude-list filtering, the `_`/`___`/ctype_upper heuristics, the inverse
 * `-` prefix, and array_unique() deduplication. Mirrors the setUp/tearDown
 * SMW static-cache-clearing and skipIfFixtureDidNotTakeEffect() pattern in
 * KnowledgeGraphSetSemanticDataFromApiProcessingTest, the sibling test this
 * method's coverage issue explicitly points to for the shared mocking
 * pattern.
 *
 * @covers KnowledgeGraph::getAllPropertiesForNode
 * @group Database
 */
class KnowledgeGraphGetAllPropertiesForNodeProcessingTest extends MediaWikiIntegrationTestCase {

	protected function setUp(): void {
		parent::setUp();

		// SMW keeps several process-lifetime static caches/singletons that
		// MediaWikiIntegrationTestCase's per-test service/DB resets never
		// touch; left in place, a real-store lookup here can silently return
		// another test method's stale result.
		\SMW\Services\ServicesFactory::getInstance()->getConnectionManager()->releaseConnections();

		\SMW\DataValueFactory::getInstance()->clear();
		if ( class_exists( \SMW\Export\Exporter::class ) ) {
			\SMW\Export\Exporter::clear();
		}
		\SMW\SQLStore\EntityStore\CachingSemanticDataLookup::clear();
		\SMW\StoreFactory::clear();
		\SMW\Services\ServicesFactory::clear();
		\SMW\PropertyRegistry::clear();

		KnowledgeGraph::initSMW();
	}

	protected function tearDown(): void {
		\SMW\StoreFactory::clear();
		KnowledgeGraph::initSMW();
		parent::tearDown();
	}

	/**
	 * Real-store fixtures require SMW's LinksUpdateComplete hook to have
	 * actually written semantic data for the page. Under some SMW/MediaWiki
	 * combinations (observed with SMW 6.0.1) MediaWikiIntegrationTestCase's
	 * per-test overrideMwServices() creates a fresh HookContainer that
	 * SMW\MediaWiki\Hooks (cached once at bootstrap) never registers
	 * against, so the store silently stays empty. This isn't something a
	 * test in this class can fix; skip rather than fail when the fixture
	 * didn't take. See KnowledgeGraphSetSemanticDataFromApiProcessingTest
	 * for the same guard.
	 */
	private function skipIfFixtureDidNotTakeEffect( Title $subjectTitle ): void {
		$subject = \SMW\DIWikiPage::newFromTitle( $subjectTitle );
		if ( \SMW\StoreFactory::getStore()->getSemanticData( $subject )->isEmpty() ) {
			$this->markTestSkipped(
				'SMW never wrote semantic data for the fixture page in this environment - ' .
				'see this method\'s docblock for the known, environment-specific gap this guards against.'
			);
		}
	}

	public function testDirectPropertyIsReturnedWithSpacesInsteadOfUnderscores() {
		$target = 'GAPFNTarget1';
		$source = 'GAPFNSource1';
		$this->insertPage( $target );
		$this->insertPage( $source, '[[GAPFN Relates To::' . $target . ']]' );
		\DeferredUpdates::doUpdates();

		$sourceTitle = Title::newFromText( $source );
		$this->skipIfFixtureDidNotTakeEffect( $sourceTitle );

		$result = KnowledgeGraph::getAllPropertiesForNode( $source );

		$this->assertContains( 'GAPFN Relates To', $result );
	}

	/**
	 * The str_starts_with( $propKey, '_' ) check filters any property whose
	 * raw smwbrowse key is underscore-prefixed - this covers real SMW
	 * predefined properties (e.g. "_INST", populated by a category
	 * annotation) without needing a wikitext construct that can't otherwise
	 * produce one.
	 */
	public function testUnderscorePrefixedPredefinedPropertyIsFiltered() {
		$page = 'GAPFNCategorized1';
		$this->insertPage( $page, '[[Category:GAPFNTestCategory1]]' );
		\DeferredUpdates::doUpdates();

		$title = Title::newFromText( $page );
		$this->skipIfFixtureDidNotTakeEffect( $title );

		$result = KnowledgeGraph::getAllPropertiesForNode( $page );

		$this->assertNotContains( '-_INST', $result );
		foreach ( $result as $propKey ) {
			$this->assertStringStartsNotWith( '_', ltrim( $propKey, '-' ) );
		}
	}

	/**
	 * Every entry in self::$exclude (e.g. "_INST") is itself underscore-
	 * prefixed, and the `||` filter chain checks str_starts_with( $propKey,
	 * '_' ) unconditionally alongside the exclude-list check. This means the
	 * exclude-list branch can never be the deciding condition for any
	 * property currently in the list - it is always already caught by the
	 * underscore-prefix check first. This test locks in that the excluded
	 * property is filtered (the observable, specified behavior); it
	 * necessarily exercises the underscore-prefix branch rather than
	 * isolating the exclude-list branch, since no fixture can do the latter
	 * while every list entry starts with "_".
	 */
	public function testExcludeListPropertyIsFiltered() {
		$page = 'GAPFNCategorized2';
		$this->insertPage( $page, '[[Category:GAPFNTestCategory2]]' );
		\DeferredUpdates::doUpdates();

		$title = Title::newFromText( $page );
		$this->skipIfFixtureDidNotTakeEffect( $title );

		$this->assertContains( '_INST', KnowledgeGraph::$exclude );

		$result = KnowledgeGraph::getAllPropertiesForNode( $page );

		$this->assertNotContains( '_INST', $result );
		$this->assertNotContains( '-_INST', $result );
	}

	/**
	 * Querying the category page itself surfaces "_INST" as an inverse
	 * relation (direction === 'inverse'); from the categorized page's own
	 * perspective (tested above) it is a direct relation. Either direction
	 * must be filtered.
	 */
	public function testExcludeListPropertyIsFilteredRegardlessOfDirection() {
		$page = 'GAPFNCategorized3';
		$category = 'GAPFNTestCategory3';
		$this->insertPage( $page, '[[Category:' . $category . ']]' );
		\DeferredUpdates::doUpdates();

		$categoryTitle = Title::makeTitle( NS_CATEGORY, $category );
		$this->skipIfFixtureDidNotTakeEffect( $categoryTitle );

		$result = KnowledgeGraph::getAllPropertiesForNode( $categoryTitle->getPrefixedText() );

		$this->assertNotContains( '_INST', $result );
		$this->assertNotContains( '-_INST', $result );
	}

	public function testDeduplicatesRepeatedPropertyAcrossMultipleValues() {
		$target1 = 'GAPFNDedupTarget1';
		$target2 = 'GAPFNDedupTarget2';
		$source = 'GAPFNDedupSource';
		$this->insertPage( $target1 );
		$this->insertPage( $target2 );
		$this->insertPage(
			$source,
			'[[GAPFN Dedup Rel::' . $target1 . ']] [[GAPFN Dedup Rel::' . $target2 . ']]'
		);
		\DeferredUpdates::doUpdates();

		$sourceTitle = Title::newFromText( $source );
		$this->skipIfFixtureDidNotTakeEffect( $sourceTitle );

		$result = KnowledgeGraph::getAllPropertiesForNode( $source );

		$occurrences = array_filter( $result, static fn ( $propKey ) => $propKey === 'GAPFN Dedup Rel' );
		$this->assertCount( 1, $occurrences );
	}

	public function testAllUppercasePropertyIsFiltered() {
		$target = 'GAPFNUpperTarget';
		$source = 'GAPFNUpperSource';
		$this->insertPage( $target );
		$this->insertPage( $source, '[[ABC::' . $target . ']]' );
		\DeferredUpdates::doUpdates();

		$sourceTitle = Title::newFromText( $source );
		$this->skipIfFixtureDidNotTakeEffect( $sourceTitle );

		$result = KnowledgeGraph::getAllPropertiesForNode( $source );

		$this->assertNotContains( 'ABC', $result );
	}

	/**
	 * Querying the target's own page surfaces the relation with
	 * direction === 'inverse'; the non-excluded, non-uppercase property key
	 * must survive filtering and gain the '-' prefix.
	 */
	public function testInverseDirectionOnNonExcludedPropertyGetsDashPrefix() {
		$target = 'GAPFNInverseTarget1';
		$source = 'GAPFNInverseSource1';
		$this->insertPage( $target );
		$this->insertPage( $source, '[[GAPFN Inverse Rel::' . $target . ']]' );
		\DeferredUpdates::doUpdates();

		$targetTitle = Title::newFromText( $target );
		$this->skipIfFixtureDidNotTakeEffect( $targetTitle );

		$result = KnowledgeGraph::getAllPropertiesForNode( $target );

		$this->assertContains( '-GAPFN Inverse Rel', $result );
	}
}
