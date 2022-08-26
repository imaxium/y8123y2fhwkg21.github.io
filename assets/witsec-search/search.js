let wsSearchDB = [];
let wsScoreDB = [];
let wsQ = null;

// Display the results to the page
function wsDisplayResults() {
	const section = document.querySelector(".witsec-search");

	try {
		// Change page title
		const searchTitle = (section.dataset.wssearchtitle || "");
		document.title = document.title + " " + searchTitle.replace(/{searchString}/g, wsQ);

		// Change search input
		section.querySelector(".wsSearchInput").value = wsQ;

		// If no results were found
		if (wsScoreDB.length === 0) {
			const noResults = section.querySelector(".wsSearchNoResults");
			noResults.innerHTML = noResults.innerHTML.replace(/{searchString}/g, wsQ);
			noResults.classList.remove("d-none");
			return true;
		}

		// Show "results for"
		let resultsFor = section.querySelector(".wsSearchResultsFor");
		resultsFor.classList.remove("d-none");
		resultsFor.innerHTML = resultsFor.innerHTML
			.replace(/{searchString}/g, wsQ)
			.replace(/{searchTotal}/g, wsScoreDB.length);

		// Max character count for search result body
		const searchMaxChars = (section.dataset.wssearchbodymaxchars !== undefined && !isNaN(section.dataset.wssearchbodymaxchars) ? section.dataset.wssearchbodymaxchars : "9999");

		// Check if search string needs to be highlighted
		let q = wsStripShortWords(wsQ);
		q = q.replace(/ /g, "|"); // Prepare the regex, so it searches for all words in the search string
		const regex =  new RegExp(q, "gi");
		const searchHighlight = (section.dataset.wssearchhighlight === "true" && q.length > 0 ? true : false);
		const searchHighlightColor = section.dataset.wssearchhighlightcolor;
		const searchHighlightMarkup = "<mark style='background-color:" + searchHighlightColor + "; padding:0'>$&</mark>";

		// Grab search result template
		const template = section.querySelector(".wsSearchResultTemplate").outerHTML;

		// Clear the results area
		let searchResults = section.querySelector(".wsSearchResults");
		searchResults.innerHTML = "";
		searchResults.classList.remove("d-none");

		// Let's show the results now
		wsScoreDB.forEach((entry, index) => {
			// Check if we need to cutoff the body text
			if (entry.body.length > searchMaxChars) {
				entry.body = entry.body.substring(0, searchMaxChars);
				while (entry.body[entry.body.length-1] === ".")	// Remove trailing dots
					entry.body = entry.body.slice(0,-1);
				entry.body = entry.body.trim() + "...";
			}

			// Check if we need to highlight the search results
			if (searchHighlight) {			
				entry.header = entry.header.replace(regex, searchHighlightMarkup);
				entry.body = entry.body.replace(regex, searchHighlightMarkup);
			}

			// Replace all 'variables' with the value of this index
			let res = template
				.replace(/{index}/gm, index + 1)
				.replace(/{page}/gm, entry.page)
				.replace(/{anchor}/gm, entry.anchor)
				.replace(/{link}/gm, entry.page + (entry.anchor ? "#" + entry.anchor : ""))
				.replace(/{header}/gm, entry.header)
				.replace(/{body}/gm, entry.body)
				.replace(/{score}/gm, entry.score);

			// Display the results
			searchResults.innerHTML += res;
		});
	} catch(err) {
		wsSearchShowError(err);
	}
}

// Alright, so my guy is searching for something and we got the database ready, let's browse through the json then...
function wsPerformSearch() {
	try {
		// Don't search for words that are too short
		let q = wsStripShortWords(wsQ);

		// If nothing's left after stripping, we shouldn't perform a search
		if (q.length !== 0) {
			// Prepare the regex, so it searches for all words in the search string
			q = q.replace(/ /g, "|");
			const regex =  new RegExp(q, "gi");

			// If a match is found in the header, it's worth more than if a match is found in the body
			const scoreHeader = 3;
			const scoreBody = 1;

			// Loop through the database
			wsSearchDB.forEach(entry => {
				let countHeader = (entry.header.match(regex) || []).length;
				let countBody =  (entry.body.match(regex) || []).length;

				// If there's a match, save it
				if (countHeader > 0 || countBody > 0) {
					entry.score = countHeader * scoreHeader + countBody * scoreBody;
					wsScoreDB.push(entry);
				}
			});

			// Sort the wsScoreDB by score (highest score comes first)
			wsScoreDB = wsScoreDB.sort(function (a, b) {
				if (a.score > b.score)
					return -1;
				else
					return 1;
			});
		}

		// Display the results
		wsDisplayResults();
	} catch(err) {
		wsSearchShowError(err);
	}
}

// Get rid of words that are too short
function wsStripShortWords(q) {
	const section = document.querySelector(".witsec-search");
	const minChars = (!isNaN(section.dataset.wssearchminchars) ? section.dataset.wssearchminchars : 3);
	q = q.split(" ");
	q = q.filter(s => s.length >= minChars);
	q = q.join(" ").trim();
	return q;
}

// Read the online "database"
function wsReadDatabase() {
	let xhr = new XMLHttpRequest();
	let url = "assets/witsec-search/search.db" + "?" + Date.now();
	xhr.open("GET", url, true);
	xhr.onreadystatechange = function () {
		if (xhr.readyState == 4) {
			if (xhr.status == 200) {
				try {
					wsSearchDB = JSON.parse(xhr.responseText);
				}
				catch (e) {
					wsSearchShowError("Couldn't parse returned JSON");
				}

				wsPerformSearch();
			} else {
				wsSearchShowError("XHR status was not the expected 200");
			}
		}
	};
	xhr.send();
}

// Get search parameter (q)
function wsGetParameterByName(name) {
	const url = new URL(window.location.href);
	const searchParams = url.searchParams;

	let q = searchParams.get("q");
	if (q) {
		// Get rid of crap and return it
		q = q
			.replace(/<[^>]+>/g, "") // HTML tags
			.replace(/[^\s\-\u00BF-\u1FFF\u2C00-\uD7FF\w']/g, "") // Any unwanted characters other than letters (of any character set) and some other allowed chars
			.replace(/\n/g, " ")
			.trim();

		return (q === "" ? null : q);
	} else
		return null
}

// Show error if anything goes wrong
function wsSearchShowError(err) {
	console.error("Search: " + err);
	document.querySelector(".witsec-search .wsSearchError").classList.remove("d-none");
}

// When you're ready, let's go
document.addEventListener("DOMContentLoaded", function(e) { 
	wsQ = wsGetParameterByName("q");
	if (wsQ !== null) {
		if (window.location.href.startsWith("file://"))
			alert("Unfortunately the search feature only works online.");
		else
			wsReadDatabase();
	}
});