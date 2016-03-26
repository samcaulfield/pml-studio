//*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-
// Boxes & Arrows PML Builder
// Author: Sam Caulfield <sam@samcaulfield.com>
// Date: 20.03.2016
// Current Status: Not ready for release (Minimal functionality)
//
// Details:
// 	- The program is entirely event driven. Nothing changes without direct
//	  user interaction such as mouse clicks.
// 	- Whenever the UI needs to be updated, *everything* is redrawn.
// 	- The menu (right click) is the main point of entry for user input.
// 	- Coordinate systems: Drawable objects have an (x, y) position. The
// 	  camera has an offset (cx, cy) and zoom z. Objects are drawn at
// 	  (x * zoom - cx, y * zoom - cy). To detect clicks (mx, my) on an
// 	  object, check
// 	  inBounds(mx, my, x * zoom - cx, y * zoom - cy, objectWidth * zoom,
//	  	objectHeight * zoom).
// 	- This seems to run well on Chrome. On Firefox, the framerate is lower
// 	  and zooming doesn't work TODO.
//
//*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-

//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
//
// PML model variables
//
//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=

// The PML model is a linked list of nodes and is empty in the beginning.
var listHead = null;

//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
//
// UI variables
//
//-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=

var canvas = document.getElementById("canvas");
var c = canvas.getContext("2d");
canvas.style.width='100%';
canvas.style.height='100%';
canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;

//+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
// Mouse information
//
var lmbPressed;
var dragPrevX = -1, dragPrevY = -1; // -1 means this value isn't set.

//+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
// Camera information
//

// The position of the top-left of the camera. This is an offset from zero.
var cx = 0, cy = 0;
// The scaling factor.
var zoom = 1.0;
var zoomDelta = 0.1;
var minZoom = 0.5;
var maxZoom = 10.0;

//+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
// Appearance of nodes, colour and positioning
// Each node is coloured along a gradient and so has two colours.
//

// Actions
var actionColourA = "#555555";
var actionColourB = "#999999";
var actionBorderColour = "#000000";

// Branches
var branchColourA = "#3333CC";
var branchColourB = "#5555EE";
var branchBorderColour = "#000000";

// Iterations
var iterationColourA = "#222222";
var iterationColourB = "#444444";
var iterationBorderColour = "#000000";

// Selections
var selectionColourA = "#9933CC";
var selectionColourB = "#BB55EE";
var selectionBorderColour = "#000000";

var nodeWidth = 50;
var gapBetweenNodes = 20;

//+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
// Input control, event handlers etc.
//

const LeftMouseButton = 0;
const RightMouseButton = 3;
canvas.addEventListener("contextmenu", handleContextMenu, false);
canvas.addEventListener("mousemove", onMouseMove, false);
canvas.addEventListener("mousedown", onMouseDown, false);
canvas.addEventListener("mouseup", onMouseUp, false);
canvas.addEventListener("mousewheel", onMouseWheel, false);

//+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
// Text information, size and colour
//
var textColour = "#000000";
var textFont = "monospace";
var textSize = 15;

//+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
// The colour to clear the canvas contents to.
//
var clearColour = "#FFFFFF";

//+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
// Menu information.
//
var menuOpen = false;
var menuX, menuY;
var menuWidth, menuHeight;
var numEntries, entryGap;
var menuHighlightColour = "#AAAAAA";
var menuHighlightedEntry = -1; // -1 for this value means not set.
var menuClickedNode; // The node the menu was opened for.
var nonEmptyOptionsAction = [
	"Insert action after",
	"Insert branch after",
	"Insert iteration after",
	"Insert selection after",
	"Delete",
	"Insert action before",
	"Insert branch before",
	"Insert iteration before",
	"Insert selection before"
];
var nonEmptyOptions = [
	"Insert action after",
	"Insert branch after",
	"Insert iteration after",
	"Insert selection after",
	"Delete",
	"Insert action before",
	"Insert branch before", "Insert iteration before",
	"Insert selection before",
	"Insert action",
	"Insert branch",
	"Insert iteration",
	"Insert selection"
];
var emptyOptions = [
	"Insert action",
	"Insert branch",
	"Insert iteration",
	"Insert selection"
];
var menuType = emptyOptions;

