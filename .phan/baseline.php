<?php
/**
 * This is an automatically generated baseline for Phan issues.
 * When Phan is invoked with --load-baseline=path/to/baseline.php,
 * The pre-existing issues listed in this file won't be emitted.
 *
 * This file can be updated by invoking Phan with --save-baseline=path/to/baseline.php
 * (can be combined with --load-baseline)
 */
return [
	// # Issue statistics:
	// PhanTypeMismatchReturnProbablyReal : 5 occurrences
	// PhanUndeclaredStaticProperty : 3 occurrences
	// PhanTypeMismatchArgument : 2 occurrences
	// PhanTypeMismatchArgumentProbablyReal : 2 occurrences
	// MediaWikiNoIssetIfDefined : 1 occurrence
	// PhanTypeArraySuspiciousNullable : 1 occurrence
	// PhanTypeMissingReturn : 1 occurrence
	// PhanUndeclaredMethod : 1 occurrence
	// PhanUndeclaredStaticMethod : 1 occurrence
	// PhanUndeclaredTypeProperty : 1 occurrence
	// PhanUndeclaredVariable : 1 occurrence

	'file_suppressions' => [
		'includes/KnowledgeGraph.php' => [
			'MediaWikiNoIssetIfDefined' => ['\\KnowledgeGraph::getAllPropertiesForNode'],
			'PhanTypeMismatchArgument' => ['\\KnowledgeGraph::getSubjectsByProperty'],
			'PhanTypeMismatchReturnProbablyReal' => ['\\KnowledgeGraph::onBeforePageDisplay', '\\KnowledgeGraph::setSemanticDataFromApi'],
			'PhanTypeMissingReturn' => ['\\KnowledgeGraph::setSemanticDataFromApi'],
			'PhanUndeclaredStaticMethod' => ['\\KnowledgeGraph::getWikiPage'],
			'PhanUndeclaredTypeProperty' => ['\\KnowledgeGraph']
		],
		'includes/api/KnowledgeGraphApiLoadCategories.php' => [
			'PhanTypeArraySuspiciousNullable' => ['\\KnowledgeGraphApiLoadCategories::execute'],
			'PhanTypeMismatchArgumentProbablyReal' => ['\\KnowledgeGraphApiLoadCategories::execute'],
			'PhanUndeclaredMethod' => ['\\KnowledgeGraphApiLoadCategories::execute'],
			'PhanUndeclaredStaticProperty' => ['\\KnowledgeGraphApiLoadCategories::execute'],
			'PhanUndeclaredVariable' => ['\\KnowledgeGraphApiLoadCategories::execute']
		],
		'includes/api/KnowledgeGraphApiLoadNodes.php' => [
			'PhanUndeclaredStaticProperty' => ['\\KnowledgeGraphApiLoadNodes::execute']
		],
		'includes/api/KnowledgeGraphApiLoadProperties.php' => [
			'PhanUndeclaredStaticProperty' => ['\\KnowledgeGraphApiLoadProperties::execute']
		],
	],
	// 'directory_suppressions' => ['src/directory_name' => ['PhanIssueName1', 'PhanIssueName2']] can be manually added if needed.
	// (directory_suppressions will currently be ignored by subsequent calls to --save-baseline, but may be preserved in future Phan releases)
];
