<?php

use PHPUnit\Framework\TestCase;

/**
 * Regression test for the property-type lookup used by
 * KnowledgeGraph::setSemanticDataFromApi() and
 * KnowledgeGraphApiLoadCategories::execute().
 *
 * Both call sites resolve a property's type via \SMW\DIProperty. SMW 7.0.0
 * removed the deprecated DIProperty::findPropertyTypeID() (see SMW #6852);
 * only findPropertyValueType() remains. This test exercises that lookup
 * directly against a real DIProperty instance so a future re-introduction
 * of the removed method would be caught here instead of fataling in
 * production.
 *
 * @covers KnowledgeGraph::setSemanticDataFromApi
 * @covers KnowledgeGraphApiLoadCategories::execute
 */
class KnowledgeGraphPropertyTypeLookupTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		KnowledgeGraph::initSMW();
	}

	public function testFindPropertyValueTypeReturnsTypeIdForUserProperty() {
		$property = \SMW\DIProperty::newFromUserLabel( 'TestProperty' );

		$typeId = $property->findPropertyValueType();

		$this->assertIsString( $typeId );
		$this->assertNotSame( '', $typeId );
	}

	public function testFindPropertyValueTypeReturnsTypeIdForInverseProperty() {
		$property = \SMW\DIProperty::newFromUserLabel( 'TestProperty', true );

		$typeId = $property->findPropertyValueType();

		$this->assertIsString( $typeId );
		$this->assertNotSame( '', $typeId );
	}

	public function testFindPropertyTypeIDNoLongerExistsOnDIProperty() {
		$property = \SMW\DIProperty::newFromUserLabel( 'TestProperty' );

		$this->assertFalse(
			method_exists( $property, 'findPropertyTypeID' ),
			'DIProperty::findPropertyTypeID() was removed in SMW 7.0 (SMW #6852); ' .
			'callers must use findPropertyValueType() instead.'
		);
	}
}