function growParents(newNode) {
	// Adjust parent size to fit.
	var parentNode = newNode.parentNode;
	var lastNode = getLastListElement(newNode);
	while (parentNode) {
		if (parentNode.x + parentNode.width < lastNode.x + lastNode.width) {
			var oldWidth = parentNode.width;
			parentNode.width = lastNode.x - parentNode.x + lastNode.width + gapBetweenNodes;
			pushX(parentNode.next, parentNode.width - oldWidth);
		}
		if (parentNode.y + parentNode.height < lastNode.y + lastNode.height) {
			parentNode.height = lastNode.y - parentNode.y + lastNode.height + gapBetweenNodes;
		}

		newNode = parentNode;
		parentNode = parentNode.parentNode;
		lastNode = getLastListElement(newNode);
	}
}


//
// Find the node at global (x, y) within the node.
//
function findNodeAt(x, y, node) {
	// for each in the list of siblings
	var outerNode = node.contents;
	while (outerNode) {
		var innerNode = outerNode.head;
		while (innerNode) {
			if (inBounds(x, y, innerNode.x, innerNode.y, innerNode.width, innerNode.height)) {
				return findNodeAt(x, y, innerNode);
			}

			innerNode = innerNode.next;
		}

		outerNode = outerNode.sibling;
	}
	return node;
}

//
// Get the last element in the list. List head must not be null.
//
function getLastListElement(head) {
	var currentNode = head;
	while (currentNode.next) {
		currentNode = currentNode.next;
	}
	return currentNode;
}

//
// Pushes all nodes including and after node along the X axis by amount units.
//
function pushX(node, amount) {
	while (node) {
		node.x += amount;

		// Push the node internals over too.
		var child = node.contents;
		while (child) {
			if (child.head) {
				pushX(child.head, amount);
			}
			child = child.sibling;
		}

		node = node.next;
	}
}

//
//
//
function pushY(node, amount) {
	while (node) {
		node.y += amount;

		// Push the node internals over too.
		var child = node.contents;
		while (child) {
			if (child.head) {
				pushY(child.head, amount);
			}
			child = child.sibling;
		}

		node = node.next;
	}
}

function getLastSibling(outerNode) {
	while (outerNode.sibling) {
		outerNode = outerNode.sibling;
	}
	return outerNode;
}

//
//
//
function branchInsert(branch, newNodeType) {
	// The branch decribes parallel subprocesses
	// It grows downwards on the screen as parallel subprocesses are added
	// New subprocesses are added beneath the existing ones
	var lastOuter = null
	var last = null;
	var newNodeX, newNodeY;

	lastOuter = getLastSibling(branch.contents);
	last = lastOuter.head;

	if (last) {
		newNodeX = last.x;
		newNodeY = last.y + last.height + gapBetweenNodes;
	} else {
		newNodeX = branch.x + gapBetweenNodes;
		newNodeY = branch.y + gapBetweenNodes;
	}

	newNode = new node(newNodeType, newNodeX, newNodeY, nodeWidth, nodeWidth, null, new nodeWrapper(null, null), branch);
	newNodeWrapper = new nodeWrapper(newNode, null);

	lastOuter.head = newNode;
	lastOuter.sibling = newNodeWrapper;

	// Traverse the parents and tell them to expand to fit the new node
	growParents(newNode);

	var x = newNode.parentNode.parentNode.contents.sibling;
	while (x) {
		pushY(x.head, 10);
		x = x.sibling;
	}
}

//
// Clears the canvas to clearColour.
//
function clearCanvas() {
	c.fillStyle = clearColour;
	c.beginPath();
	c.fillRect(0, 0, canvas.width, canvas.height);
}

//
// Clears the canvas and draws everything.
//
// The drawing model is as follows:
// 	- Call draw() whenever a UI change occurs.
// 	- If X should be drawn over Y, then draw Y then X.
// 	- Clear the canvas under the component before drawing the component.
//
var debug = false;
var frame = 0;
function draw() {
	clearCanvas();

	if (debug) {
		c.font = "10px monospace";
		c.fillStyle = textColour;
		c.fillText("frame: " + frame,          10, 10);
		c.fillText("cx: " + cx + " cy: " + cy, 10, 25);
		c.fillText("menuOpen = " + menuOpen,   10, 40);
		c.fillText("zoom = " + zoom,           10, 55);
		frame++;
		c.beginPath();
		c.moveTo(0, 0);
		c.lineTo(canvas.width, canvas.height);
		c.stroke();
		c.beginPath();
		c.moveTo(canvas.width, 0);
		c.lineTo(0, canvas.height);
		c.stroke();
	}

	// Draw the PML model
	drawModel();

	if (menuOpen) {
		drawMenu();
	}
}

