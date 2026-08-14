<?php

/**
 * execute() drives KnowledgeGraph::setSemanticDataFromApi() which, beyond
 * depth 0, issues internal smwbrowse API requests via FauxRequest/ApiMain
 * against the real SMW store, so these tests extend ApiTestCase rather than
 * mocking ApiMain by hand.
 *
 * @covers KnowledgeGraphApiLoadProperties::execute
 * @group Database
 */
class KnowledgeGraphApiLoadPropertiesExecuteTest extends ApiTestCase {

	/** @var \SMW\Store */
	private $realStore;

	protected function setUp(): void {
		parent::setUp();

		// SMW keeps several process-lifetime static caches/singletons
		// (CachingSemanticDataLookup, StoreFactory, ServicesFactory, its
		// DataValueFactory/Exporter, and cached DB connections held by the
		// connection manager) that MediaWikiIntegrationTestCase's per-test
		// service/DB resets never touch. Left in place, a real-store lookup
		// here can silently return another test method's stale result (or a
		// connection without this test's unittest_ table prefix) instead of
		// hitting this test's own fixtures. Mirrors SMW's own
		// tests/phpunit/SMWIntegrationTestCase.php::resetSMWServices().
		// SMW\Export\Exporter only exists since SMW 7.x (also class_exists-
		// guarded here since the CI matrix includes SMW 6.0.1).
		// releaseConnections() must run before ServicesFactory::clear(): that
		// call discards the ServicesFactory-held ConnectionManager instance,
		// so releasing connections on the *new* one afterwards is a no-op.
		\SMW\Services\ServicesFactory::getInstance()->getConnectionManager()->releaseConnections();

		\SMW\DataValueFactory::getInstance()->clear();
		if ( class_exists( \SMW\Export\Exporter::class ) ) {
			\SMW\Export\Exporter::clear();
		}
		\SMW\SQLStore\EntityStore\CachingSemanticDataLookup::clear();
		\SMW\StoreFactory::clear();
		\SMW\Services\ServicesFactory::clear();
		\SMW\PropertyRegistry::clear();

		\KnowledgeGraph::initSMW();
		$this->resetKnowledgeGraphData();
	}

	protected function tearDown(): void {
		\SMW\StoreFactory::clear();
		\KnowledgeGraph::initSMW();
		parent::tearDown();
	}

	private function resetKnowledgeGraphData(): void {
		$reflection = new ReflectionClass( KnowledgeGraph::class );
		$dataProp = $reflection->getProperty( 'data' );
		$dataProp->setAccessible( true );
		$dataProp->setValue( null, [] );
	}

	/**
	 * StoreFactory::getStore() caches instances by class in a private static array;
	 * execute() re-fetches the store via getStore() every call, so the mock must be seeded
	 * into that cache (keyed the same way the factory itself resolves the class) rather than
	 * assigned directly to a class property.
	 *
	 * Must be called only after any page-save fixtures (insertPage()) and their deferred
	 * updates have already run: SMW's own LinksUpdateComplete hook uses the real store
	 * during page save and is not part of the code under test here.
	 */
	private function injectStoreMock(): \PHPUnit\Framework\MockObject\MockObject {
		$this->realStore = \SMW\StoreFactory::getStore();
		$storeMock = $this->getMockForAbstractClass( \SMW\Store::class );

		$reflection = new ReflectionClass( \SMW\StoreFactory::class );
		$instanceProp = $reflection->getProperty( 'instance' );
		$instanceProp->setAccessible( true );
		$instanceProp->setValue( null, [ $GLOBALS['smwgDefaultStore'] => $storeMock ] );

		$kgReflection = new ReflectionClass( KnowledgeGraph::class );
		$kgStoreProp = $kgReflection->getProperty( 'SMWStore' );
		$kgStoreProp->setAccessible( true );
		$kgStoreProp->setValue( null, $storeMock );

		return $storeMock;
	}

