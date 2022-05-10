// TODO
// ditch the details/summary because it does too much and to little of what we need.
// just create some divs and turn them on and off with CSS
//
// need to close the zoomed div when the user clicks outside of it
// 	find the div.item which is visible and hide it
// 
// add a "close" widget to close the window

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
	const queryURL = photoWall.getAttribute("data-iiif-collection-url");
	queryIIIFCollection(photoWall, queryURL);
}

// callback function to receive notifications of changes to a photoWall's query URI
function photoWallChanged(mutationsList, observer) {
	console.debug("Photo wall changed");
	for(const mutation of mutationsList) {
		if (mutation.type === 'attributes') {
			if (mutation.attributeName === 'data-iiif-collection-url') {
				console.log("The photo wall's query URL has changed");
				const photoWall = mutation.target;
				photoWall.textContent = null;
				const queryURL = photoWall.getAttribute("data-iiif-collection-url");
				queryIIIFCollection(photoWall, queryURL);
			}
		}
	}
}

// execute the photo wall's query and visualize the results
function queryIIIFCollection(photoWall, queryURL) {
	if (queryURL.length > 0) {
		console.debug("Querying IIIF collection " + queryURL + " ...");
		var request = new XMLHttpRequest();
		request.responseType = "json";
		request.open("GET", queryURL);
		request.onload = function(e) {
			var collection = request.response;
			displayIIIFCollection(collection, photoWall);
		}
		request.send();
	}
}

// display the collection on the photo wall
function displayIIIFCollection(collection, photoWall) {
	// add all the collection items (manifests) as tiles in the photo wall
	collection.items.forEach(manifest => displayIIIFManifest(manifest, photoWall));
	try {
		// make sure the first tile loaded is visible
		document.getElementById(encodeURIComponent(collection.items[0].id)).scrollIntoView({"behavior": "smooth"});
	} catch (error) {
		console.log("Failed to scroll first manifest into view:", error);
	}
	if (Object.hasOwn(collection, 'seeAlso')) {
		collection.seeAlso
			.filter(object => object.type = "Collection")
			.forEach(collection => addNextCollectionButton(collection, photoWall));
	}
}

function addNextCollectionButton(collection, photoWall) {
	let tileDiv = document.createElement("div"); // a single tile in the photo wall grid
	tileDiv.className = "tile";
	let link = document.createElement("a");
	link.className = "next-collection";
	link.href = collection.id;
	link.addEventListener("click", loadNextCollection);
	link.append(getPreferredLanguageValue(collection.label)[0]);
	tileDiv.append(link);
	photoWall.append(tileDiv);
}

function loadNextCollection(event) {
	event.preventDefault();
	const link = event.target;
	const linkContainerDiv = link.parentElement;
	const photoWall = linkContainerDiv.parentElement;
	linkContainerDiv.remove();
	queryIIIFCollection(photoWall, link.href);
}

function displayIIIFManifest(manifest, photoWall) {
	let tileDiv = document.createElement("div"); // a single tile in the photo wall grid
	tileDiv.className = "tile";
	tileDiv.id = encodeURIComponent(manifest.id);
	let itemDiv = document.createElement("div"); // a div within the tile which contains the image and metadata
	itemDiv.className = "item";
	let thumbnailImage = document.createElement("img");
	thumbnailImage.src= manifest.thumbnail[0].id;
	thumbnailImage.loading = "lazy";
	let details = document.createElement("details");
	let summary = document.createElement("summary");
	summary.append(thumbnailImage);
	details.append(summary)
	let photoTile = document.createElement("div"); // a div which displays the metadata and has the image as a background
	photoTile.className = "image";
	let thumbnail = manifest.thumbnail[0];
	let thumbnailService = Array.from(thumbnail.service).find(service => service.type === "ImageService2");
	photoTile.setAttribute(
		"style", 
		"background-image: " +
			"url('" + thumbnailService.id + "/full/!600,600/0/default.jpg" + "'), " + 
			"url('" + thumbnail.id + "')"
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
	// copy some of the IIIF "metadata" object into an HTML table
	const metadataToDisplay = ['Series']; // add names of desired fields to this array
	Object.entries(manifest.metadata)
		.filter(entry => metadataToDisplay.includes(entry[0]))
		.forEach(
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
	catalogueLink.append("Go to catalogue record for more details and to download");
	catalogueLinkPara.append(catalogueLink);
	photoTile.append(catalogueLinkPara);
	details.append(photoTile);
	itemDiv.append(details);
	tileDiv.append(itemDiv);
	photoWall.append(tileDiv);
	automateDetails(details);
}

function getPreferredLanguageValue(object) {
	// The object's keys are language codes; this function returns the value of the key
	// which best matches the user's language preference
	// NB this function is a stub which always just returns the value of the first language
	// listed, whatever that language may be.
	// The return value is an array of strings.
	// label is a string, value is an object whose keys are language codes, and whose values are arrays of strings
	let firstLanguageName = Object.keys(object)[0];
	return object[firstLanguageName];
}

function createMetadataRow(label, value, className) {	
	let row = document.createElement("tr");
	row.className = className;
	let labelCell = document.createElement("th");
	labelCell.append(label);
	let valueCell = document.createElement("td");
	let list = document.createElement("ul");
	list.className = "iiif-metadata-value";
	valueCell.append(list);
	getPreferredLanguageValue(value).forEach(
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
	// listen to events fired by the div and open and close the details
	details.addEventListener("click", itemClicked);
}
function itemClicked(event) {
	event.currentTarget.removeAttribute("open");
}

