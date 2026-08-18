<?php

use MediaWiki\Title\Title;

/**
 * setSemanticDataFromApi() drives an internal smwbrowse API request via
 * FauxRequest/ApiMain against the real SMW store beyond depth 0 (see the
 * early-return-only coverage in KnowledgeGraphSetSemanticDataFromApiTest),
 * so these tests extend MediaWikiIntegrationTestCase and exercise the real
 * processing body: property filtering, dataitem/title-link assembly,
 * recursion, duplicate-relation prevention, the NS_FILE special case,
 * category population, and property-metadata enrichment.
 *
 * @covers KnowledgeGraph::setSemanticDataFromApi
 * @group Database
 */
class KnowledgeGraphSetSemanticDataFromApiProcessingTest extends MediaWikiIntegrationTestCase {

	protected function setUp(): void {
		parent::setUp();

		// SMW keeps several process-lifetime static caches/singletons that
		// MediaWikiIntegrationTestCase's per-test service/DB resets never
		// touch; left in place, a real-store lookup here can silently return
		// another test method's stale result. Mirrors the pattern in
		// KnowledgeGraphApiLoadPropertiesExecuteTest::setUp().
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
		$this->resetKnowledgeGraphStatics();
	}

	protected function tearDown(): void {
		\SMW\StoreFactory::clear();
		KnowledgeGraph::initSMW();
		$this->resetKnowledgeGraphStatics();
		parent::tearDown();
	}

	private function resetKnowledgeGraphStatics(): void {
		$reflection = new ReflectionClass( KnowledgeGraph::class );

		$dataProp = $reflection->getProperty( 'data' );
		$dataProp->setAccessible( true );
		$dataProp->setValue( null, [] );

		$relationsSeenProp = $reflection->getProperty( 'relationsSeen' );
		$relationsSeenProp->setAccessible( true );
		$relationsSeenProp->setValue( null, [] );
	}

	private function getData( string $titleText ): array {
		return KnowledgeGraph::$data[ $titleText ];
	}

	/**
	 * Real-store fixtures require SMW's LinksUpdateComplete hook to have
	 * actually written semantic data for the page. Under some SMW/MediaWiki
	 * combinations (observed with SMW 6.0.1) MediaWikiIntegrationTestCase's
	 * per-test overrideMwServices() creates a fresh HookContainer that
	 * SMW\MediaWiki\Hooks (cached once at bootstrap) never registers
	 * against, so the store silently stays empty. This isn't something a
	 * test in this class can fix; skip rather than fail when the fixture
	 * didn't take. See KnowledgeGraphApiLoadPropertiesExecuteTest for the
	 * same guard.
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

	public function testDirectPropertyOutsideAllowListIsSkipped() {
		$target = 'KGProcTarget1';
		$this->insertPage( $target );
		$source = 'KGProcSourceFilteredOut';
		$this->insertPage( $source, '[[KGProcRelatesFiltered::' . $target . ']]' );
		\DeferredUpdates::doUpdates();

		$sourceTitle = Title::newFromText( $source );
		$this->skipIfFixtureDidNotTakeEffect( $sourceTitle );

		KnowledgeGraph::setSemanticDataFromApi( $sourceTitle, [ 'SomeOtherProperty' ], 0, 5 );

		$data = $this->getData( $source );
		$this->assertArrayNotHasKey( 'KGProcRelatesFiltered', $data['properties'] );
	}

	public function testDirectPropertyInAllowListIsProcessed() {
		$target = 'KGProcTarget2';
		$this->insertPage( $target );
		$source = 'KGProcSourceAllowed';
		$this->insertPage( $source, '[[KGProcRelatesAllowed::' . $target . ']]' );
		\DeferredUpdates::doUpdates();

		$sourceTitle = Title::newFromText( $source );
		$this->skipIfFixtureDidNotTakeEffect( $sourceTitle );

		KnowledgeGraph::setSemanticDataFromApi( $sourceTitle, [ 'KGProcRelatesAllowed' ], 0, 5 );

		$data = $this->getData( $source );
		$this->assertArrayHasKey( 'KGProcRelatesAllowed', $data['properties'] );
	}

	/**
	 * The `if ($isInverse && !in_array($propKey, $onlyProperties)) continue;`
	 * branch: an inverse relation is only kept when the '-'-prefixed key
	 * itself is in the allow-list; listing the bare (non-prefixed) key is
	 * not sufficient for the inverse direction.
	 */
	public function testInversePropertyExcludedWhenOnlyBareKeyIsAllowed() {
		$target = 'KGProcInverseTarget1';
		$source = 'KGProcInverseSource1';
		$this->insertPage( $target );
		$this->insertPage( $source, '[[KGProcInverseRel1::' . $target . ']]' );
		\DeferredUpdates::doUpdates();

		$targetTitle = Title::newFromText( $target );
		$this->skipIfFixtureDidNotTakeEffect( $targetTitle );

		// Querying from $target's perspective surfaces the relation as inverse.
		KnowledgeGraph::setSemanticDataFromApi( $targetTitle, [ 'KGProcInverseRel1' ], 0, 5 );

		$data = $this->getData( $target );
		$this->assertArrayNotHasKey( '-KGProcInverseRel1', $data['properties'] );
	}

