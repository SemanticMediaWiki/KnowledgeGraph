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

	/** @var array */
	private $data = [];

	/** @var array<string, bool> */
	private $relationsSeen = [];

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
		parent::tearDown();
	}

	private function resetKnowledgeGraphStatics(): void {
		$this->data = [];
		$this->relationsSeen = [];

		$reflection = new ReflectionClass( KnowledgeGraph::class );
		$externalFormatterValuesProp = $reflection->getProperty( 'externalFormatterValues' );
		$externalFormatterValuesProp->setAccessible( true );
		$externalFormatterValuesProp->setValue( null, [] );
	}

	private function call( Title $title, array $onlyProperties, int $depth, int $maxDepth ): array {
		return KnowledgeGraph::setSemanticDataFromApi(
			$title, $onlyProperties, $depth, $maxDepth, $this->data, $this->relationsSeen
		);
	}

	private function getData( string $titleText ): array {
		return $this->data[ $titleText ];
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

		$this->call( $sourceTitle, [ 'SomeOtherProperty' ], 0, 5 );

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

		$this->call( $sourceTitle, [ 'KGProcRelatesAllowed' ], 0, 5 );

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
		$this->call( $targetTitle, [ 'KGProcInverseRel1' ], 0, 5 );

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

		$this->call( $targetTitle, [ '-KGProcInverseRel2' ], 0, 5 );

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

		$this->call( $sourceTitle, [], 0, 5 );

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
	 * recursively processed, gaining its own entry in the accumulated $data.
	 */
	public function testLinkedTitleIsRecursivelyProcessedWhenDepthBelowMaxDepth() {
		$target = 'KGProcRecurseTarget';
		$source = 'KGProcRecurseSource';
		$this->insertPage( $target );
		$this->insertPage( $source, '[[KGProcRecurseRel::' . $target . ']]' );
		\DeferredUpdates::doUpdates();

		$sourceTitle = Title::newFromText( $source );
		$this->skipIfFixtureDidNotTakeEffect( $sourceTitle );

		$this->call( $sourceTitle, [], 0, 5 );

		$this->assertArrayHasKey( $target, $this->data );
	}

	/**
	 * depth >= maxDepth for the recursive call: the linked title must NOT
	 * gain a $data entry (setSemanticDataFromApi's own depth-guard
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
		$this->call( $sourceTitle, [], 0, 1 );

		$this->assertArrayNotHasKey( $target, $this->data );
	}

	/**
	 * makeRelationKey()/the $relationsSeen accumulator: processing the same
	 * relation twice (simulated by pre-seeding relationsSeen for the
	 * fixture's relation before calling) must not duplicate the value entry.
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

		$this->relationsSeen = [ $relKey => true ];

		$this->call( $sourceTitle, [], 0, 5 );

		$data = $this->getData( $source );
		$this->assertSame( [], $data['properties']['KGProcDupRel']['values'] );
		// Already-seen relation must not trigger recursion either.
		$this->assertArrayNotHasKey( $target, $this->data );
	}

	public function testCategoriesArePopulatedFromWikiPage() {
		$page = 'KGProcCategorizedPage';
		$this->insertPage( $page, '[[Category:KGProcTestCategory]]' );
		\DeferredUpdates::doUpdates();

		$title = Title::newFromText( $page );
		$this->skipIfFixtureDidNotTakeEffect( $title );

		$this->call( $title, [], 0, 5 );

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

		$this->call( $fileTitle, [], 0, 5 );

		$data = $this->getData( $fileTitle->getFullText() );
		$this->assertSame( 'https://example.test/KGProcTestFile.png', $data['src'] );
	}

	public function testFileNamespaceTitleWithNoFindableFileDoesNotSetSrc() {
		$fileTitle = Title::makeTitle( NS_FILE, 'KGProcMissingFile.png' );

		$repoGroup = $this->createMock( \RepoGroup::class );
		$repoGroup->method( 'findFile' )->willReturn( false );
		$this->setService( 'RepoGroup', $repoGroup );

		$this->call( $fileTitle, [], 0, 5 );

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

	/**
	 * A property with no `_FORMAT_SCHEMA`/`_PEFU` specification configured
	 * (the common case, e.g. a plain Number property) gets no linkFormatter.
	 */
	public function testPropertyWithoutFormatterGetsNullLinkFormatter() {
		$source = 'KGProcNumberSource';
		$this->insertPage( 'Property:KGProcAge', '[[Has type::Number]]' );
		$this->insertPage( $source, '[[KGProcAge::42]]' );
		\DeferredUpdates::doUpdates();

		$sourceTitle = Title::newFromText( $source );
		$this->skipIfFixtureDidNotTakeEffect( $sourceTitle );

		$this->call( $sourceTitle, [], 0, 5 );

		$data = $this->getData( $source );
		$this->assertArrayHasKey( 'KGProcAge', $data['properties'] );
		$this->assertNull( $data['properties']['KGProcAge']['linkFormatter'] );
	}

	/**
	 * A Keyword property (`_keyw`) with a `_FORMAT_SCHEMA` pointing at any
	 * schema page is reported as an 'ask' formatter; KnowledgeGraph.js builds
	 * the actual Special:Ask link client-side (see getLinkFormatterInfo()'s
	 * docblock), so no URL is built server-side here.
	 */
	public function testKeywordPropertyWithFormatSchemaGetsAskLinkFormatter() {
		$this->insertPage( 'smw/schema:KGProcAskSchema', json_encode( [
			'type' => 'LINK_FORMAT_SCHEMA',
			'rule' => [ 'link_to' => 'SPECIAL_SEARCH_BY_PROPERTY' ],
		] ) );
		$this->insertPage(
			'Property:KGProcKeyword',
			"[[Has type::Keyword]]\n[[Formatter schema::smw/schema:KGProcAskSchema]]"
		);
		$source = 'KGProcKeywordSource';
		$this->insertPage( $source, '[[KGProcKeyword::SomeKeyword]]' );
		\DeferredUpdates::doUpdates();

		$sourceTitle = Title::newFromText( $source );
		$this->skipIfFixtureDidNotTakeEffect( $sourceTitle );

		$this->call( $sourceTitle, [], 0, 5 );

		$data = $this->getData( $source );
		$this->assertArrayHasKey( 'KGProcKeyword', $data['properties'] );
		$this->assertSame( [ 'kind' => 'ask' ], $data['properties']['KGProcKeyword']['linkFormatter'] );

		$values = $data['properties']['KGProcKeyword']['values'];
		$this->assertNull( $values[0]['formattedUrl'], 'ask formatting has no server-built URL' );
	}

	/**
	 * A Keyword property with no `_FORMAT_SCHEMA` configured gets no
	 * linkFormatter at all, same as any other plain value type.
	 */
	public function testKeywordPropertyWithoutFormatSchemaGetsNullLinkFormatter() {
		$this->insertPage( 'Property:KGProcPlainKeyword', '[[Has type::Keyword]]' );
		$source = 'KGProcPlainKeywordSource';
		$this->insertPage( $source, '[[KGProcPlainKeyword::SomeKeyword]]' );
		\DeferredUpdates::doUpdates();

		$sourceTitle = Title::newFromText( $source );
		$this->skipIfFixtureDidNotTakeEffect( $sourceTitle );

		$this->call( $sourceTitle, [], 0, 5 );

		$data = $this->getData( $source );
		$this->assertNull( $data['properties']['KGProcPlainKeyword']['linkFormatter'] );
	}

	/**
	 * An External Identifier property (`_eid`) with a `_PEFU` formatter URI
	 * gets an 'external' linkFormatter, and each value's `formattedUrl` is
	 * the `$1`-substituted URL, built via
	 * ExternalFormatterUriValue::substituteAndFormatUri().
	 */
	public function testExternalIdentifierPropertyWithFormatterUriGetsFormattedUrlPerValue() {
		$this->insertPage(
			'Property:KGProcExternalId',
			"[[Has type::External identifier]]\n[[External formatter uri::https://example.org/id/\$1]]"
		);
		$source = 'KGProcExternalIdSource';
		$this->insertPage( $source, '[[KGProcExternalId::ABC123]]' );
		\DeferredUpdates::doUpdates();

		$sourceTitle = Title::newFromText( $source );
		$this->skipIfFixtureDidNotTakeEffect( $sourceTitle );

		$this->call( $sourceTitle, [], 0, 5 );

		$data = $this->getData( $source );
		$this->assertArrayHasKey( 'KGProcExternalId', $data['properties'] );
		$this->assertSame( [ 'kind' => 'external' ], $data['properties']['KGProcExternalId']['linkFormatter'] );

		$values = $data['properties']['KGProcExternalId']['values'];
		$this->assertSame( 'https://example.org/id/ABC123', $values[0]['formattedUrl'] );
	}

	/**
	 * An External Identifier property with no `_PEFU` formatter configured
	 * gets no linkFormatter, and values get no `formattedUrl`.
	 */
	public function testExternalIdentifierPropertyWithoutFormatterUriGetsNullLinkFormatter() {
		$this->insertPage( 'Property:KGProcPlainExternalId', '[[Has type::External identifier]]' );
		$source = 'KGProcPlainExternalIdSource';
		$this->insertPage( $source, '[[KGProcPlainExternalId::ABC123]]' );
		\DeferredUpdates::doUpdates();

		$sourceTitle = Title::newFromText( $source );
		$this->skipIfFixtureDidNotTakeEffect( $sourceTitle );

		$this->call( $sourceTitle, [], 0, 5 );

		$data = $this->getData( $source );
		$this->assertNull( $data['properties']['KGProcPlainExternalId']['linkFormatter'] );

		$values = $data['properties']['KGProcPlainExternalId']['values'];
		$this->assertArrayNotHasKey( 'formattedUrl', $values[0] );
	}
}
