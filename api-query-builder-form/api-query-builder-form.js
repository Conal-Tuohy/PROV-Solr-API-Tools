// api-query-builder-form.js

/* 
	This library contains controller functions to support HTML form-based access to PROV's public Solr API.
	
	The function submitQueryBuilderForm will encode the contents of a form as a Solr query URI and submit it.
	
	To use, create a form populated with controls whose names match the names of fields in the Solr schema, and
	connect the form by calling the connectQueryBuilderForm function:

		initializeQueryBuilderForm(document.getElementById('my-query-builder-form'));
	
*/


// attach controller functions to an HTML5 form so that it can deal with a Solr back end 
function initializeQueryBuilderForm(form) {
	// load facet values into the form as HTML <option> elements
	const facetFields = Array
		.from(form.elements) // all the elements making up the query builder form
		.map(
			function(x) {
				console.log("form element", x);
				return x;
			}
		).filter(
			element => element.classList.contains("metadata")
		).filter(
			// does this element need to be populated with options?
			// A SELECT or DATALIST element should be populated with OPTION
			// elements; if it has no such children, then we need to load them from Solr
			function (element) {
				if (element.list != null) {
					// an empty DATALIST element needs to be populated
					return element.list.childElementCount === 0;
				} else {
					// an empty SELECT element needs to be populated
					return element.localName.toUpperCase() === 'SELECT' && element.childElementCount === 0;
				}
			}
		).map(
			function(element) {
				console.log("metadata element", element);
				console.log("element.type", getElementType(element));
				console.log("empty select?", (getElementType(element) === "SELECT") && (element.childElementCount() === 0));
				console.log("has list?", element.list != null);
				return element;
			}
		);
	console.log("facet fields", facetFields); 
	if (facetFields.length > 0) {
		// some of the fields are marked as needing to have facet values loaded from Solr
		const baseQueryUrl = 
			getQueryBaseUrl(form) + 
			"?q=" + 
			encodeQueryMetadataParameters(
				Array.from(form.elements)
					.filter(
						function(element) {
							console.log("element type", element.type);
							return element => (element.type == "hidden")
						}
					)
			);
		const facetRetrievalQueryUrl = 
			baseQueryUrl + "&wt=json&rows=0&facet=true&facet.mincount=1" + 
			facetFields.map(
				element => "&facet.field=" + element.name
			).reduce(
				function(queryUrl, parameter) {
					return queryUrl + parameter
				}
			);
		console.log(facetRetrievalQueryUrl);
		var request = new XMLHttpRequest();
		request.responseType = "json";
		request.open("GET", facetRetrievalQueryUrl);
		request.onload = function(e) {
			var response = request.response;
			setFacetValues(form, response);
		}
		request.send();
	}
	// set the max attribute of all date fields to today's date
	const today = new Date().toISOString().split("T")[0];
	Array
		.from(form.elements) // all the elements making up the query builder form
		.filter(element => element.name.length > 0) // only elements with a name attribute (because each HTML input relates to the Solr field by sharing the same name)
		.filter(element => element.type.toUpperCase() === 'DATE') //
		.forEach(dateField => dateField.setAttribute("max", today));
	// handle the submission event by encoding the form's values as a Solr query URL
	form.addEventListener('submit', handleSubmitEvent);
	
	// The wt ("writer type) parameter to Solr queries selects a "writer" component to render the result document in some particular format.
	// For particular values of the wt parameter, there are other parameters defined which are specific to that Writer. To deal with this, we
	// listen to the changing value of the field named "wt" and enable and disable those dependent controls appropriately.
	Array
		.from(form.elements)
		.filter(element => element.name === "wt")
		.forEach(wt => wt.addEventListener("change", handleWriterChangedEvent));
}

function handleWriterChangedEvent(changeEvent) {
	const wt = event.target.value;
	const form = event.target.form;
	console.log("writer parameter changed to", wt);
	const controls = Array
		.from(form.elements)
		.filter(element => element.name != undefined)
		.filter(element => element.classList.contains("control")); // only if the element has been tagged as a "control" (rather than "metadata") parameter
	controls
		.filter(element => element.name === 'tr') // tr parameter only used when wt=xslt
		.forEach(tr => tr.disabled = (wt != 'xslt'));
	controls
		.filter(element => element.name.startsWith('csv.')) // csv.* parameters only used when wt=csv
		.forEach(tr => tr.disabled = (wt != 'csv'));
};

function handleSubmitEvent(submitEvent) {
	// encode the form fields into a URL, and fire a "urlChanged" event
	const form = submitEvent.target;
	
	// the browser should not attempt to submit the form
	submitEvent.preventDefault();
	
	const url = getQueryBaseUrl(form) + '?' + encodeQueryControlParameters(form) + '&q=' + encodeQueryMetadataParameters(form)
	
	// fire the "urlChanged" event
	const urlChangedEvent = new CustomEvent(
		"urlChanged", 
		{
			detail: {
				"url":  url,
				"submitter":  submitEvent.submitter,
				"downloadFilename": getDownloadFilename(form)
			},
			bubbles: true,
			cancelable: true,
			composed: false,
		}
	);
	
	form.dispatchEvent(urlChangedEvent);
}