	/**
	 * Builds an empty SemanticData container via a throwaway real store instance rather than
	 * `new \SMW\DataModel\SemanticData(...)`: that class only exists under that namespace/path
	 * since SMW 7.x — SMW 6.0.1 (also in the CI matrix) has it at `SMW\SemanticData` instead.
	 * Store::getSemanticData() returns whichever concrete class is correct for the installed
	 * SMW version.
	 *
	 * @param \PHPUnit\Framework\MockObject\MockObject $storeMock
	 */
	private function stubEmptySemanticDataAndPropertySubjects( $storeMock ): void {
		$realStore = $this->realStore;
		$storeMock->method( 'getSemanticData' )->willReturnCallback(
			static fn ( $subject ) => $realStore->getSemanticData( $subject )
		);
		$storeMock->method( 'getPropertySubjects' )->willReturn( [] );
	}

	private function runLoadProperties( array $overrideParams = [] ): array {
		[ $result ] = $this->doApiRequestWithToken( array_merge( [
			'action' => 'knowledgegraph-load-properties',
			'properties' => 'SomeProperty',
			'depth' => 0,
			'limit' => 0,
			'offset' => 0,
		], $overrideParams ) );

		return json_decode( $result['knowledgegraph-load-properties']['data'], true );
	}

	/**
	 * Regression test: execute() previously referenced an undefined self::$data
	 * (KnowledgeGraphApiLoadProperties does not declare a $data property; only
	 * KnowledgeGraph does), which is a fatal `Error: Access to undeclared static
	 * property` on the very first known node processed.
	 */
	public function testExecuteDoesNotFatalOnKnownNode() {
		$this->insertPage( 'KGPropsNoFatalNode' );
		\DeferredUpdates::doUpdates();

		$storeMock = $this->injectStoreMock();
		$this->stubEmptySemanticDataAndPropertySubjects( $storeMock );

		$data = $this->runLoadProperties( [
			'nodes' => 'KGPropsNoFatalNode',
		] );

		$this->assertArrayHasKey( 'KGPropsNoFatalNode', $data );
	}

	public function testMultipleNodesAreEachProcessed() {
		$this->insertPage( 'KGPropsMultiNodeA' );
		$this->insertPage( 'KGPropsMultiNodeB' );
		\DeferredUpdates::doUpdates();

		$storeMock = $this->injectStoreMock();
		$this->stubEmptySemanticDataAndPropertySubjects( $storeMock );

		$data = $this->runLoadProperties( [
			'nodes' => 'KGPropsMultiNodeA|KGPropsMultiNodeB',
		] );

		$this->assertArrayHasKey( 'KGPropsMultiNodeA', $data );
		$this->assertArrayHasKey( 'KGPropsMultiNodeB', $data );
	}

	/**
	 * Title::newFromText() returns null for titles containing illegal characters
	 * (e.g. "<" or ">"); execute() must skip such entries silently instead of fataling.
	 */
	public function testUnknownOrInvalidTitleIsSkippedWithoutAffectingOthers() {
		$this->insertPage( 'KGPropsKnownNode' );
		\DeferredUpdates::doUpdates();

		$storeMock = $this->injectStoreMock();
		$this->stubEmptySemanticDataAndPropertySubjects( $storeMock );

		$data = $this->runLoadProperties( [
			'nodes' => 'KGPropsKnownNode|KGPropsDoesNotExistAnywhere|<>',
		] );

		$this->assertArrayHasKey( 'KGPropsKnownNode', $data );
		$this->assertCount( 1, $data );
	}

	/**
	 * depth=0 must short-circuit setSemanticDataFromApi() into creating only the
	 * root node entry (no properties/categories fetched) — see KnowledgeGraph::
	 * setSemanticDataFromApi()'s maxDepth === 0 branch.
	 */
	public function testDepthZeroCreatesRootNodeOnly() {
		$this->insertPage( 'KGPropsDepthZeroNode' );
		\DeferredUpdates::doUpdates();

		$storeMock = $this->injectStoreMock();
		$this->stubEmptySemanticDataAndPropertySubjects( $storeMock );

		$data = $this->runLoadProperties( [
			'nodes' => 'KGPropsDepthZeroNode',
			'depth' => 0,
		] );

		$this->assertSame(
			[ 'properties' => [], 'categories' => [] ],
			$data['KGPropsDepthZeroNode']
		);
	}

