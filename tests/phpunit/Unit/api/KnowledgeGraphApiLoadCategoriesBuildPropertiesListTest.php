<?php

use MediaWiki\Title\Title;

/**
 * buildPropertiesList() is a private method extracted from execute() specifically so the
 * self::$exclude / isUserAnnotable() / isVisible() filtering and inverse-property generation
 * can be tested directly, without needing to observe them indirectly through
 * KnowledgeGraph::setSemanticDataFromApi() (a static call execute() cannot be intercepted
 * around) or a real ApiMain/HTTP round trip.
 *
 * @covers KnowledgeGraphApiLoadCategories::buildPropertiesList
 * @group Database
 */
class KnowledgeGraphApiLoadCategoriesBuildPropertiesListTest extends MediaWikiIntegrationTestCase {

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

	private function injectStoreMock(): \PHPUnit\Framework\MockObject\MockObject {
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
	 * Builds an empty SemanticData container for $title via a real store lookup rather than
	 * `new \SMW\DataModel\SemanticData(...)`: that class only exists under that namespace/path
	 * since SMW 7.x — SMW 6.0.1 (also in the CI matrix) has it at `SMW\SemanticData` instead.
	 * Must be called before injectStoreMock() replaces the real store.
	 *
	 * @param Title $title
	 * @return \SMW\SemanticData|\SMW\DataModel\SemanticData
	 */
	private function newEmptySemanticData( Title $title ) {
		$subject = new \SMW\DIWikiPage( $title->getDbKey(), $title->getNamespace() );
		return \SMW\StoreFactory::getStore()->getSemanticData( $subject );
	}

	/**
	 * @param mixed[] $args [ $propertyNames, $title_, $titleText, $properties, $limit ]
	 * @return array
	 */
	private function invokeBuildPropertiesList( array $args ): array {
		$instance = new KnowledgeGraphApiLoadCategories( new ApiMain(), '' );
		$reflection = new ReflectionClass( KnowledgeGraphApiLoadCategories::class );

		$method = $reflection->getMethod( 'buildPropertiesList' );
		$method->setAccessible( true );

		return $method->invokeArgs( $instance, $args );
	}

	public function testPredefinedExcludedPropertyIsFiltered() {
		$title = Title::makeTitle( NS_MAIN, 'KGTestExcludeMember' );
		$semanticData = $this->newEmptySemanticData( $title );

		$storeMock = $this->injectStoreMock();

		// "_ASK" is one of the predefined properties in self::$exclude.
		$semanticData->addPropertyObjectValue(
			new \SMW\DIProperty( '_ASK' ),
			new \SMW\DIWikiPage( 'KGTestExcludeTarget', NS_MAIN )
		);

		$storeMock->method( 'getSemanticData' )->willReturn( $semanticData );
		$storeMock->method( 'getPropertySubjects' )->willReturn( [] );

		$result = $this->invokeBuildPropertiesList( [ [], $title, 'KGTestExcludeMember', [], 10 ] );

		$this->assertSame( [], $result );
	}

	public function testUserDefinedVisiblePropertyIsKeptWithInverseGenerated() {
		$title = Title::makeTitle( NS_MAIN, 'KGTestVisibleMember' );
		$semanticData = $this->newEmptySemanticData( $title );

		$storeMock = $this->injectStoreMock();

		$semanticData->addPropertyObjectValue(
			\SMW\DIProperty::newFromUserLabel( 'KGTestVisibleProp' ),
			new \SMW\DIWikiPage( 'KGTestVisibleTarget', NS_MAIN )
		);

		$storeMock->method( 'getSemanticData' )->willReturn( $semanticData );
		$storeMock->method( 'getPropertySubjects' )->willReturn( [] );

		$result = $this->invokeBuildPropertiesList( [ [], $title, 'KGTestVisibleMember', [], 10 ] );

		$this->assertSame( [ 'KGTestVisibleProp', '-KGTestVisibleProp' ], $result );
	}

	public function testNonAnnotablePropertyIsFiltered() {
		$title = Title::makeTitle( NS_MAIN, 'KGTestNonAnnotableMember' );
		$semanticData = $this->newEmptySemanticData( $title );

		$storeMock = $this->injectStoreMock();

		$nonAnnotable = $this->getMockBuilder( \SMW\DIProperty::class )
			->setConstructorArgs( [ 'KGTestNonAnnotableProp' ] )
			->onlyMethods( [ 'isUserAnnotable' ] )
			->getMock();
		$nonAnnotable->method( 'isUserAnnotable' )->willReturn( false );
		$semanticData->addPropertyObjectValue(
			$nonAnnotable,
			new \SMW\DIWikiPage( 'KGTestNonAnnotableTarget', NS_MAIN )
		);

		$storeMock->method( 'getSemanticData' )->willReturn( $semanticData );
		$storeMock->method( 'getPropertySubjects' )->willReturn( [] );

		$result = $this->invokeBuildPropertiesList( [ [], $title, 'KGTestNonAnnotableMember', [], 10 ] );

		$this->assertSame( [], $result );
	}

	public function testPreExistingPropertiesListIsPreservedAndDeduplicated() {
		$title = Title::makeTitle( NS_MAIN, 'KGTestPreexistingMember' );
		$semanticData = $this->newEmptySemanticData( $title );

		$storeMock = $this->injectStoreMock();

		$semanticData->addPropertyObjectValue(
			\SMW\DIProperty::newFromUserLabel( 'KGTestDupProp' ),
			new \SMW\DIWikiPage( 'KGTestDupTarget', NS_MAIN )
		);

		$storeMock->method( 'getSemanticData' )->willReturn( $semanticData );
		$storeMock->method( 'getPropertySubjects' )->willReturn( [] );

		$result = $this->invokeBuildPropertiesList(
			[ [], $title, 'KGTestPreexistingMember', [ 'KGTestDupProp', 'KGTestKept' ], 10 ]
		);

		sort( $result );
		$this->assertSame(
			[ '-KGTestDupProp', '-KGTestKept', 'KGTestDupProp', 'KGTestKept' ],
			$result
		);
	}

	/**
	 * When a category member is a subject of one of the properties discovered via the
	 * "allpages" property list (execute()'s $propertyNames), buildPropertiesList() must add
	 * that property's name (plus its inverse) to the result. getPropertySubjects() itself is
	 * SMW's own store API, already covered by KnowledgeGraphGetSubjectsByPropertyTest; this
	 * test only asserts buildPropertiesList()'s own reaction to a non-empty result.
	 */
	public function testPropertyNameIsAddedWhenMemberIsASubjectOfIt() {
		// getSubjectsByProperty() only keeps titles that pass isKnown(), so the returned
		// subject must be a real, saved page. Must be inserted (and its deferred updates
		// flushed) before the store mock is injected: SMW's own LinksUpdateComplete hook
		// runs on page save and needs the real store.
		[ 'title' => $subjectTitle ] = $this->insertPage( 'KGTestSubjectTarget' );
		\DeferredUpdates::doUpdates();

		$title = Title::makeTitle( NS_MAIN, 'KGTestSubjectMember' );
		$semanticData = $this->newEmptySemanticData( $title );

		$storeMock = $this->injectStoreMock();

		$storeMock->method( 'getSemanticData' )->willReturn( $semanticData );
		$storeMock->method( 'getPropertySubjects' )->willReturn( [
			\SMW\DIWikiPage::newFromTitle( $subjectTitle ),
		] );

		$result = $this->invokeBuildPropertiesList(
			[ [ 'KGTestSubjectProp' ], $title, 'KGTestSubjectMember', [], 10 ]
		);

		$this->assertSame( [ 'KGTestSubjectProp', '-KGTestSubjectProp' ], $result );
	}
}