//
// Draws the menu.
//
function drawMenu() {
	if (menuType == emptyOptions) {
		// Options are to insert a first element.

		entryGap = 5;
		menuHeight = emptyOptions.length * (textSize + entryGap);
		menuWidth = 150; // Should fit longest string.

		c.fillStyle = clearColour;
		c.beginPath();
		c.fillRect(menuX, menuY, menuWidth, menuHeight);

		if (menuHighlightedEntry != -1) {
			c.fillStyle = menuHighlightColour;
			c.fillRect(menuX, menuY + menuHighlightedEntry *
				(textSize + entryGap), menuWidth,
				textSize + entryGap);
		} 
		c.fillStyle = textColour;
		c.rect(menuX, menuY, menuWidth, menuHeight);
		c.stroke();

		c.font = textSize + "px " + textFont;
		var i;
		for (i = 0; i < emptyOptions.length; i++) {
			c.fillText(emptyOptions[i], menuX,
				menuY + (i + 1) * textSize + i * entryGap);
		}
	} else if (menuType === nonEmptyOptions) {
		c.fillStyle = clearColour;
		c.beginPath();
		c.fillRect(menuX, menuY, menuWidth, menuHeight);

		entryGap = 5;

		var menuChoices;
		if (menuClickedNode.type == "action") {
			menuChoices = nonEmptyOptionsAction;
		} else {
			menuChoices = nonEmptyOptions;
		}
		menuHeight = menuChoices.length * (textSize + entryGap);
		menuWidth = 350; // TODO Should fit longest string.

		if (menuHighlightedEntry != -1) {
			c.fillStyle = menuHighlightColour;
			c.fillRect(menuX, menuY + menuHighlightedEntry *
				(textSize + entryGap), menuWidth,
				textSize + entryGap);
		}

		c.fillStyle = textColour;
		c.rect(menuX, menuY, menuWidth, menuHeight);
		c.stroke();

		c.font = textSize + "px " + textFont;
		var i;
		for (i = 0; i < menuChoices.length; i++) {
			c.fillText(menuChoices[i], menuX,
				menuY + (i + 1) * textSize + i * entryGap);
		}
	}
}

//
// Draws the PML model.
//
function drawModel() {
	var currentNode = listHead;
	while (currentNode) {
		drawNode(currentNode);
		currentNode = currentNode.next;
	}
}

//
// Returns true if (ax, ay) in bounds of rectangle b.
//
function inBounds(ax, ay, bx, by, width, height) {
	return ax >= bx && ax < bx + width && ay >= by && ay < by + height;
}

