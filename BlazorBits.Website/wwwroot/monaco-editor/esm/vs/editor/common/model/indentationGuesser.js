/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
/**
 * Compute the diff in spaces between two line's indentation.
 */
function spacesDiff(a, aLength, b, bLength) {
    // This can go both ways (e.g.):
    //  - a: "\t"
    //  - b: "\t    "
    //  => This should count 1 tab and 4 spaces
    var i;
    for (i = 0; i < aLength && i < bLength; i++) {
        var aCharCode = a.charCodeAt(i);
        var bCharCode = b.charCodeAt(i);
        if (aCharCode !== bCharCode) {
            break;
        }
    }
    var aSpacesCnt = 0, aTabsCount = 0;
    for (var j = i; j < aLength; j++) {
        var aCharCode = a.charCodeAt(j);
        if (aCharCode === 32 /* Space */) {
            aSpacesCnt++;
        }
        else {
            aTabsCount++;
        }
    }
    var bSpacesCnt = 0, bTabsCount = 0;
    for (var j = i; j < bLength; j++) {
        var bCharCode = b.charCodeAt(j);
        if (bCharCode === 32 /* Space */) {
            bSpacesCnt++;
        }
        else {
            bTabsCount++;
        }
    }
    if (aSpacesCnt > 0 && aTabsCount > 0) {
        return 0;
    }
    if (bSpacesCnt > 0 && bTabsCount > 0) {
        return 0;
    }
    var tabsDiff = Math.abs(aTabsCount - bTabsCount);
    var spacesDiff = Math.abs(aSpacesCnt - bSpacesCnt);
    if (tabsDiff === 0) {
        return spacesDiff;
    }
    if (spacesDiff % tabsDiff === 0) {
        return spacesDiff / tabsDiff;
    }
    return 0;
}
export function guessIndentation(source, defaultTabSize, defaultInsertSpaces) {
    // Look at most at the first 10k lines
    var linesCount = Math.min(source.getLineCount(), 10000);
    var linesIndentedWithTabsCount = 0; // number of lines that contain at least one tab in indentation
    var linesIndentedWithSpacesCount = 0; // number of lines that contain only spaces in indentation
    var previousLineText = ''; // content of latest line that contained non-whitespace chars
    var previousLineIndentation = 0; // index at which latest line contained the first non-whitespace char
    var ALLOWED_TAB_SIZE_GUESSES = [2, 4, 6, 8]; // limit guesses for `tabSize` to 2, 4, 6 or 8.
    var MAX_ALLOWED_TAB_SIZE_GUESS = 8; // max(2,4,6,8) = 8
    var spacesDiffCount = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // `tabSize` scores
    var _loop_1 = function (lineNumber) {
        var currentLineLength = source.getLineLength(lineNumber);
        var currentLineText = source.getLineContent(lineNumber);
        var charCodeAt = void 0;
        if (currentLineLength > 65536) {
            // if the text buffer is chunk based, so long lines are cons-string, v8 will flattern the string when we check charCode.
            // checking charCode on chunks directly is cheaper.
            charCodeAt = function (offset) { return source.getLineCharCode(lineNumber, offset); };
        }
        else {
            charCodeAt = function (offset) { return currentLineText.charCodeAt(offset); };
        }
        var currentLineHasContent = false; // does `currentLineText` contain non-whitespace chars
        var currentLineIndentation = 0; // index at which `currentLineText` contains the first non-whitespace char
        var currentLineSpacesCount = 0; // count of spaces found in `currentLineText` indentation
        var currentLineTabsCount = 0; // count of tabs found in `currentLineText` indentation
        for (var j = 0, lenJ = currentLineLength; j < lenJ; j++) {
            var charCode = charCodeAt(j);
            if (charCode === 9 /* Tab */) {
                currentLineTabsCount++;
            }
            else if (charCode === 32 /* Space */) {
                currentLineSpacesCount++;
            }
            else {
                // Hit non whitespace character on this line
                currentLineHasContent = true;
                currentLineIndentation = j;
                break;
            }
        }
        // Ignore empty or only whitespace lines
        if (!currentLineHasContent) {
            return "continue";
        }
        if (currentLineTabsCount > 0) {
            linesIndentedWithTabsCount++;
        }
        else if (currentLineSpacesCount > 1) {
            linesIndentedWithSpacesCount++;
        }
        var currentSpacesDiff = spacesDiff(previousLineText, previousLineIndentation, currentLineText, currentLineIndentation);
        if (currentSpacesDiff <= MAX_ALLOWED_TAB_SIZE_GUESS) {
            spacesDiffCount[currentSpacesDiff]++;
        }
        previousLineText = currentLineText;
        previousLineIndentation = currentLineIndentation;
    };
    for (var lineNumber = 1; lineNumber <= linesCount; lineNumber++) {
        _loop_1(lineNumber);
    }
    // Take into account the last line as well
    var deltaSpacesCount = spacesDiff(previousLineText, previousLineIndentation, '', 0);
    if (deltaSpacesCount <= MAX_ALLOWED_TAB_SIZE_GUESS) {
        spacesDiffCount[deltaSpacesCount]++;
    }
    var insertSpaces = defaultInsertSpaces;
    if (linesIndentedWithTabsCount !== linesIndentedWithSpacesCount) {
        insertSpaces = (linesIndentedWithTabsCount < linesIndentedWithSpacesCount);
    }
    var tabSize = defaultTabSize;
    var tabSizeScore = (insertSpaces ? 0 : 0.1 * linesCount);
    // console.log("score threshold: " + tabSizeScore);
    ALLOWED_TAB_SIZE_GUESSES.forEach(function (possibleTabSize) {
        var possibleTabSizeScore = spacesDiffCount[possibleTabSize];
        if (possibleTabSizeScore > tabSizeScore) {
            tabSizeScore = possibleTabSizeScore;
            tabSize = possibleTabSize;
        }
    });
    // console.log('--------------------------');
    // console.log('linesIndentedWithTabsCount: ' + linesIndentedWithTabsCount + ', linesIndentedWithSpacesCount: ' + linesIndentedWithSpacesCount);
    // console.log('spacesDiffCount: ' + spacesDiffCount);
    // console.log('tabSize: ' + tabSize + ', tabSizeScore: ' + tabSizeScore);
    return {
        insertSpaces: insertSpaces,
        tabSize: tabSize
    };
}
