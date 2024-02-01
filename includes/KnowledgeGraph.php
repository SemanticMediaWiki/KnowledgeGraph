<?php

/**
 * KnowledgeGraph
 *
 * @licence GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

class KnowledgeGraph {

	/** @var array */
	public static $graphs = [];

	/**
	 * @param OutputPage $outputPage
	 * @param Skin $skin
	 * @return void
	 */
	public static function onBeforePageDisplay( $out, $skin ) {
		$out->addModules( 'ext.KnowledgeGraph' );
		return true;
	}

	/**
	 * @param Parser $parser
	 */
	public static function onParserFirstCallInit( Parser $parser ) {
		$parser->setFunctionHook( 'knowledgegraph', [ self::class, 'parserFunctionKnowledgeGraph' ] );
	}

	/**
	 * @see https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/PageProperties/+/c997fbd2583ccc088dc232288f883716ca2f5777/includes/PageProperties.php
	 * @param Parser $parser
	 * @param mixed ...$argv
	 * @return array
	 */
	public static function parserFunctionKnowledgeGraph( Parser $parser, ...$argv ) {
		$out = $parser->getOutput();
		$title = $parser->getTitle();

/*
{{#knowledgegraph:
root=TestPage
|properties=HasProperty1,HasProperty2
|permalink=false
|autoexpand=false
|depth=3
}}
*/
		$defaultParameters = [
			'root' => [ '', 'string' ],
			'properties' => [ '', 'array' ],
			'permalink' => [ 'false', 'boolean' ],
			'autoexpand' => [ 'false', 'boolean' ],
			'depth' => [ '3', 'integer' ],
		];

		[ $values, $params ] = self::parseParameters( $argv, array_keys( $defaultParameters ) );

		$params = self::applyDefaultParams( $defaultParameters, $params );

		self::$graphs[] = $params;

		$out->setExtensionData( 'knowledgegraphs', self::$graphs );
		
		return [
			'<div class="KnowledgeGraph" id="knowledgegraph-wrapper-' . key( self::$graphs ) . '">'
				. wfMessage( 'knowledge-graph-wrapper-loading' )->text() . '</div>',
			'noparse' => true,
			'isHTML' => true
		];
	}
	
	/**
	 * @see https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/PageProperties/+/c997fbd2583ccc088dc232288f883716ca2f5777/includes/PageProperties.php
	 * @param OutputPage $out
	 * @param ParserOutput $parserOutput
	 * @return void
	 */
	public static function onOutputPageParserOutput( OutputPage $out, ParserOutput $parserOutput ) {
		$data = $parserOutput->getExtensionData( 'knowledgegraphs' );

		if ( $data !== null ) {
			$out->addJsConfigVars( [
				'knowledgegraphs' => json_encode( $data )
			] );
		}
	}

	/**
	 * @see https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/PageProperties/+/c997fbd2583ccc088dc232288f883716ca2f5777/includes/PageProperties.php
	 * @param array $defaultParams
	 * @param array $params
	 * @return array
	 */
	public static function applyDefaultParams( $defaultParams, $params ) {
		$ret = [];
		foreach ( $defaultParams as $key => $value ) {
			[ $defaultValue, $type ] = $value;
			$val = $defaultValue;
			if ( array_key_exists( $key, $params ) ) {
				$val = $params[$key];
			}

			switch ( $type ) {
				case 'bool':
				case 'boolean':
					$val = filter_var( $val, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE );
					if ( $val === null ) {
						$val = filter_var( $defaultValue, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE );
					}
					settype( $val, "bool" );
					break;

				case 'array':
					$val = array_filter(
						preg_split( '/\s*,\s*/', $val, -1, PREG_SPLIT_NO_EMPTY ) );
					break;

				case 'number':
					$val = filter_var( $val, FILTER_VALIDATE_FLOAT, FILTER_NULL_ON_FAILURE );
					settype( $val, "float" );
					break;

				case 'int':
				case 'integer':
					$val = filter_var( $val, FILTER_VALIDATE_INT, FILTER_NULL_ON_FAILURE );
					settype( $val, "integer" );
					break;

				default:
			}

			$ret[$key] = $val;
		}

		return $ret;
	}

	/**
	 * @see https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/PageProperties/+/c997fbd2583ccc088dc232288f883716ca2f5777/includes/PageProperties.php
	 * @param array $parameters
	 * @param array $defaultParameters
	 * @return array
	 */
	public static function parseParameters( $parameters, $defaultParameters ) {
		$ret = [];
		$options = [];
		foreach ( $parameters as $value ) {
			if ( strpos( $value, '=' ) !== false ) {
				[ $k, $v ] = explode( '=', $value, 2 );
				$k = str_replace( ' ', '-', trim( $k ) );

				if ( in_array( $k, $defaultParameters ) ) {
					$options[$k] = trim( $v );
					continue;
				}
			}
			$ret[] = $value;
		}

		return [ $ret, $options ];
	}

}