	public function testInversePropertyIncludedWhenPrefixedKeyIsAllowed() {
		$target = 'KGProcInverseTarget2';
		$source = 'KGProcInverseSource2';
		$this->insertPage( $target );
		$this->insertPage( $source, '[[KGProcInverseRel2::' . $target . ']]' );
		\DeferredUpdates::doUpdates();

		$targetTitle = Title::newFromText( $target );
		$this->skipIfFixtureDidNotTakeEffect( $targetTitle );

		KnowledgeGraph::setSemanticDataFromApi( $targetTitle, [ '-KGProcInverseRel2' ], 0, 5 );

		$data = $this->getData( $target );
		$this->assertArrayHasKey( '-KGProcInverseRel2', $data['properties'] );
	}

	/**
	 * dataitem type=9 (title link) entries assemble "$linkedTitle" via
	 * NamespaceInfo::getCanonicalName() and the '_' -> ' ' replacement, and
	 * enrich the property with real SMW metadata (typeId, canonicalLabel,
	 * preferredLabel, typeLabel, description) on first occurrence.
	 */
	public function testTitleLinkDataitemIsAssembledAndPropertyMetadataIsEnriched() {
		$target = 'KGProcLinkTarget';
		$source = 'KGProcLinkSource';
		$this->insertPage( $target );
		$this->insertPage( $source, '[[KGProcLinksTo::' . $target . ']]' );
		\DeferredUpdates::doUpdates();

		$sourceTitle = Title::newFromText( $source );
		$this->skipIfFixtureDidNotTakeEffect( $sourceTitle );

		KnowledgeGraph::setSemanticDataFromApi( $sourceTitle, [], 0, 5 );

		$data = $this->getData( $source );
		$this->assertArrayHasKey( 'KGProcLinksTo', $data['properties'] );

		$property = $data['properties']['KGProcLinksTo'];
		$this->assertArrayHasKey( 'typeId', $property );
		$this->assertArrayHasKey( 'canonicalLabel', $property );
		$this->assertArrayHasKey( 'preferredLabel', $property );
		$this->assertArrayHasKey( 'typeLabel', $property );
		$this->assertArrayHasKey( 'description', $property );
		$this->assertFalse( $property['inverse'] );

		$this->assertSame( [ [ 'value' => $target ] ], $property['values'] );
	}

	/**
	 * depth < maxDepth: a linked title discovered via a dataitem entry is
	 * recursively processed, gaining its own self::$data entry.
	 */
	public function testLinkedTitleIsRecursivelyProcessedWhenDepthBelowMaxDepth() {
		$target = 'KGProcRecurseTarget';
		$source = 'KGProcRecurseSource';
		$this->insertPage( $target );
		$this->insertPage( $source, '[[KGProcRecurseRel::' . $target . ']]' );
		\DeferredUpdates::doUpdates();

		$sourceTitle = Title::newFromText( $source );
		$this->skipIfFixtureDidNotTakeEffect( $sourceTitle );

		KnowledgeGraph::setSemanticDataFromApi( $sourceTitle, [], 0, 5 );

		$this->assertArrayHasKey( $target, KnowledgeGraph::$data );
	}

	/**
	 * depth >= maxDepth for the recursive call: the linked title must NOT
	 * gain a self::$data entry (setSemanticDataFromApi's own depth-guard
	 * short-circuits it).
	 */
	public function testLinkedTitleIsNotProcessedWhenDepthReachesMaxDepth() {
		$target = 'KGProcNoRecurseTarget';
		$source = 'KGProcNoRecurseSource';
		$this->insertPage( $target );
		$this->insertPage( $source, '[[KGProcNoRecurseRel::' . $target . ']]' );
		\DeferredUpdates::doUpdates();

		$sourceTitle = Title::newFromText( $source );
		$this->skipIfFixtureDidNotTakeEffect( $sourceTitle );

		// maxDepth=1, depth=0: the root itself is processed (0 < 1), but the
		// recursive call for the linked title runs at depth=1 which is not
		// < maxDepth=1, so it must short-circuit without adding data.
		KnowledgeGraph::setSemanticDataFromApi( $sourceTitle, [], 0, 1 );

		$this->assertArrayNotHasKey( $target, KnowledgeGraph::$data );
	}

