<p:declare-step 
	xmlns:p="http://www.w3.org/ns/xproc" 
	xmlns:c="http://www.w3.org/ns/xproc-step" 
	xmlns:z="https://github.com/Conal-Tuohy/XProc-Z"
	xmlns:prov="https://api.prov.vic.gov.au/"
	version="1.0" name="main">


	<p:input port='source' primary='true'/>
	<!-- e.g.
		<request xmlns="http://www.w3.org/ns/xproc-step"
		  method = NCName
		  href? = anyURI
		  detailed? = boolean
		  status-only? = boolean
		  username? = string
		  password? = string
		  auth-method? = string
		  send-authorization? = boolean
		  override-content-type? = string>
			 (c:header*,
			  (c:multipart |
				c:body)?)
		</request>
	-->
	
	<p:input port='parameters' kind='parameter' primary='true'/>
	<p:output port="result" primary="true" sequence="true"/>
	<p:import href="xproc-z-library.xpl"/>

	<p:variable name="relative-uri" select="substring-after(/c:request/@href, '?')"/>
	<!-- requests for IIIF collections will have wt=xslt and a tr parameter; they must be rewritten to wt=xml -->
	<p:variable name="solr-search-uri" select="
		concat(
			'https://api.prov.vic.gov.au/search/select?',
			string-join(
				tokenize($relative-uri, '&amp;')[
					not(
						. = ('wt=xslt', 'tr=solr-to-iiif.xsl')
					)
				],
				'&amp;'
			),
			if (tokenize($relative-uri, '&amp;') = 'wt=xslt') then '&amp;wt=xml' else ()
		)
	"/>
	<p:delete match="c:header"/>
	<p:add-attribute match="/c:request" attribute-name="href">
		<p:with-option name="attribute-value" select="$solr-search-uri"/>
	</p:add-attribute>
	<p:http-request/>
	<p:choose>
		<p:when test="tokenize($relative-uri, '&amp;') = 'wt=xslt' ">
			<p:add-attribute match="/c:response/c:body" attribute-name="content-type" attribute-value='application/json'/>
<!--			<p:add-attribute match="/c:response/c:body" attribute-name="content-type" attribute-value='application/ld+json;profile="http://iiif.io/api/presentation/3/context.json"'/>-->
			<p:viewport match="/c:response/c:body/*">
				<p:xslt>
					<p:with-param name="base-uri" select="$solr-search-uri"/>
					<p:input port="stylesheet">
						<p:documentation>
							The solr-to-iiif.xsl stylesheet is written to produce JSON-LD using the "text" output method,
							however, when hosted in an XProc 1.0 pipeline it must produce a well-formed XML document, 
							so here we have an inline XSLT that includes the solr-to-iiif.xsl stylesheet and creates a "json"
							root element to serve as a container for the JSON text. The root element is subsequently discarded.
						</p:documentation>
						<p:inline>
							<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
								<xsl:import href="/var/www/PROV-Solr-API-Tools/solr/solr-to-iiif.xsl"/>
								<xsl:template match="/">
									<json><xsl:apply-imports/></json>
								</xsl:template>
							</xsl:stylesheet>
						</p:inline>
					</p:input>
				</p:xslt>
			</p:viewport>
			<p:unwrap match="/c:response/c:body/json"/>
		</p:when>
		<!-- NB XProc-Z does not like a character encoding specification in the "content-type" attribute, e.g. 'application/xml; encoding="UTF-8"' -->
		<!-- so we override Solr's content-type with a plain "application/xml" -->
		<!-- TODO patch XProc-Z -->
		<p:when test="tokenize($relative-uri, '&amp;') = 'wt=xml' ">
			<p:viewport match="/c:response/c:body">
				<p:add-attribute match="/c:body" attribute-name="content-type" attribute-value='application/xml'/>
			</p:viewport>
		</p:when>
		<p:otherwise>
			<p:identity/>
		</p:otherwise>
	</p:choose>
	<!-- delete HTTP response headers from upstream because they may no longer apply, especially the "Content-Length" header -->
	<!-- which will not be accurate if the content has been modified -->
	<p:delete match="/c:response/c:header"/>
	<p:insert match="/c:response" position="first-child">
		<p:input port="insertion">
			<p:inline>
				<c:header name="Access-Control-Allow-Origin" value="*"/>
			</p:inline>
		</p:input>
	</p:insert>
</p:declare-step>