//
// Handles mouse presses EXCEPT right click.
//
function onMouseDown(e) {
	switch (e.button) {
	case LeftMouseButton:
		lmbPressed = true;
		break
	case RightMouseButton:
		// Throw away RMB clicks here, they are used to open the menu.
		return;
	}

	var canvasOffset = $("#canvas").offset();
	var offsetX = canvasOffset.left;
	var offsetY = canvasOffset.top;
	// The cursor coordinates on the canvas.
	var mx = parseInt(e.clientX - offsetX);
	var my = parseInt(e.clientY - offsetY);

	// If the menu is open it grabs all mouse move events over anything
	// under it.
	if (menuOpen && inBounds(mx, my, menuX, menuY, menuWidth, menuHeight)) {
		// Each entry is textSize + entryGap px high.
		var clickedEntryIndex = Math.floor((my - menuY) /
			(textSize + entryGap));

		if (menuType === emptyOptions) {
			switch (clickedEntryIndex) {
			case 0: // Insert action
				listHead = new node("action", mx + cx, my + cy,
					nodeWidth, nodeWidth, null, new nodeWrapper(null, null), null);
				menuType = nonEmptyOptions;
				menuOpen = false;
				draw();
				break;
			case 1: // Insert branch
				listHead = new node("branch", mx + cx, my + cy,
					nodeWidth, nodeWidth, null, new nodeWrapper(null, null), null);
				menuType = nonEmptyOptions;
				menuOpen = false;
				draw();
				break;
			case 2: // Insert iteration
				listHead = new node("iteration", mx + cx,
					my + cy, nodeWidth, nodeWidth, null, new nodeWrapper(null, null), null);
				menuType = nonEmptyOptions;
				menuOpen = false;
				draw();
				break;
			case 3: // Insert selection
				listHead = new node("selection", mx + cx,
					my + cy, nodeWidth, nodeWidth, null,
					new nodeWrapper(null, null), null);
				menuType = nonEmptyOptions;
				menuOpen = false;
				draw();
				break;
			}
		} else if (menuType === nonEmptyOptions) {
			switch (clickedEntryIndex) {
			case 0: // Insert action after
				var newNode = new node("action",
					menuClickedNode.x +
					menuClickedNode.width + gapBetweenNodes,
					menuClickedNode.y, nodeWidth, nodeWidth,
					menuClickedNode.next, new nodeWrapper(null, null), menuClickedNode.parentNode);
				menuClickedNode.next = newNode;
				// Push nodes after it over.
				var i = newNode.next;
				pushX(i, nodeWidth + gapBetweenNodes);
				growParents(newNode);
				menuOpen = false;
				draw();
				break;
			case 1: // Insert branch after
				var newNode = new node("branch",
					menuClickedNode.x +
					menuClickedNode.width + gapBetweenNodes,
					menuClickedNode.y, nodeWidth, nodeWidth,
					menuClickedNode.next, new nodeWrapper(null, null), menuClickedNode.parentNode);
				menuClickedNode.next = newNode;
				var i = newNode.next;
				pushX(i, nodeWidth + gapBetweenNodes);
				growParents(newNode);
				menuOpen = false;
				draw();
				break;
			case 2: // Insert iteration after
				var newNode = new node("iteration",
					menuClickedNode.x +
					menuClickedNode.width + gapBetweenNodes,
					menuClickedNode.y, nodeWidth, nodeWidth,
					menuClickedNode.next, new nodeWrapper(null, null), menuClickedNode.parentNode);
				menuClickedNode.next = newNode;
				var i = newNode.next;
				pushX(i, nodeWidth + gapBetweenNodes);
				growParents(newNode);
				menuOpen = false;
				draw();
				break;
			case 3: // Insert selection after
				var newNode = new node("selection",
					menuClickedNode.x +
					menuClickedNode.width + gapBetweenNodes,
					menuClickedNode.y, nodeWidth, nodeWidth,
					menuClickedNode.next, new nodeWrapper(null, null), menuClickedNode.parentNode);
				menuClickedNode.next = newNode;
				var i = newNode.next;
				pushX(i, nodeWidth + gapBetweenNodes);
				growParents(newNode);
				menuOpen = false;
				draw();
				break;
			case 4: // Delete
				break;
			case 5: // Insert action before
				break;
			case 6: // Insert branch before
				break;
			case 7: // Insert iteration before
				break;
			case 8: // Insert selection before
				break;
			case 9: // Insert action
				switch (menuClickedNode.type) {
				case "branch":
					branchInsert(menuClickedNode, "action");
					menuOpen = false;
					draw();
					break;
				case "iteration":
					break;
				case "selection":
					break;
				}
				break;
			case 10: // Insert branch
				switch (menuClickedNode.type) {
				case "branch":
					branchInsert(menuClickedNode, "branch");
					menuOpen = false;
					draw();
					break;
				case "iteration":
					break;
				case "selection":
					break;
				}
				break;
			case 11: // Insert iteration
				break;
			case 12: // Insert selection
				break;
			}
		}
	} else if (menuOpen) {
		menuOpen = false;
		draw();
	}
}

//
//
//
function onMouseUp(e) {
	switch (e.button) {
	case LeftMouseButton:
		lmbPressed = false;
		// Set these back to the unset value so the scene doesn't jump
		// around when a new drag starts.
		dragPrevX = dragPrevY = -1;
		break;
	}
}

//
//
//
function onMouseWheel(e) {
	e.preventDefault();
	menuOpen = false;
	draw();

	if (e.wheelDelta > 0) {
		if (zoom < maxZoom) {
			zoom += zoomDelta;
			draw();
		}
	} else if (e.wheelDelta < 0) {
		if (zoom > minZoom) {
			zoom -= zoomDelta;
			draw();
		}
	}
}

