<?php

use PHPUnit\Framework\TestCase;

/**
 * @covers KnowledgeGraph::getSubjectsByProperty
 */
class KnowledgeGraphGetSubjectsByPropertyTest extends TestCase {

	/** @var \SMW\Store|\PHPUnit\Framework\MockObject\MockObject */
	private $storeMock;

	protected function setUp(): void {
		parent::setUp();

		KnowledgeGraph::initSMW();

		$this->storeMock = $this->getMockForAbstractClass( \SMW\Store::class );

		$reflection = new ReflectionClass( KnowledgeGraph::class );
		$property = $reflection->getProperty( 'SMWStore' );
		$property->setAccessible( true );
		$property->setValue( null, $this->storeMock );
	}

	/**
	 * Non-inverse DIProperty objects are the only case exercised by real
	 * callers today (KnowledgeGraphApiLoadCategories, processInverseProperties).
	 * This documents the currently-working path.
	 */
	public function testNonInversePropertyObjectQueriesStoreDirectly() {
		$property = \SMW\DIProperty::newFromUserLabel( 'TestProperty' );

		$this->storeMock->expects( $this->once() )
			->method( 'getPropertySubjects' )
			->with(
				$this->callback( static function ( $arg ) use ( $property ) {
					return $arg instanceof \SMW\DIProperty
						&& $arg->getKey() === $property->getKey();
				} ),
				$this->anything(),
				$this->anything()
			)
			->willReturn( [] );

		$result = KnowledgeGraph::getSubjectsByProperty( $property, 100, 0, null );

		$this->assertSame( [], $result );
	}

	/**
	 * getSubjectsByProperty() previously had a dedicated branch for
	 * $propertyText->isInverse() that called $propertyText->setInverse( true ),
	 * a method that never existed on DIProperty/DataItems\Property in any SMW
	 * version. That branch was unreachable through any current caller (real
	 * callers always pass a non-inverse property) and was removed. An inverse
	 * property object is now handled the same way as any other non-string
	 * property object: queried directly against the store.
	 */
	public function testInversePropertyObjectQueriesStoreDirectly() {
		$inverseProperty = \SMW\DIProperty::newFromUserLabel( 'TestProperty', true );
		$this->assertTrue( $inverseProperty->isInverse() );

		$this->storeMock->expects( $this->once() )
			->method( 'getPropertySubjects' )
			->with(
				$this->callback( static function ( $arg ) use ( $inverseProperty ) {
					return $arg instanceof \SMW\DIProperty
						&& $arg->getKey() === $inverseProperty->getKey();
				} ),
				$this->anything(),
				$this->anything()
			)
			->willReturn( [] );

		$result = KnowledgeGraph::getSubjectsByProperty( $inverseProperty, 100, 0, null );

		$this->assertSame( [], $result );
	}

	/**
	 * getSubjectsByProperty() takes a \SMW\DIProperty (never a bare string) as
	 * its first argument; the only real caller, KnowledgeGraphApiLoadCategories,
	 * always passes a DIProperty together with a string $targetValue (a page
	 * title). A previously dead `is_string( $propertyText )` branch would have
	 * silently discarded $targetValue for a string property; now that the
	 * branch is gone, $targetValue must always be resolved and forwarded to
	 * the store as the second argument to getPropertySubjects().
	 */
	public function testPropertyObjectWithTargetValueResolvesTitleAndQueriesStore() {
		$property = \SMW\DIProperty::newFromUserLabel( 'TestProperty' );

		$this->storeMock->expects( $this->once() )
			->method( 'getPropertySubjects' )
			->with(
				$this->callback( static function ( $arg ) use ( $property ) {
					return $arg instanceof \SMW\DIProperty
						&& $arg->getKey() === $property->getKey();
				} ),
				$this->callback( static function ( $arg ) {
					return $arg instanceof \SMW\DIWikiPage
						&& $arg->getDBkey() === 'Target_Page';
				} ),
				$this->anything()
			)
			->willReturn( [] );

		$result = KnowledgeGraph::getSubjectsByProperty( $property, 100, 0, 'Target Page' );

		$this->assertSame( [], $result );
	}
}
