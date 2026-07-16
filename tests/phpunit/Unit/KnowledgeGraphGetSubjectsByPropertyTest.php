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
	 * KnowledgeGraph::getSubjectsByProperty() has a dedicated branch for
	 * $propertyText->isInverse() that calls $propertyText->setInverse( true )
	 * on a plain SMW DIProperty/Property object. That method does not exist
	 * on \SMW\DataItems\Property (nor did it ever exist on the pre-7.0
	 * \SMW\DIProperty alias) — the only place this class supports inverse
	 * properties is the constructor / newFromUserLabel( $label, $inverse ).
	 *
	 * This branch is unreachable through any current caller (real callers
	 * always pass $inverse = false), so this test documents that invoking
	 * it is a fatal error rather than silently asserting broken behaviour
	 * as correct.
	 */
	public function testInversePropertyObjectTriggersUndefinedMethodError() {
		$inverseProperty = \SMW\DIProperty::newFromUserLabel( 'TestProperty', true );

		$this->assertTrue( $inverseProperty->isInverse() );

		$this->expectException( \Error::class );
		$this->expectExceptionMessageMatches( '/setInverse/' );

		KnowledgeGraph::getSubjectsByProperty( $inverseProperty, 100, 0, null );
	}
}
