<?php

/**
 * execute() drives KnowledgeGraph::getAllPropertiesForNode() and
 * KnowledgeGraph::setSemanticDataFromApi(), both of which issue internal
 * smwbrowse API requests via FauxRequest/ApiMain against the real SMW store,
 * so these tests extend ApiTestCase rather than mocking ApiMain by hand.
 *
 * @covers KnowledgeGraphApiLoadGraph::execute
 * @group Database
 */
class KnowledgeGraphApiLoadGraphExecuteTest extends ApiTestCase {

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
	 * See KnowledgeGraphApiLoadNodesExecuteTest::injectStoreMock() -- identical
	 * rationale, duplicated here rather than shared since PHPUnit test classes
	 * are otherwise fully independent in this repo.
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

	private function stubEmptySemanticDataAndPropertySubjects( $storeMock ): void {
		$realStore = $this->realStore;
		$storeMock->method( 'getSemanticData' )->willReturnCallback(
			static fn ( $subject ) => $realStore->getSemanticData( $subject )
		);
		$storeMock->method( 'getPropertySubjects' )->willReturn( [] );
	}

	/**
	 * Uses doApiRequest() (no token) rather than doApiRequestWithToken(), since
	 * this endpoint must work as an anonymous, tokenless GET -- see
	 * KnowledgeGraphApiLoadGraphTest::testIsReadOnlyAndAnonymousSafe().
	 */
	private function runLoadGraph( array $overrideParams = [] ): array {
		[ $result ] = $this->doApiRequest( array_merge( [
			'action' => 'knowledgegraph-load-graph',
			'depth' => 0,
		], $overrideParams ) );

		return json_decode( $result['knowledgegraph-load-graph']['data'], true );
	}

	public function testWorksWithoutACsrfToken() {
		$this->insertPage( 'KGLoadGraphNoTokenNode' );
		\DeferredUpdates::doUpdates();

		$storeMock = $this->injectStoreMock();
		$this->stubEmptySemanticDataAndPropertySubjects( $storeMock );

		$data = $this->runLoadGraph( [
			'titles' => 'KGLoadGraphNoTokenNode',
		] );

		$this->assertArrayHasKey( 'KGLoadGraphNoTokenNode', $data );
	}

	/**
	 * Multiple root titles share one $data/$relationsSeen accumulator across
	 * the whole request (see KnowledgeGraphApiLoadTrait::execute()), the same
	 * way KnowledgeGraph::parserFunctionKnowledgeGraph() used to before #102 --
	 * this endpoint is now the sole place that recursive resolution happens.
	 */
	public function testMultipleRootTitlesShareOneAccumulator() {
		$this->insertPage( 'KGLoadGraphMultiRootA' );
		$this->insertPage( 'KGLoadGraphMultiRootB' );
		\DeferredUpdates::doUpdates();

		$storeMock = $this->injectStoreMock();
		$this->stubEmptySemanticDataAndPropertySubjects( $storeMock );

		$data = $this->runLoadGraph( [
			'titles' => 'KGLoadGraphMultiRootA|KGLoadGraphMultiRootB',
		] );

		$this->assertArrayHasKey( 'KGLoadGraphMultiRootA', $data );
		$this->assertArrayHasKey( 'KGLoadGraphMultiRootB', $data );
	}

	/**
	 * Covers the getPropertiesForTitle() gap fixed alongside this endpoint's
	 * introduction: KnowledgeGraphApiLoadNodes previously ignored the
	 * `properties` param entirely and always loaded every discoverable
	 * property. KnowledgeGraphApiLoadGraph (and the fixed LoadNodes) now
	 * honor an explicit allow-list when given.
	 */
	public function testPropertiesParamFiltersLoadedProperties() {
		$this->insertPage( 'KGLoadGraphPropsFilterNode' );
		\DeferredUpdates::doUpdates();

		$storeMock = $this->injectStoreMock();
		$this->stubEmptySemanticDataAndPropertySubjects( $storeMock );

		$data = $this->runLoadGraph( [
			'titles' => 'KGLoadGraphPropsFilterNode',
			'properties' => 'HasProperty1',
			'depth' => 1,
		] );

		$this->assertSame( [], $data['KGLoadGraphPropsFilterNode']['properties'] );
	}

	public function testUnknownTitleIsSkippedWithoutAffectingOthers() {
		$this->insertPage( 'KGLoadGraphKnownNode' );
		\DeferredUpdates::doUpdates();

		$storeMock = $this->injectStoreMock();
		$this->stubEmptySemanticDataAndPropertySubjects( $storeMock );

		$data = $this->runLoadGraph( [
			'titles' => 'KGLoadGraphKnownNode|KGLoadGraphDoesNotExistAnywhere',
		] );

		$this->assertArrayHasKey( 'KGLoadGraphKnownNode', $data );
		$this->assertCount( 1, $data );
	}
}
