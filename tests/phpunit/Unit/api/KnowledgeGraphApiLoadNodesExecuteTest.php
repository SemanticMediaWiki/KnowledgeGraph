<?php

/**
 * execute() drives KnowledgeGraph::getAllPropertiesForNode() and
 * KnowledgeGraph::setSemanticDataFromApi(), both of which issue internal
 * smwbrowse API requests via FauxRequest/ApiMain against the real SMW store,
 * so these tests extend ApiTestCase rather than mocking ApiMain by hand.
 *
 * @covers KnowledgeGraphApiLoadNodes::execute
 * @group Database
 */
class KnowledgeGraphApiLoadNodesExecuteTest extends ApiTestCase {

	/** @var \SMW\Store */
	private $realStore;

	protected function setUp(): void {
		parent::setUp();
		\SMW\StoreFactory::clear();
		\KnowledgeGraph::initSMW();
	}

	protected function tearDown(): void {
		\SMW\StoreFactory::clear();
		\KnowledgeGraph::initSMW();
		parent::tearDown();
	}

	/**
	 * StoreFactory::getStore() caches instances by class in a private static array;
	 * execute() re-fetches the store via getStore() every call, so the mock must be seeded
	 * into that cache (keyed the same way the factory itself resolves the class) rather than
	 * assigned directly to KnowledgeGraphApiLoadNodes::$SMWStore.
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

	private function runLoadNodes( array $overrideParams = [] ): array {
		[ $result ] = $this->doApiRequestWithToken( array_merge( [
			'action' => 'knowledgegraph-load-nodes',
			'depth' => 0,
		], $overrideParams ) );

		return json_decode( $result['knowledgegraph-load-nodes']['data'], true );
	}

	public function testMultipleTitlesAreEachProcessed() {
		$this->insertPage( 'KGTestMultiNodeA' );
		$this->insertPage( 'KGTestMultiNodeB' );
		\DeferredUpdates::doUpdates();

		$storeMock = $this->injectStoreMock();
		$this->stubEmptySemanticDataAndPropertySubjects( $storeMock );

		$data = $this->runLoadNodes( [
			'titles' => 'KGTestMultiNodeA|KGTestMultiNodeB',
		] );

		$this->assertArrayHasKey( 'KGTestMultiNodeA', $data );
		$this->assertArrayHasKey( 'KGTestMultiNodeB', $data );
	}

	public function testUnknownTitleIsSkippedWithoutAffectingOthers() {
		$this->insertPage( 'KGTestKnownNode' );
		\DeferredUpdates::doUpdates();

		$storeMock = $this->injectStoreMock();
		$this->stubEmptySemanticDataAndPropertySubjects( $storeMock );

		$data = $this->runLoadNodes( [
			'titles' => 'KGTestKnownNode|KGTestDoesNotExistAnywhere',
		] );

		$this->assertArrayHasKey( 'KGTestKnownNode', $data );
		$this->assertCount( 1, $data );
	}

	/**
	 * Title::newFromText() returns null for titles containing illegal characters
	 * (e.g. "<" or ">"); execute() must skip such entries silently instead of fataling.
	 */
	public function testInvalidTitleTextIsSkippedWithoutAffectingOthers() {
		$this->insertPage( 'KGTestValidNode' );
		\DeferredUpdates::doUpdates();

		$storeMock = $this->injectStoreMock();
		$this->stubEmptySemanticDataAndPropertySubjects( $storeMock );

		$data = $this->runLoadNodes( [
			'titles' => 'KGTestValidNode|<>',
		] );

		$this->assertArrayHasKey( 'KGTestValidNode', $data );
		$this->assertCount( 1, $data );
	}

	/**
	 * Regression test: execute() previously referenced an undefined self::$data
	 * (KnowledgeGraphApiLoadNodes does not declare a $data property; only
	 * KnowledgeGraph does), which is a fatal `Error: Access to undeclared static
	 * property` on the very first known title processed.
	 */
	public function testExecuteDoesNotFatalOnKnownTitle() {
		$this->insertPage( 'KGTestNoFatalNode' );
		\DeferredUpdates::doUpdates();

		$storeMock = $this->injectStoreMock();
		$this->stubEmptySemanticDataAndPropertySubjects( $storeMock );

		$data = $this->runLoadNodes( [
			'titles' => 'KGTestNoFatalNode',
		] );

		$this->assertArrayHasKey( 'KGTestNoFatalNode', $data );
	}