//
// Handles mouse movement.
//
function onMouseMove(e) {
	var canvasOffset = $("#canvas").offset();
	var offsetX = canvasOffset.left;
	var offsetY = canvasOffset.top;
	var mx = parseInt(e.clientX - offsetX);
	var my = parseInt(e.clientY - offsetY);

	// If mouse is moving and LMB is pressed, then the user is dragging.
	if (lmbPressed) {
		if (dragPrevX != -1 && dragPrevY != -1) {
			cx += (1 / zoom) * (mx - dragPrevX);
			cy += (1 / zoom) * (my - dragPrevY);
			draw();
		}
		dragPrevX = mx;
		dragPrevY = my;
	}

	// If the menu is open it grabs all mouse move events over anything
	// under it.
	if (menuOpen && inBounds(mx, my, menuX, menuY, menuWidth, menuHeight)) {
		// Each entry is textSize + entryGap px high.
		var checkMenuHighlightedEntry = Math.floor((my - menuY) /
			(textSize + entryGap));
		if (checkMenuHighlightedEntry != menuHighlightedEntry) {
			menuHighlightedEntry = checkMenuHighlightedEntry;
			draw();
		}

	} else if (menuOpen) {
		menuHighlightedEntry = -1;
		draw();
	}
}

//
// Right click opens the context menu. The context menu contents depend on the
// state of the PML model. If the model is empty, then the meny prompts for a
// first node. Otherwise, if the click was over a node the menu prompts for a
// before/after node, else nothing happens.
//
function handleContextMenu(e) {
	e.preventDefault();

	// If the menu is open close it.
	if (menuOpen) {
		menuOpen = false;
		draw();
		return;
	}

	var canvasOffset = $("#canvas").offset();
	var offsetX = canvasOffset.left;
	var offsetY = canvasOffset.top;
	var mx = parseInt(e.clientX - offsetX);
	var my = parseInt(e.clientY - offsetY);

	// If the model is empty, the menu can be opened anywhere.
	if (listHead == null) {
		menuX = mx + 1;
		menuY = my + 1;
		menuOpen = true;
		draw();
	}
	// If the model isn't empty, then the menu can only be opened by right
	// clicking on a node.
	else {
		var node = listHead;
		var finished = false;
		while (!finished && node) {
			if (inBounds(mx, my, (node.x - cx) * zoom,
				(node.y - cy) * zoom, node.width * zoom,
				node.height * zoom)) {
				menuX = mx + 1;
				menuY = my + 1;
				menuClickedNode = findNodeAt(mx, my, node);
				menuOpen = true;
				draw();
				finished = true;
			}
			node = node.next;
		}
	}
}

//
//
//
function node(type, x, y, width, height, next, contents, parentNode) {
	this.type = type;
	this.x = x;
	this.y = y;
	this.width = width;
	this.height = height;
	this.next = next;
	this.contents = contents;
	this.parentNode = parentNode;
}

//
//
//
function nodeWrapper(head, sibling) {
	this.head = head;
	this.sibling = sibling;
}

//
//
//
function drawNode(node) {
	var x = node.x - cx, y = node.y - cy;
	var gradient = c.createLinearGradient(x * zoom, y * zoom,
		x * zoom + node.width * zoom, y * zoom + node.height * zoom);
	c.fillStyle = gradient;

	switch (node.type) {
	case "action":
		gradient.addColorStop(0, actionColourA);
		gradient.addColorStop(1, actionColourB);
		c.fillRect(x * zoom, y * zoom, node.width * zoom,
			node.height * zoom);
		c.strokeStyle = actionBorderColour;
		c.strokeRect(x * zoom, y * zoom, node.width * zoom,
			node.height * zoom);
		break;
	case "branch":
		gradient.addColorStop(0, branchColourA);
		gradient.addColorStop(1, branchColourB);
		c.fillRect(x * zoom, y * zoom, node.width * zoom,
			node.height * zoom);
		c.strokeStyle = branchBorderColour;
		c.strokeRect(x * zoom, y * zoom, node.width * zoom,
			node.height * zoom);
		break;
	case "iteration":
		gradient.addColorStop(0, iterationColourA);
		gradient.addColorStop(1, iterationColourB);
		c.fillRect(x * zoom, y * zoom, node.width * zoom,
			node.height * zoom);
		c.strokeStyle = iterationBorderColour;
		c.strokeRect(x * zoom, y * zoom, node.width * zoom,
			node.height * zoom);
		break;
	case "selection":
		gradient.addColorStop(0, selectionColourA);
		gradient.addColorStop(1, selectionColourB);
		c.fillRect(x * zoom, y * zoom, node.width * zoom,
			node.height * zoom);
		c.strokeStyle = selectionBorderColour;
		c.strokeRect(x * zoom, y * zoom, node.width * zoom,
			node.height * zoom);
		break;
	}

	var child = node.contents;
	while (child) {
		var subNode = child.head;
		while (subNode) {
			drawNode(subNode);
			subNode = subNode.next;
		}
		child = child.sibling;
	}
}

function nope() {
	alert("not implemented");
}

