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
    // PhanUndeclaredClassMethod : 20+ occurrences
    // PhanUndeclaredTypeProperty : 7 occurrences
    // PhanTypeMismatchReturnProbablyReal : 5 occurrences
    // PhanUndeclaredStaticProperty : 3 occurrences
    // SecurityCheck-XSS : 2 occurrences
    // MediaWikiNoIssetIfDefined : 1 occurrence
    // PhanTypeArraySuspiciousNullable : 1 occurrence
    // PhanTypeMismatchArgumentProbablyReal : 1 occurrence
    // PhanTypeMissingReturn : 1 occurrence
    // PhanUndeclaredClassProperty : 1 occurrence
    // PhanUndeclaredConstant : 1 occurrence
    // PhanUndeclaredStaticMethod : 1 occurrence
    // PhanUndeclaredVariable : 1 occurrence

    'file_suppressions' => [
        'includes/KnowledgeGraph.php' => [
            'MediaWikiNoIssetIfDefined' => ['\\KnowledgeGraph::getAllPropertiesForNode'],
            'PhanTypeMismatchReturnProbablyReal' => ['\\KnowledgeGraph::onBeforePageDisplay', '\\KnowledgeGraph::setSemanticDataFromApi'],
            'PhanTypeMissingReturn' => ['\\KnowledgeGraph::setSemanticDataFromApi'],
            'PhanUndeclaredClassMethod' => ['\\KnowledgeGraph::getSubjectsByProperty', '\\KnowledgeGraph::initSMW', '\\KnowledgeGraph::setSemanticDataFromApi'],
            'PhanUndeclaredClassProperty' => ['\\KnowledgeGraph::getSubjectsByProperty'],
            'PhanUndeclaredConstant' => ['\\KnowledgeGraph::parserFunctionKnowledgeGraph'],
            'PhanUndeclaredStaticMethod' => ['\\KnowledgeGraph::getWikiPage'],
            'PhanUndeclaredTypeProperty' => ['\\KnowledgeGraph'],
            'SecurityCheck-XSS' => ['\\KnowledgeGraph::parserFunctionKnowledgeGraph']
        ],
        'includes/api/KnowledgeGraphApiLoadCategories.php' => [
            'PhanTypeArraySuspiciousNullable' => ['\\KnowledgeGraphApiLoadCategories::execute'],
            'PhanTypeMismatchArgumentProbablyReal' => ['\\KnowledgeGraphApiLoadCategories::execute'],
            'PhanUndeclaredClassMethod' => ['\\KnowledgeGraphApiLoadCategories::execute'],
            'PhanUndeclaredStaticProperty' => ['\\KnowledgeGraphApiLoadCategories::execute'],
            'PhanUndeclaredTypeProperty' => ['\\KnowledgeGraphApiLoadCategories'],
            'PhanUndeclaredVariable' => ['\\KnowledgeGraphApiLoadCategories::execute']
        ],
        'includes/api/KnowledgeGraphApiLoadNodes.php' => [
            'PhanUndeclaredClassMethod' => ['\\KnowledgeGraphApiLoadNodes::execute'],
            'PhanUndeclaredStaticProperty' => ['\\KnowledgeGraphApiLoadNodes::execute'],
            'PhanUndeclaredTypeProperty' => ['\\KnowledgeGraphApiLoadNodes']
        ],
        'includes/api/KnowledgeGraphApiLoadProperties.php' => [
            'PhanUndeclaredStaticProperty' => ['\\KnowledgeGraphApiLoadProperties::execute']
        ],
        'includes/specials/SpecialKnowledgeGraphDesigner.php' => [
            'SecurityCheck-XSS' => ['\\SpecialKnowledgeGraphDesigner::execute']
        ],
    ],
    // 'directory_suppressions' => ['src/directory_name' => ['PhanIssueName1', 'PhanIssueName2']] can be manually added if needed.
    // (directory_suppressions will currently be ignored by subsequent calls to --save-baseline, but may be preserved in future Phan releases)
];
