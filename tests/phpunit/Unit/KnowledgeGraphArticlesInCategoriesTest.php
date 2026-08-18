<?php

use MediaWiki\Title\Title;

/**
 * articlesInCategories() queries `categorylinks` (joined with `linktarget`
 * on MW >= 1.45, plain `cl_to` comparison on older versions) via a real
 * replica DB connection, which is not meaningfully mockable; these tests
 * extend MediaWikiIntegrationTestCase and use real category-tagged fixture
 * pages. Both code paths are covered by the CI matrix (MW 1.43 exercises
 * the pre-1.45 branch, MW 1.46 the joined branch); a single local run only
 * exercises whichever branch matches its own MW_VERSION.
 *
 * @covers KnowledgeGraph::articlesInCategories
 * @group Database
 */
class KnowledgeGraphArticlesInCategoriesTest extends MediaWikiIntegrationTestCase {

	public function testArticlesInKnownCategoryAreReturnedAsTitles() {
		$category = 'KGArticlesCatKnown';
		$page = 'KGArticlesCatKnownPage1';
		$this->insertPage( $page, '[[Category:' . $category . ']]' );

		$result = KnowledgeGraph::articlesInCategories( $category, 10, 0 );

		$this->assertCount( 1, $result );
		$this->assertInstanceOf( Title::class, $result[0] );
		$this->assertSame( $page, $result[0]->getText() );
	}

	public function testEmptyCategoryReturnsEmptyArray() {
		$result = KnowledgeGraph::articlesInCategories( 'KGArticlesCatEmpty', 10, 0 );

		$this->assertSame( [], $result );
	}

	public function testCategoryNameWithSpacesIsNormalizedToUnderscores() {
		$category = 'KGArticlesCatWithSpaces';
		$page = 'KGArticlesCatSpacesPage1';
		// Stored/looked-up category name uses underscores; the wikitext link
		// and the lookup argument both use spaces to exercise the
		// str_replace( ' ', '_', $category ) normalization.
		$this->insertPage( $page, '[[Category:KGArticlesCat WithSpaces]]' );

		$result = KnowledgeGraph::articlesInCategories( 'KGArticlesCat WithSpaces', 10, 0 );

		$this->assertCount( 1, $result );
		$this->assertSame( $page, $result[0]->getText() );
	}

	public function testLimitRestrictsNumberOfResults() {
		$category = 'KGArticlesCatLimit';
		$this->insertPage( 'KGArticlesCatLimitPage1', '[[Category:' . $category . ']]' );
		$this->insertPage( 'KGArticlesCatLimitPage2', '[[Category:' . $category . ']]' );
		$this->insertPage( 'KGArticlesCatLimitPage3', '[[Category:' . $category . ']]' );

		$result = KnowledgeGraph::articlesInCategories( $category, 2, 0 );

		$this->assertCount( 2, $result );
	}

	public function testOffsetSkipsAlreadyReturnedResults() {
		$category = 'KGArticlesCatOffset';
		$this->insertPage( 'KGArticlesCatOffsetPage1', '[[Category:' . $category . ']]' );
		$this->insertPage( 'KGArticlesCatOffsetPage2', '[[Category:' . $category . ']]' );
		$this->insertPage( 'KGArticlesCatOffsetPage3', '[[Category:' . $category . ']]' );

		$firstPage = KnowledgeGraph::articlesInCategories( $category, 1, 0 );
		$secondPage = KnowledgeGraph::articlesInCategories( $category, 1, 1 );

		$this->assertCount( 1, $firstPage );
		$this->assertCount( 1, $secondPage );
		$this->assertNotSame(
			$firstPage[0]->getPrefixedText(),
			$secondPage[0]->getPrefixedText()
		);
	}

	public function testOffsetBeyondResultCountReturnsEmptyArray() {
		$category = 'KGArticlesCatOffsetBeyond';
		$this->insertPage( 'KGArticlesCatOffsetBeyondPage1', '[[Category:' . $category . ']]' );

		$result = KnowledgeGraph::articlesInCategories( $category, 10, 5 );

		$this->assertSame( [], $result );
	}

	/**
	 * Not covered here: articlesInCategories() calls
	 * Title::newFromID( $row->pageid ) for every categorylinks row and
	 * silently skips the entry when it returns null (a categorylinks row
	 * whose target page was deleted without the categorylinks row being
	 * cleaned up). Reproducing a stale categorylinks row requires bypassing
	 * MediaWiki's normal page-deletion path (which does clean up
	 * categorylinks), so this defensive branch is left as a documented gap
	 * rather than forced via a direct DB write.
	 */
}
