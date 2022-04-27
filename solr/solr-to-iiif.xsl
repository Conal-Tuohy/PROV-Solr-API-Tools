<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

	<xsl:output method="text" media-type='text/plain"'/>
<!--
	<xsl:output method="text" media-type='application/ld+json;profile="http://iiif.io/api/presentation/3/context.json"'/>
-->

	<xsl:param name="base-uri" select=" 'https://api.prov.vic.gov.au/search/select?wt=xslt&amp;tr=solr-to-iiif.xsl' "/>
	<xsl:variable name="collection-id"><!-- compute the URI of the current page; this is the IIIF "id" of the Collection document -->
		<xsl:value-of select="$base-uri"/>
		<xsl:for-each select="/response/lst[@name='responseHeader']/lst[@name='params']/*[not(@name='wt')]">
			<xsl:value-of select="concat('&amp;', @name, '=', .)"/>
		</xsl:for-each>
	</xsl:variable>
	<xsl:template match="/response">
		<xsl:text>{
	"@context": "http://iiif.io/api/presentation/3/context.json",
	"id": "</xsl:text>
	<xsl:call-template name="json-string"><xsl:with-param name="string" select="$collection-id"/></xsl:call-template>
	<xsl:text>",
	"type": "Collection",
	"label": { "en": [ "Search Results" ] },
	"requiredStatement": {
		"label": { "en": [ "Attribution" ] },
		"value": { "en": [ "Public Record Office Victoria" ] }
	},
	"items": [</xsl:text>
  <xsl:for-each select="result/doc[str[@name='iiif-manifest']]"><!-- only "doc" (search result documents) elements which have a "iiif-manifest" field can appear in the collection -->
  	<xsl:if test="position() &gt; 1">, </xsl:if><xsl:text>
		{
			"id": "</xsl:text><xsl:value-of select="str[@name='iiif-manifest']"/><xsl:text>",
			"type": "Manifest",
			"label": { "en": [ "</xsl:text><xsl:call-template name="json-string"><xsl:with-param name="string" select="str[@name='title']"/></xsl:call-template><xsl:text>" ] },
			"summary": { "en": [ "</xsl:text><xsl:call-template name="json-string"><xsl:with-param name="string" select="str[@name='presentation_text']"/></xsl:call-template><xsl:text>" ] },
			"homepage": [
				{
					"id": "https://prov.vic.gov.au/archive/</xsl:text><xsl:value-of select="str[@name='identifier.PID.id']"/><xsl:text>",
					"type": "Text",
					"label": { "en": [ "catalogue page" ] },
					"format": "text/html"
				}
			],
			"metadata": {
</xsl:text>
				<!-- generate "metadata" properties from the fields listed -->
				<xsl:apply-templates mode="metadata" select="*[@name='jurisdictional_coverage']"/>
				<xsl:apply-templates mode="metadata" select="*[@name='location']"/>
				<xsl:apply-templates mode="metadata" select="*[@name='start_dt']"/>
				<xsl:apply-templates mode="metadata" select="*[@name='end_dt']"/>
				<xsl:text>
				"Series": { "en": [</xsl:text>
						<!-- TODO check: can a record really be part of multiple series? this is implied by the multi-valued nature of the is_part_of_series field -->
						<!-- find a record which belongs to multiple series, and check that this code works -->
						<xsl:call-template name="render-series-list">
							<xsl:with-param name="series-numbers" select="arr[@name='is_part_of_series.id']/str"/>
							<xsl:with-param name="series-titles" select="arr[@name='is_part_of_series.title']/str"/>
						</xsl:call-template>
<xsl:text>
				] }
			},
			"thumbnail": [
				{
					"id": "</xsl:text><xsl:value-of select="str[@name='iiif-thumbnail']"/><xsl:text>",
					"type": "Image",
					"format": "image/jpeg",
					"service": {
						"@context": "http://iiif.io/api/image/2/context.json",
						"@id": "</xsl:text><xsl:value-of select="substring-before(str[@name='iiif-thumbnail'], '/full/!200,200/0/default.jpg')"/><xsl:text>",
						"profile": "http://iiif.io/api/image/2/level2.json"
					}
				}
			]
		}</xsl:text>
	</xsl:for-each>
<xsl:text>
	]
}
</xsl:text>
	</xsl:template>
	<!-- TODO test this template -->
	<xsl:template name="json-string">
		<xsl:param name="string"/>
		<xsl:call-template name="escape">
			<xsl:with-param name="string">
				<xsl:call-template name="escape">
					<xsl:with-param name="string" select="normalize-space($string)"/>
					<xsl:with-param name="char" select=" '\' "/>
				</xsl:call-template>
			</xsl:with-param>
			<xsl:with-param name="char" select=" '&quot;' "/>
		</xsl:call-template>
	</xsl:template>

	<xsl:template name="render-series-list">
		<xsl:param name="series-numbers"/>
		<xsl:param name="series-titles"/>
		<xsl:text>
					"</xsl:text><xsl:call-template name="json-string">
			<xsl:with-param name="string" select="$series-titles[1]"/>
		</xsl:call-template> (<xsl:call-template name="json-string">
			<xsl:with-param name= "string" select="$series-numbers[1]"/>
		</xsl:call-template><xsl:text>)"</xsl:text>
		<xsl:if test="$series-numbers[2]">
			<xsl:text>, </xsl:text>
			<xsl:call-template name="render-series-list">
				<xsl:with-param name="series-numbers" select="series-numbers[position() &gt; 1]"/>
				<xsl:with-param name="series-titles" select="series-titles[position() &gt; 1]"/>
			</xsl:call-template>
		</xsl:if>
	</xsl:template>
	<!-- render a string as a JSON string, by normalizing white space and escaping quotes and backslashes -->
	<xsl:template name="escape">
		<xsl:param name="string"/>
		<xsl:param name="char"/>
		<xsl:choose>
			<xsl:when test="contains($string, $char)">
				<xsl:value-of select="concat(substring-before($string, $char), '\', $char)"/>
				<xsl:call-template name="escape">
					<xsl:with-param name="string" select="substring-after($string, $char)"/>
					<xsl:with-param name="char" select="$char"/>
				</xsl:call-template>
			</xsl:when>
			<xsl:otherwise>
				<xsl:value-of select="$string"/>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<!-- render a solr field as an entry in the IIIF "metadata" object -->
	<xsl:template match="doc/*[@name]" mode="metadata">
		<xsl:text>				"</xsl:text><xsl:apply-templates select="." mode="metadata-label"/><xsl:text>": { "en": [</xsl:text>
		<xsl:for-each select="descendant-or-self::*[not(*)]"><!-- leaf elements of this field are individual values -->
			<xsl:if test="position() &gt; 1">
				<xsl:text>, </xsl:text>
			</xsl:if>
			<xsl:text>"</xsl:text><xsl:call-template name="json-string">
				<xsl:with-param name="string">
					<xsl:apply-templates mode="metadata-value" select="."/>
				</xsl:with-param>
			</xsl:call-template><xsl:text>"</xsl:text>
		</xsl:for-each>
		<xsl:text>] } ,
</xsl:text>
	</xsl:template>
	<!-- labels for Solr fields where they should appear as entries in the IIIF "metadata" object -->
	
	<!-- by default, capitalise the initial letter of the first word, and replace all underscores with space  -->
	<xsl:template mode="metadata-label" match="*">
		<xsl:value-of select="
			concat(
				translate(
					substring(@name, 1, 1),
					'abcdefghijklmnopqrstuvwxyz', 
					'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
				),
				translate(
					substring(@name, 2),
					'_',
					' '
				)
			)
		"/>
	</xsl:template>
	<xsl:template mode="metadata-label" match="*[@name='start_dt']">Start date</xsl:template>
	<xsl:template mode="metadata-label" match="*[@name='end_dt']">End date</xsl:template>
	<!-- by default, Solr field values are expressed as a metadata property value without any change -->
	<!-- for dates, trim off the time component -->
	<xsl:template mode="metadata-value" match="*[@name='start_dt' or @name='end_dt'][contains(., 'T')]">
		<xsl:value-of select="substring-before(., 'T')"/>
	</xsl:template>
	
</xsl:stylesheet>