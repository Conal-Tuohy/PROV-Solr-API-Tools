// TODO
// ditch the details/summary because it does too much and to little of what we need.
// just create some divs and turn them on and off with CSS
//
// need to close the zoomed div when the user clicks outside of it
// 	find the div.item which is visible and hide it
// 
// add a "close" widget to close the window
//
// add a "go to catalogue" link to the window

// when the document loads, initialize all the photo walls
window.addEventListener('load', initializeIIIFCollectionPhotoWalls);

// initialize photo walls
function initializeIIIFCollectionPhotoWalls() {
	console.debug("initializing photo walls ...");
	const photoWalls = document.querySelectorAll("div.iiif-collection-photo-wall");
	photoWalls.forEach(photoWall => initializeIIIFCollectionPhotoWall(photoWall)); 
}

// initialize an individual photo wall
function initializeIIIFCollectionPhotoWall(photoWall) {
	console.debug("initializing photo wall ...");
	const config = { attributes: true, childList: false, subtree: false };
	// Create an observer to listen to changes to the photoWall's attributes
	const observer = new MutationObserver(photoWallChanged);
	// Start observing the photoWall's attributes
	observer.observe(photoWall, config);
	// query for the collection immediately
	queryIIIFCollection(photoWall);
}

// callback function to receive notifications of changes to a photoWall's query URI
function photoWallChanged(mutationsList, observer) {
	console.debug("Photo wall changed");
	for(const mutation of mutationsList) {
		if (mutation.type === 'attributes') {
			if (mutation.attributeName === 'data-iiif-collection-url') {
				console.log("The photo wall's query URL has changed");
				queryIIIFCollection(mutation.target);
			}
		}
	}
}

// execute the photo wall's query and visualize the results
function queryIIIFCollection(photoWall) {
	const queryURL = photoWall.getAttribute("data-iiif-collection-url");
	console.debug("Querying IIIF collection " + queryURL + " ...");
	// TODO check queryURL is good to go
	var request = new XMLHttpRequest();
	request.responseType = "json";
	request.open("GET", queryURL);
	request.onload = function(e) {
		var collection = request.response;
		displayIIIFCollection(collection, photoWall);
	}
	request.send();
}

// display the collection on the photo wall
function displayIIIFCollection(collection, photoWall) {
	//photoWall.textContent = JSON.stringify(collection);
	photoWall.textContent = null;
	collection.items.forEach(manifest => displayIIIFManifest(manifest, photoWall));
}
function displayIIIFManifest(manifest, photoWall) {
	let tileDiv = document.createElement("div"); // a single tile in the photo wall grid
	tileDiv.className = "tile";
	let itemDiv = document.createElement("div"); // a div within the tile which contains the image and metadata
	itemDiv.className = "item";
	let thumbnail = document.createElement("img");
	thumbnail.src= manifest.thumbnail[0].id;
	thumbnail.loading = "lazy";
	let details = document.createElement("details");
	let summary = document.createElement("summary");
	summary.append(thumbnail);
	details.append(summary)
	let photoTile = document.createElement("div"); // a div which displays the metadata and has the image as a background
	photoTile.className = "image";
	photoTile.setAttribute(
		"style", 
		"background-image: " +
			"url('" + manifest.thumbnail[0].service["@id"] + "/full/!400,400/0/default.jpg" + "'), " + 
			"url('" + manifest.thumbnail[0].id + "')"
	);
	// add navigation controls
	let closeButton = document.createElement("button");
	closeButton.className = "close";
	closeButton.append("\u00d7");
	photoTile.append(closeButton);
	let metadataTable = document.createElement("table");
	metadataTable.className="metadata";
	metadataTable.append(
		createMetadataRow(
			"Label",
			manifest.label,
			"iiif-label"
		)
	);
	// copy the IIIF "metadata" object into an HTML table
	Object.entries(manifest.metadata).forEach(
		function(entry) {
			metadataTable.append(
				createMetadataRow(
					entry[0],
					entry[1],
					"iiif-metadata"
				)
			);
		}
	);
	photoTile.append(metadataTable);
	let catalogueLinkPara = document.createElement("p");
	catalogueLinkPara.className = "iiif-homepage";
	let catalogueLink = document.createElement("a");
	catalogueLink.setAttribute("href", manifest.homepage[0].id);
	catalogueLink.setAttribute("target", "_blank");
	catalogueLink.append("See catalogue record");
	catalogueLinkPara.append(catalogueLink);
	photoTile.append(catalogueLinkPara);
	details.append(photoTile);
	itemDiv.append(details);
	tileDiv.append(itemDiv);
	photoWall.append(tileDiv);
	automateDetails(details);
}

function createMetadataRow(label, value, className) {	
	// label is a string, value is an object whose keys are language codes, and whose values are arrays of strings
	let firstLanguageName = Object.keys(value)[0];
	let row = document.createElement("tr");
	row.className = className;
	let labelCell = document.createElement("th");
	labelCell.append(label);
	let valueCell = document.createElement("td");
	let list = document.createElement("ul");
	list.className = "iiif-metadata-value";
	valueCell.append(list);
	value[firstLanguageName].forEach(
		function(string) {
			// TODO handle HTML markup which may be present: if the property value starts with "<" and ends with ">"
			let listItem = document.createElement("li");
			list.append(listItem);
			listItem.append(string);
		}
	);
	row.append(labelCell);
	row.append(valueCell);
	return row;
}
function automateDetails(details) {
	// listen to events fired by the div and open and close the  
	details.addEventListener("click", itemClicked);
}
function itemClicked(event) {
	event.currentTarget.removeAttribute("open");
}