	/**
	 * makeRelationKey()/self::$relationsSeen: processing the same relation
	 * twice (simulated by pre-seeding relationsSeen for the fixture's
	 * relation before calling) must not duplicate the value entry.
	 */
	public function testDuplicateRelationIsNotProcessedTwice() {
		$target = 'KGProcDupTarget';
		$source = 'KGProcDupSource';
		$this->insertPage( $target );
		$this->insertPage( $source, '[[KGProcDupRel::' . $target . ']]' );
		\DeferredUpdates::doUpdates();

		$sourceTitle = Title::newFromText( $source );
		$this->skipIfFixtureDidNotTakeEffect( $sourceTitle );

		$reflection = new ReflectionClass( KnowledgeGraph::class );
		$method = $reflection->getMethod( 'makeRelationKey' );
		$method->setAccessible( true );
		$relKey = $method->invoke( null, $source, $target, 'KGProcDupRel' );

		$relationsSeenProp = $reflection->getProperty( 'relationsSeen' );
		$relationsSeenProp->setAccessible( true );
		$relationsSeenProp->setValue( null, [ $relKey => true ] );

		KnowledgeGraph::setSemanticDataFromApi( $sourceTitle, [], 0, 5 );

		$data = $this->getData( $source );
		$this->assertSame( [], $data['properties']['KGProcDupRel']['values'] );
		// Already-seen relation must not trigger recursion either.
		$this->assertArrayNotHasKey( $target, KnowledgeGraph::$data );
	}

	public function testCategoriesArePopulatedFromWikiPage() {
		$page = 'KGProcCategorizedPage';
		$this->insertPage( $page, '[[Category:KGProcTestCategory]]' );
		\DeferredUpdates::doUpdates();

		$title = Title::newFromText( $page );
		$this->skipIfFixtureDidNotTakeEffect( $title );

		KnowledgeGraph::setSemanticDataFromApi( $title, [], 0, 5 );

		$data = $this->getData( $page );
		$this->assertContains( 'KGProcTestCategory', $data['categories'] );
	}

	/**
	 * NS_FILE special case: RepoGroup::findFile() returning a real file
	 * must populate $output['src'] with the file's full URL.
	 */
	public function testFileNamespaceTitleWithFindableFileSetsSrc() {
		$fileTitle = Title::makeTitle( NS_FILE, 'KGProcTestFile.png' );

		$file = $this->createMock( \File::class );
		$file->method( 'getFullUrl' )->willReturn( 'https://example.test/KGProcTestFile.png' );

		$repoGroup = $this->createMock( \RepoGroup::class );
		$repoGroup->method( 'findFile' )->willReturn( $file );
		$this->setService( 'RepoGroup', $repoGroup );

		KnowledgeGraph::setSemanticDataFromApi( $fileTitle, [], 0, 5 );

		$data = $this->getData( $fileTitle->getFullText() );
		$this->assertSame( 'https://example.test/KGProcTestFile.png', $data['src'] );
	}

	public function testFileNamespaceTitleWithNoFindableFileDoesNotSetSrc() {
		$fileTitle = Title::makeTitle( NS_FILE, 'KGProcMissingFile.png' );

		$repoGroup = $this->createMock( \RepoGroup::class );
		$repoGroup->method( 'findFile' )->willReturn( false );
		$this->setService( 'RepoGroup', $repoGroup );

		KnowledgeGraph::setSemanticDataFromApi( $fileTitle, [], 0, 5 );

		$data = $this->getData( $fileTitle->getFullText() );
		$this->assertArrayNotHasKey( 'src', $data );
	}

	/**
	 * Not covered here: the fallback shape (`['key' => ..., 'values' => []]`,
	 * no metadata keys) used when Title::newFromText(ltrim($propKey, '-'))
	 * or DIProperty::newFromUserLabel() returns null for the property key.
	 * Reaching that branch requires the real smwbrowse API response to
	 * contain a `property` entry with characters illegal in a title (e.g.
	 * '<', '>', '|', '#') - not producible through normal wikitext property
	 * annotation, and not usefully producible by mocking the store, since
	 * setSemanticDataFromApi() talks to a real ApiMain/FauxRequest
	 * 'smwbrowse' call rather than the store directly. Left as a documented
	 * gap rather than forced with a brittle ApiMain mock.
	 */

	/**
	 * The SMW API error case ($result['error'] set) is likewise not covered
	 * here: it requires the real smwbrowse action to itself produce an API
	 * error for a well-formed subject/ns pair, which isn't reachable through
	 * a normal fixture, and forcing it via a partial ApiMain mock would
	 * bypass the real execute()/getResult() round trip this method actually
	 * depends on. Left as a documented gap for the same reason as above.
	 */
}