function getQueryBaseUrl(form) {
	const formAction = form.attributes.getNamedItem("action").value; // TODO validate that parameter exists
	// resolve the URL against the document's base URI
	return new URL(formAction, document.baseURI).href;	
}

function encodeQueryMetadataParameters(elements) {
	// TODO handle date queries
	return Array
		.from(elements) // all the elements making up the query builder form
		.filter(element => element.name.length > 0) // only elements with a name attribute (because each HTML input relates to the Solr field by sharing the same name)
		.filter(element => element.value.length > 0) // only if a value is specified
		.filter(element => element.classList.contains("metadata"))  // only if the element has been tagged as a "metadata" (rather than "control") parameter
		.map(encodeMetadataElement)
		.join(encodeURIComponent(" AND ")); // use "AND" to join the fields so that all the search conditions must match
 }

function encodeQueryControlParameters(elements) {
	// gets the Solr query parameters encoded in the form
	// NB these exclude the actual Solr metadata fields;
	// and include the output format, the number of rows, the starting row, etc.
	// read the contents of the form and assemble a query URL
	return Array
		.from(elements) // all the elements making up the query builder form
		.filter(element => !element.disabled) // exclude disabled elements
		.filter(element => element.name.length > 0) // only elements with a name attribute (because each HTML input relates to the Solr field by sharing the same name)
		.filter(element => element.value.length > 0) // only if a value is specified
		.filter(element => element.classList.contains("control")) // only if the element has been tagged as a "control" (rather than "metadata") parameter
		.map(element => encodeURIComponent(element.name) + "=" + encodeURIComponent(element.value))
		.join('&')
}

function getDownloadFilename(form) {
	// return a filename that can be used to download the query results
	var solrResultWriterType; // controls the output format
	var baseFilename;
	var extension;
	
	// compute a base filename
	try {
		textFieldValue = form.elements["text"].value;
		baseFilename = (textFieldValue.length > 1) ? textFieldValue : "query-results";
	} catch (exception) {
		baseFilename = "query-results";
	}
	// compute the extension
	try {
		solrResultWriterType = form.elements["wt"].value;
	} catch (exception) {
		solrResultWriterType = "json";
	}
	if (solrResultWriterType.length = 0) {
		extension = ".json"; // no ResponseWriter specified: Solr's default is JSON
	} else if (solrResultWriterType === "xslt") {
		try {
			const solrXSLT = form.elements["tr"]; 
			if (solrXSLT.value  === "solr-to-iiif.xsl") {
				extension = ".json"; // "solr-to-iiif.xsl" produces a IIIF collection which is JSON
			} else {
				extension = ".dat"; // should not happen because Solr will throw an error if wt=xslt but tr is missing
			}
		} catch (exception) {
			extension = ".dat";  // unknown XSLT producing who knows what content-type
		}
	} else {
		extension = "." + solrResultWriterType;
	}
	return baseFilename + extension;
}

function encodeMetadataElement(element) {
	let name= element.name;
	// TODO handle multiple select: get element.options, 
	// check each option's selected property and output its value if it's selected
	// radio buttons probably similar
	// also handle dates
	return encodeURIComponent(name + ':(' + element.value + ")");
}

function getElementType(element) {
	if (element.type === undefined) return "TEXT";
	return element.type.toUpperCase();
}

function setFacetValues(form, solrFacetCountResponse) {
	// update the form to include HTML OPTION elements drawn from the Solr facets
	formElements = Array.from(form.elements);
	Object.keys(solrFacetCountResponse.facet_counts.facet_fields).forEach(
		function(facetField) {
			console.log("facet field", facetField);
			const optionContainer = formElements
				.filter(element => element.name === facetField)
				.map(
					function (element) {
						console.log("element", element);
						if (element.list != null) {
							return element.list;
						}
						return element;
					}
				)[0];
			console.log("option container", optionContainer);
			if (optionContainer === undefined) {
				console.error("Could not find the container element to create OPTION elements for field named " + facetField);
			} else {
				// the array of facet values for a field is a strange data structure: it's an array in which 
				// each odd numbered element in the array is a facet value, and each following (even numbered)
				// element contains the count of records for that value.
				console.log("option values raw", solrFacetCountResponse.facet_counts.facet_fields[facetField]);
				const optionValues = solrFacetCountResponse.facet_counts.facet_fields[facetField]
					.filter(
						function(arrayElement, arrayIndex) {
							return (arrayIndex % 2) == 0 // the index is odd (NB array index is zero-based)
						} 
					)
				console.log("option values", optionValues);
				const option = document.createElement("option");
				option.append("");
				optionContainer.append(option);
				optionValues.forEach(
					function(optionValue) {
						const option = document.createElement("option");
						option.append(optionValue);
						optionContainer.append(option);
					}
				);			
			}
		}
	);
}