	/**
	 * A node already present in KnowledgeGraph::$data (e.g. because it was
	 * already processed as a previous entry in the same nodes list) must not
	 * be reprocessed: setSemanticDataFromApi() must not be invoked for it again.
	 */
	public function testNodeAlreadyInDataIsNotReprocessed() {
		$this->insertPage( 'KGPropsAlreadySeenNode' );
		\DeferredUpdates::doUpdates();

		$storeMock = $this->injectStoreMock();
		$this->stubEmptySemanticDataAndPropertySubjects( $storeMock );

		$reflection = new ReflectionClass( KnowledgeGraph::class );
		$dataProp = $reflection->getProperty( 'data' );
		$dataProp->setAccessible( true );
		$dataProp->setValue( null, [
			'KGPropsAlreadySeenNode' => [ 'properties' => [ 'sentinel' => true ], 'categories' => [] ],
		] );

		$data = $this->runLoadProperties( [
			'nodes' => 'KGPropsAlreadySeenNode',
			'depth' => 5,
		] );

		$this->assertSame(
			[ 'properties' => [ 'sentinel' => true ], 'categories' => [] ],
			$data['KGPropsAlreadySeenNode']
		);
	}

	/**
	 * inversePropsIncluded=true/false must not affect execute()'s ability to
	 * produce the root node entry; the inverse-expansion logic itself
	 * (execute() delegates to KnowledgeGraphApiLoadProperties::
	 * expandInverseProperties()) is covered directly, without any SMW/store
	 * dependency, in KnowledgeGraphApiLoadPropertiesTest.
	 */
	public function testInversePropsIncludedDoesNotAffectRootNodeCreation() {
		$this->insertPage( 'KGPropsInverseNode' );
		\DeferredUpdates::doUpdates();

		$storeMock = $this->injectStoreMock();
		$this->stubEmptySemanticDataAndPropertySubjects( $storeMock );

		$data = $this->runLoadProperties( [
			'nodes' => 'KGPropsInverseNode',
			'properties' => 'Foo|Bar',
			'inversePropsIncluded' => 1,
			'depth' => 0,
		] );

		$this->assertSame(
			[ 'properties' => [], 'categories' => [] ],
			$data['KGPropsInverseNode']
		);
	}

	/**
	 * End-to-end check against the real SMW store (no store mock): a page
	 * that both sets and receives a property must show up on both the
	 * outgoing and, when inversePropsIncluded=true, the "-property" (inverse)
	 * side, at depth=1.
	 *
	 * Known environment-specific gap: under some SMW/MediaWiki combinations
	 * (observed with SMW 6.0.1), MediaWikiIntegrationTestCase::setUp()'s
	 * overrideMwServices() creates a fresh MediaWikiServices instance (and
	 * HookContainer) for every test, but SMW\MediaWiki\Hooks caches the
	 * HookContainer it registered against on construction (once, at
	 * extension bootstrap) - so its LinksUpdateComplete handler never runs
	 * against the fresh container, the store is never written to, and even
	 * a direct Store::getSemanticData() lookup right after insertPage() /
	 * editPage() sees nothing (confirmed by tracing the handler directly:
	 * it's simply never called). This isn't something a test in this class
	 * can fix; skip rather than fail when the fixture didn't take.
	 */
	public function testInversePropsIncludedWithRealStoreFixture() {
		$this->insertPage( 'KGPropsRealTarget' );
		$this->insertPage( 'KGPropsRealSource', '[[KGTestRelates::KGPropsRealTarget]]' );
		\DeferredUpdates::doUpdates();

		\KnowledgeGraph::initSMW();

		$sourceSubject = \SMW\DIWikiPage::newFromTitle( \MediaWiki\Title\Title::newFromText( 'KGPropsRealSource' ) );
		if ( \SMW\StoreFactory::getStore()->getSemanticData( $sourceSubject )->isEmpty() ) {
			$this->markTestSkipped(
				'SMW never wrote semantic data for the fixture page in this environment - ' .
				'see this method\'s docblock for the known, environment-specific gap this guards against.'
			);
		}

		$data = $this->runLoadProperties( [
			'nodes' => 'KGPropsRealTarget',
			'properties' => 'KGTestRelates',
			'inversePropsIncluded' => 1,
			'depth' => 1,
		] );

		$this->assertArrayHasKey( 'KGPropsRealTarget', $data );
		$this->assertArrayHasKey( '-KGTestRelates', $data['KGPropsRealTarget']['properties'] );
	}
}
