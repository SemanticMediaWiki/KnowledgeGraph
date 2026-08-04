<?php

use MediaWiki\Http\HttpRequestFactory;

/**
 * execute() needs a real category-links DB fixture (KnowledgeGraph::articlesInCategories()
 * runs a real DB query) and drives the request through the real API stack (needsToken(),
 * mustBePosted()), so these tests extend ApiTestCase rather than mocking ApiMain by hand.
 *
 * @covers KnowledgeGraphApiLoadCategories::execute
 * @group Database
 */
class KnowledgeGraphApiLoadCategoriesExecuteTest extends ApiTestCase {

	/** @var \SMW\Store */
	private $realStore;

	protected function setUp(): void {
		parent::setUp();
		\SMW\StoreFactory::clear();
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
	 * assigned directly to KnowledgeGraphApiLoadCategories::$SMWStore.
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

	private function mockAllPagesResponse( array $propertyTitles ): void {
		$httpRequestFactory = $this->createMock( HttpRequestFactory::class );
		$httpRequestFactory->method( 'get' )->willReturn( json_encode( [
			'query' => [
				'allpages' => array_map( static fn ( $title ) => [ 'title' => $title ], $propertyTitles ),
			],
		] ) );
		$this->setService( 'HttpRequestFactory', $httpRequestFactory );
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

	private function runLoadCategories( array $overrideParams = [] ): array {
		[ $result ] = $this->doApiRequestWithToken( array_merge( [
			'action' => 'knowledgegraph-load-categories',
			'depth' => 0,
			'limit' => 10,
			'offset' => 0,
		], $overrideParams ) );

		return json_decode( $result['knowledgegraph-load-categories']['data'], true );
	}

	public function testMultipleCategoriesAreEachProcessed() {
		$this->mockAllPagesResponse( [] );

		$this->insertPage( 'KGTestMultiCatMemberA', '[[Category:KGTestMultiCatA]]' );
		$this->insertPage( 'KGTestMultiCatMemberB', '[[Category:KGTestMultiCatB]]' );
		\DeferredUpdates::doUpdates();

		$storeMock = $this->injectStoreMock();
		$this->stubEmptySemanticDataAndPropertySubjects( $storeMock );

		$data = $this->runLoadCategories( [
			'categories' => 'KGTestMultiCatA|KGTestMultiCatB',
		] );

		$this->assertArrayHasKey( 'KGTestMultiCatMemberA', $data );
		$this->assertArrayHasKey( 'KGTestMultiCatMemberB', $data );
	}

	public function testInvalidCategoryInListIsSkippedWithoutAffectingOthers() {
		$this->mockAllPagesResponse( [] );

		$this->insertPage( 'KGTestInvalidCatMember', '[[Category:KGTestValidCat]]' );
		\DeferredUpdates::doUpdates();

		$storeMock = $this->injectStoreMock();
		$this->stubEmptySemanticDataAndPropertySubjects( $storeMock );

		// "<" and ">" are illegal in a MediaWiki title, so Title::makeTitleSafe()
		// returns null for this category and execute() must skip it silently.
		$data = $this->runLoadCategories( [
			'categories' => 'KGTestValidCat|<>',
		] );

		$this->assertArrayHasKey( 'KGTestInvalidCatMember', $data );
		$this->assertCount( 1, $data );
	}

	/**
	 * Regression test: buildPropertiesList() previously referenced an undefined $limit
	 * variable (only $params['limit'] existed) whenever the allpages properties list was
	 * non-empty, which is a fatal `Error: Undefined variable $limit` on PHP 8+.
	 */
	public function testExecuteDoesNotFatalWhenAllPagesReturnsAProperty() {
		$this->mockAllPagesResponse( [ 'Property:KGTestAllPagesProp' ] );

		$this->insertPage( 'KGTestLimitBugMember', '[[Category:KGTestLimitBugCat]]' );
		\DeferredUpdates::doUpdates();

		$storeMock = $this->injectStoreMock();
		$this->stubEmptySemanticDataAndPropertySubjects( $storeMock );

		$data = $this->runLoadCategories( [
			'categories' => 'KGTestLimitBugCat',
		] );

		$this->assertArrayHasKey( 'KGTestLimitBugMember', $data );
	}
}
