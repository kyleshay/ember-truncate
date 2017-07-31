/**
 * A heavily modified version of TextOverflowClamp.js (http://codepen.io/Merri/pen/Dsuim)
 *
 * @module  Utilities
 * @method clamp
 * @param {Element} el - The element containing the content to be truncated.
 * @param {Number} lineClamp - The number of lines at which to truncate.
 * @param {Function} cb - A callback function that is invoked after truncation. It is
 * passed a single argument that indicates whether or not truncation was necessary.
 * @param {String} cssClass - A CSS class applied to the last line instead of inline CSS.
 */

export default class Clamp {

  // Pass in the document object on creation
  constructor(doc) {
    this.doc = doc;
  }

  appendNodeAndQueueToElement(element, node, queue, nodeStack) {
    var queueLength = queue && queue.length,
        i, aNode, bNode;
    // add nodes waiting to be finalized
    for(i = 0; i < queueLength; ++i) {
      element.appendChild(queue[i]);
    }
    if (nodeStack.length) {
      // add nodes from the stack
      i = nodeStack.length - 1;
      // add the text to the last node on the stack
      nodeStack[i].appendChild(node);
      // ensure nodes from the stack are appended to each other
      for (; i > 0 && (aNode = nodeStack[i]).parentNode !== (bNode = nodeStack[i - 1]); --i) {
        bNode.appendChild(aNode);
      }
      // ensure root node from stack is added to measurement node
      if ((aNode = nodeStack[0]).parentNode !== element) {
        element.appendChild(aNode);
      }
    } else {
      // add the text directly to the measurement node
      element.appendChild(node);
    }
  } // function appendNodeAndQueueToElement

  createMeasureElement(el) {
    // measurement element is made a child of the clamped element to get it's style
    var measure = el;
    measure.style.position = 'absolute'; // prevent page reflow
    measure.style.whiteSpace = 'pre'; // cross-browser width results
    measure.style.visibility = 'hidden'; // prevent drawing
    return measure;
  } // function createMeasureElement