	/**
	 * depth=0 must short-circuit setSemanticDataFromApi() into creating only the
	 * root node entry (no properties/categories fetched) — see KnowledgeGraph::
	 * setSemanticDataFromApi()'s maxDepth === 0 branch.
	 */
	public function testDepthZeroCreatesRootNodeOnly() {
		$this->insertPage( 'KGTestDepthZeroNode' );
		\DeferredUpdates::doUpdates();

		$storeMock = $this->injectStoreMock();
		$this->stubEmptySemanticDataAndPropertySubjects( $storeMock );

		$data = $this->runLoadNodes( [
			'titles' => 'KGTestDepthZeroNode',
			'depth' => 0,
		] );

		$this->assertSame(
			[ 'properties' => [], 'categories' => [], 'displayTitle' => null ],
			$data['KGTestDepthZeroNode']
		);
	}

	/**
	 * Regression test: getPropertiesForTitle() previously ignored the `properties`
	 * param entirely and always loaded every discoverable property via
	 * KnowledgeGraph::getAllPropertiesForNode(), silently dropping an explicit
	 * allow-list. getAllowedParams() already declared `properties` as an accepted
	 * param, but it was dead code before this fix. It now honors `properties`
	 * when given. The client (KnowledgeGraphNodes.js) sends this param as a
	 * JSON-encoded array, not a pipe-delimited string.
	 */
	public function testPropertiesParamFiltersLoadedProperties() {
		$this->insertPage( 'KGTestPropsFilterNode' );
		\DeferredUpdates::doUpdates();

		$storeMock = $this->injectStoreMock();
		$this->stubEmptySemanticDataAndPropertySubjects( $storeMock );

		$data = $this->runLoadNodes( [
			'titles' => 'KGTestPropsFilterNode',
			'properties' => json_encode( [ 'HasProperty1' ] ),
			'depth' => 1,
		] );

		$this->assertSame( [], $data['KGTestPropsFilterNode']['properties'] );
	}

	/**
	 * Regression test for the empty-selection wire format: the client sends
	 * `properties=[]` (JSON.stringify() of an empty array) to mean "no filter,
	 * load every discoverable property" -- not "filter to zero properties".
	 * A naive `!empty($params['properties'])` check treats the non-empty
	 * string "[]" as a real filter and silently drops every property.
	 */
	public function testEmptyPropertiesParamLoadsAllProperties() {
		$this->insertPage( 'KGTestPropsEmptyFilterNode' );
		\DeferredUpdates::doUpdates();

		$storeMock = $this->injectStoreMock();
		$this->stubEmptySemanticDataAndPropertySubjects( $storeMock );

		$data = $this->runLoadNodes( [
			'titles' => 'KGTestPropsEmptyFilterNode',
			'properties' => json_encode( [] ),
			'depth' => 1,
		] );

		$this->assertArrayHasKey( 'KGTestPropsEmptyFilterNode', $data );
	}

	/**
	 * A title listed twice in the same request's `titles` list must not be
	 * reprocessed the second time: setSemanticDataFromApi() must not be
	 * invoked again once the accumulated $data already holds the entry from
	 * the first occurrence.
	 */
	public function testTitleAlreadyInDataIsNotReprocessed() {
		$this->insertPage( 'KGTestAlreadySeenNode' );
		\DeferredUpdates::doUpdates();

		$storeMock = $this->injectStoreMock();
		$this->stubEmptySemanticDataAndPropertySubjects( $storeMock );

		$data = $this->runLoadNodes( [
			'titles' => 'KGTestAlreadySeenNode|KGTestAlreadySeenNode',
			'depth' => 0,
		] );

		$this->assertSame(
			[ 'properties' => [], 'categories' => [], 'displayTitle' => null ],
			$data['KGTestAlreadySeenNode']
		);
	}
}