  clamp(el, lineClamp, cb, cssClass) {
    // make sure the element belongs to the document
    if (!el.ownerDocument || el.ownerDocument !== this.doc) {
      return;
    }

    // reset to safe starting values
    var nodeStack = [];
    var lineCount = 1;
    var wasNewLine = false;
    var lineWidth = el.clientWidth;
    var seedQueue = [];
    var pendingQueue = [];
    var ce = this.doc.createElement.bind(this.doc);
    var ctn = this.doc.createTextNode.bind(this.doc);
    var textNode = null;
    var thisNode = null;
    var line = null;
    var measure = null;
    var anaqte = this.appendNodeAndQueueToElement;

    // get all nodes and remove them
    while (el.firstChild !== null) {
      // convert BR tag to space
      if (el.firstChild.tagName === 'BR') {
        seedQueue.push(ctn(' '));
        el.removeChild(el.firstChild);
        // remove remaining BR tags in a sequence
        while (el.firstChild !== null && el.firstChild.tagName === 'BR') {
          el.removeChild(el.firstChild);
        }
      } else {
        seedQueue.push(el.firstChild);
        el.removeChild(el.firstChild);
      }
    }

    // add measurement element within so it inherits styles
    measure = this.createMeasureElement(ce('span'));
    el.appendChild(measure);

    function clampNodeRecurse(nodeQueue) {
      var wordStart, pos, text, lineStart,
          lineText, nextQueue, measureWidth;

      function nextWord() {
        // remember last word start position
        wordStart = pos + 1;
        // move to the next word
        if (pos >= text.length) {
          pos = text.length + 1;
        } else {
          pos = text.indexOf(' ', pos + 1);
          if (pos < 0) {
            pos = text.length;
          }
        }
      } // function nextWord

      function calculateFit() {
        // ignore any further processing if we have total lines
        if (lineCount > lineClamp) {
          // move to the next word
          nextWord();
          return;
        }
        // create a text node to measure
        textNode = ctn(text.substr(lineStart, pos - lineStart));
        // place relevant nodes into the measurement element
        anaqte(measure, textNode, pendingQueue, nodeStack);
        // take the measurement
        measureWidth = measure.clientWidth;
        // remove text node from node stack
        if (nodeStack.length) {
          nodeStack[nodeStack.length - 1].removeChild(textNode);
        }
        // have we exceeded allowed line width?
        if (lineWidth <= measureWidth) {
          if(wasNewLine) {
            // we have a long word so it gets a line of it's own
            lineText = text.substr(lineStart, Math.min(pos + 1, text.length) - lineStart);
            // next line start position
            lineStart = Math.min(pos + 1, text.length);
            // move to the next word
            nextWord();
          } else {
            // grab the text until this word
            lineText = text.substr(lineStart, wordStart - lineStart);
            // next line start position
            lineStart = wordStart;
          }
          // create a line element
          line = ce('span');
          // add text to the line element
          anaqte(line, ctn(lineText), pendingQueue, nodeStack);
          // add the line element to the container
          el.appendChild(line);
          // flush the queue
          pendingQueue = [];
          // refresh the stack
          nodeStack = nodeStack.map((node) => node.cloneNode(false));
          // yes, we created a new line
          wasNewLine = true;
          ++lineCount;
        } else {
          // did not create a new line
          wasNewLine = false;
          // move to the next word
          nextWord();
        }
        // clear measurement element
        while (measure.firstChild !== null) {
          measure.removeChild(measure.firstChild);
        }
      } // function calculateFit

      while (nodeQueue.length) {
        thisNode = nodeQueue.shift();
        if (thisNode.nodeType === 3 && thisNode.nodeValue) {
          // text node
          // get all the text, remove any line changes
          text = thisNode.nodeValue.replace(/\n/g, ' ');
          // reset to safe starting values
          lineStart = wordStart = 0;
          pos = text.indexOf(' ');
          // step through the words
          while (pos <= text.length) {
            calculateFit();
          }
          if (lineStart < text.length) {
            // there is text that hasn't been appended
            if (nodeStack.length) {
              // add the text to the last node on the stack
              anaqte(null, ctn(text.substr(lineStart)), null, nodeStack);
              // push the root from the node stack into the queue if it's not already
              if (pendingQueue.indexOf(nodeStack[0]) < 0) {
                pendingQueue.push(nodeStack[0]);
              }
            } else {
              // add the text directly to the pending queue
              pendingQueue.push(ctn(text.substr(lineStart)));
            }
          }
        } else {
          // element node
          nextQueue = [];
          while (thisNode.firstChild !== null) {
            nextQueue.push(thisNode.firstChild);
            thisNode.removeChild(thisNode.firstChild);
          }
          nodeStack.push(thisNode);
          clampNodeRecurse(nextQueue);
          nodeStack.pop();
        }
      }
    } // function clampNodeRecurse

    // Recurse through all nodes
    clampNodeRecurse(seedQueue);

    // remove the measurement element from the container
    el.removeChild(measure);

    // give styles required for text-overflow to kick in
    if (lineCount > lineClamp) {
      if ('string' === typeof cssClass) {
        el.lastChild.classList.add(cssClass);
      } else {
        (function(s) {
          s.display = 'block';
          s.overflow = 'hidden';
          s.textOverflow = 'ellipsis';
          s.whiteSpace = 'nowrap';
          s.width = '100%';
        }(el.lastChild.style));
      }
    }

    // flush nodes waiting to be appended
    if (pendingQueue.length) {
      if (lineCount > lineClamp) {
        // flush them into the last span
        while (pendingQueue.length) {
          el.lastChild.appendChild(pendingQueue.shift());
        }
      } else {
        // create the last line element
        line = ce('span');
        // flush them into the new span
        while (pendingQueue.length) {
          line.appendChild(pendingQueue.shift());
        }
        // add the line element to the container
        el.appendChild(line);
      }
    }

    // call the callback with whether or not the text was truncated
    cb(lineCount > lineClamp);
  } // function clamp
}
