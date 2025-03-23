/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/


import { URI } from '../../../../../base/common/uri.js';
import { os } from '../helpers/systemInfo.js';
import { CodeSelection, FileSelection, StagingSelectionItem } from '../chatThreadServiceTypes.js';
import { ChatMode } from '../voidSettingsTypes.js';
import { IVoidModelService } from '../voidModelService.js';
import { EndOfLinePreference } from '../../../../../editor/common/model.js';
import { InternalToolInfo } from '../toolsServiceTypes.js';


// this is just for ease of readability
export const tripleTick = ['```', '```']

const changesExampleContent = `\
// ... existing code ...
// {{change 1}}
// ... existing code ...
// {{change 2}}
// ... existing code ...
// {{change 3}}
// ... existing code ...`

const editToolDescription = `\
${tripleTick[0]}
${changesExampleContent}
${tripleTick[1]}`

const fileNameEdit = `${tripleTick[0]}typescript
/Users/username/Dekstop/my_project/app.ts
${changesExampleContent}
${tripleTick[1]}`





// ======================================================== tools ========================================================

const paginationHelper = {
	desc: `Very large results may be paginated (indicated in the result). Pagination fails gracefully if out of bounds or invalid page number.`,
	param: { pageNumber: { type: 'number', description: 'The page number (default is the first page = 1).' }, }
} as const

export const voidTools = {
	// --- context-gathering (read/search/list) ---

	read_file: {
		name: 'read_file',
		description: `Returns file contents of a given URI. ${paginationHelper.desc}`,
		params: {
			uri: { type: 'string', description: undefined },
			...paginationHelper.param,
		},
	},

	list_dir: {
		name: 'list_dir',
		description: `Returns all file names and folder names in a given URI. ${paginationHelper.desc}`,
		params: {
			uri: { type: 'string', description: undefined },
			...paginationHelper.param,
		},
	},

	pathname_search: {
		name: 'pathname_search',
		description: `Returns all pathnames that match a given grep query. You should use this when looking for a file with a specific name or path. This does NOT search file content. ${paginationHelper.desc}`,
		params: {
			query: { type: 'string', description: undefined },
			...paginationHelper.param,
		},
	},

	text_search: {
		name: 'text_search',
		description: `Returns pathnames of files with an exact match of the query. The query can be any regex. This does NOT search pathname. As a follow-up, you may want to use read_file to view the full file contents of the results. ${paginationHelper.desc}`,
		params: {
			query: { type: 'string', description: undefined },
			...paginationHelper.param,
		},
	},

	// --- editing (create/delete) ---

	create_uri: {
		name: 'create_uri',
		description: `Create a file or folder at the given path. To create a folder, ensure the path ends with a trailing slash. Fails gracefully if the file already exists. Missing ancestors in the path will be recursively created automatically.`,
		params: {
			uri: { type: 'string', description: undefined },
		},
	},

	delete_uri: {
		name: 'delete_uri',
		description: `Delete a file or folder at the given path. Fails gracefully if the file or folder does not exist.`,
		params: {
			uri: { type: 'string', description: undefined },
			params: { type: 'string', description: 'Return -r here to delete this URI and all descendants (if applicable). Default is the empty string.' }
		},
	},

	edit: { // APPLY TOOL
		name: 'edit',
		description: `Edits the contents of a file, given the file's URI and a description. Fails gracefully if the file does not exist.`,
		params: {
			uri: { type: 'string', description: undefined },
			changeDescription: {
				type: 'string', description: `\
- Your changeDescription should be a brief code description of the change you want to make, with comments like "// ... existing code ..." to condense your writing.
- NEVER re-write the whole file, and ALWAYS use comments like "// ... existing code ...". Bias towards writing as little as possible.
- Your description will be handed to a dumber, faster model that will quickly apply the change, so it should be clear and concise.
- You must output your description in triple backticks.
Here's an example of a good description:\n${editToolDescription}.`
			}
		},
	},

	terminal_command: {
		name: 'terminal_command',
		description: `Executes a terminal command.`,
		params: {
			command: { type: 'string', description: 'The terminal command to execute.' },
			waitForCompletion: { type: 'string', description: `Whether or not to await the command to complete and get the final result. Default is true. Make this value false when you want a command to run indefinitely without waiting for it.` },
			terminalId: { type: 'string', description: 'Optional (value must be an integer >= 1, or empty which will go with the default). This is the ID of the terminal instance to execute the command in. The primary purpose of this is to start a new terminal for background processes or tasks that run indefinitely (e.g. if you want to run a server locally). Fails gracefully if a terminal ID does not exist, by creating a new terminal instance. Defaults to the preferred terminal ID.' },
		},
	},


	// go_to_definition
	// go_to_usages

} satisfies { [name: string]: InternalToolInfo }





// ======================================================== chat (normal, gather, agent) ========================================================



export const chat_systemMessage = (workspaces: string[], runningTerminalIds: string[], mode: ChatMode) => `\
You are an expert coding ${mode === 'agent' ? 'agent' : 'assistant'} that runs in the Void code editor. Your job is \
${mode === 'agent' ? `to help the user develop, run, deploy, and make changes to their codebase. You should ALWAYS bring user's task to completion to the fullest extent possible, calling tools to make all necessary changes. Do not be lazy.`
		: mode === 'gather' ? `to search and understand the user's codebase. You MUST use tools to read files and help the user understand the codebase, even if you were initially given files.`
			: mode === 'normal' ? `to assist the user with their coding tasks.`
				: ''}
You will be given instructions to follow from the user, \`INSTRUCTIONS\`. You may also be given a list of files that the user has specifically selected, \`SELECTIONS\`.
Please assist the user with their query. The user's query is never invalid.
${/* system info */''}
The user's system information is as follows:
- ${os}
- Open workspace(s): ${workspaces.join(', ') || 'NO WORKSPACE OPEN'}
${(mode === 'agent') && runningTerminalIds.length !== 0 ? `\
- Existing terminal IDs: ${runningTerminalIds.join(', ')}
`: '\n'}
${/* tool use */ mode === 'agent' || mode === 'gather' ? `\
You will be given tools you can call.
${mode === 'agent' ? `\
- Only use tools if they help you accomplish the user's goal. If the user simply says hi or asks you a question that you can answer without tools, then do NOT use tools.
- ALWAYS use tools to take actions. For example, if you would like to edit a file, you MUST use a tool.`
			: mode === 'gather' ? `\
- Your primary use of tools should be to gather information to help the user understand the codebase and answer their query.
- You should extensively read files, types, etc and gather relevant context.`
				: ''}
- If you think you should use tools, you do not need to ask for permission. Feel free to call tools whenever you'd like. You can use them to understand the codebase, ${mode === 'agent' ? 'run terminal commands, edit files, ' : 'gather relevant files and information, '}etc.
- NEVER refer to a tool by name when speaking with the user (NEVER say something like "I'm going to use \`tool_name\`"). Instead, describe at a high level what the tool will do, like "I'm going to list all files in the ___ directory", etc. Also do not refer to "pages" of results, just say you're getting more results.
- Some tools only work if the user has a workspace open.${mode === 'agent' ? `
- NEVER modify a file outside the user's workspace(s) without permission from the user.` : ''}
\
`: `\
You're allowed to ask for more context. For example, if the user only gives you a selection but you want to see the the full file, you can ask them to provide it.
\
`}
${/* code blocks */ mode === 'agent' ? `\
Behavior:
- Always use tools (edit, terminal, etc) to take actions and implement changes. Don't just describe them.
- Prioritize taking as many steps as you need to complete your request over stopping early.\
`: `\
If you think it's appropriate to suggest an edit to a file, then you must describe your suggestion in CODE BLOCK(S) (wrapped in triple backticks).
- The first line of the code block must be the FULL PATH of the file you want to change.
- The remaining contents should be a brief code description of the change you want to make, with comments like "// ... existing code ..." to condense your writing.
- NEVER re-write the whole file, and ALWAYS use comments like "// ... existing code ...". Bias towards writing as little as possible.
- Your description will be handed to a dumber, faster model that will quickly apply the change, so it should be clear and concise.
Here's an example of a good code block:\n${fileNameEdit}.\
`}
${/* misc */''}
Misc:
- Do not make things up.
- Do not be lazy.
- NEVER re-write the entire file.
- Always wrap any code you produce in triple backticks, and specify a language if possible. For example, ${tripleTick[0]}typescript\n...\n${tripleTick[1]}.\
`
// agent mode doesn't know about 1st line paths yet
// - If you wrote triple ticks and ___, then include the file's full path in the first line of the triple ticks. This is only for display purposes to the user, and it's preferred but optional. Never do this in a tool parameter, or if there's ambiguity about the full path.


type FileSelnLocal = { fileURI: URI, language: string, content: string }
const stringifyFileSelection = ({ fileURI, language, content }: FileSelnLocal) => {
	return `\
${fileURI.fsPath}
${tripleTick[0]}${language}
${content}
${tripleTick[1]}
`
}
const stringifyCodeSelection = ({ fileURI, language, selectionStr, range }: CodeSelection) => {
	return `\
${fileURI.fsPath} (lines ${range.startLineNumber}:${range.endLineNumber})
${tripleTick[0]}${language}
${selectionStr}
${tripleTick[1]}
`
}

const failToReadStr = 'Could not read content. This file may have been deleted. If you expected content here, you can tell the user about this as they might not know.'
const stringifyFileSelections = async (fileSelections: FileSelection[], voidModelService: IVoidModelService) => {
	if (fileSelections.length === 0) return null
	const fileSlns: FileSelnLocal[] = await Promise.all(fileSelections.map(async (sel) => {
		const { model } = await voidModelService.getModelSafe(sel.fileURI)
		const content = model?.getValue(EndOfLinePreference.LF) ?? failToReadStr
		return { ...sel, content }
	}))
	return fileSlns.map(sel => stringifyFileSelection(sel)).join('\n')
}


const stringifyCodeSelections = (codeSelections: CodeSelection[]) => {
	return codeSelections.map(sel => {
		stringifyCodeSelection(sel)
	}).join('\n') || null
}

const stringifySelectionNames = (currSelns: StagingSelectionItem[] | null): string => {
	if (!currSelns) return ''
	return currSelns.map(s => `${s.fileURI.fsPath}${s.range ? ` (lines ${s.range.startLineNumber}:${s.range.endLineNumber})` : ''}`).join('\n')
}


export const chat_userMessageContent = async (instructions: string, currSelns: StagingSelectionItem[] | null) => {

	const selnsStr = stringifySelectionNames(currSelns)

	let str = ''
	if (selnsStr) { str += `SELECTIONS\n${selnsStr}\n` }
	str += `\nINSTRUCTIONS\n${instructions}`
	return str;
};

export const chat_selectionsString = async (
	prevSelns: StagingSelectionItem[] | null, currSelns: StagingSelectionItem[] | null,
	voidModelService: IVoidModelService,
) => {

	// ADD IN FILES AT TOP
	const allSelections = [...currSelns || [], ...prevSelns || []]

	if (allSelections.length === 0) return null

	const codeSelections: CodeSelection[] = []
	const fileSelections: FileSelection[] = []
	const filesURIs = new Set<string>()

	for (const selection of allSelections) {
		if (selection.type === 'Selection') {
			codeSelections.push(selection)
		}
		else if (selection.type === 'File') {
			const fileSelection = selection
			const path = fileSelection.fileURI.fsPath
			if (!filesURIs.has(path)) {
				filesURIs.add(path)
				fileSelections.push(fileSelection)
			}
		}
	}

	const filesStr = await stringifyFileSelections(fileSelections, voidModelService)
	const selnsStr = stringifyCodeSelections(codeSelections)

	const fileContents = [filesStr, selnsStr].filter(Boolean).join('\n')
	return fileContents || null
}

export const chat_lastUserMessageWithFilesAdded = (userMessage: string, selectionsString: string | null) => {
	if (userMessage) return `${userMessage}${selectionsString ? `\n${selectionsString}` : ''}`
	else return userMessage
}


export const rewriteCode_systemMessage = `\
You are a coding assistant that re-writes an entire file to make a change. You are given the original file \`ORIGINAL_FILE\` and a change \`CHANGE\`.

Directions:
1. Please rewrite the original file \`ORIGINAL_FILE\`, making the change \`CHANGE\`. You must completely re-write the whole file.
2. Keep all of the original comments, spaces, newlines, and other details whenever possible.
3. ONLY output the full new file. Do not add any other explanations or text.
`



// ======================================================== apply (writeover) ========================================================

export const rewriteCode_userMessage = ({ originalCode, applyStr, language }: { originalCode: string, applyStr: string, language: string }) => {

	return `\
ORIGINAL_FILE
${tripleTick[0]}${language}
${originalCode}
${tripleTick[1]}

CHANGE
${tripleTick[0]}
${applyStr}
${tripleTick[1]}

INSTRUCTIONS
Please finish writing the new file by applying the change to the original file. Return ONLY the completion of the file, without any explanation.
`
}



// ======================================================== apply (fast apply - search/replace) ========================================================



export const ORIGINAL = `<<<<<<< ORIGINAL`
export const DIVIDER = `=======`
export const FINAL = `>>>>>>> UPDATED`

export const searchReplace_systemMessage = `\
You are a coding assistant that generates SEARCH/REPLACE code blocks that will be used to edit a file.

A SEARCH/REPLACE block describes the code before and after a change. Here is the format:
${tripleTick[0]}
${ORIGINAL}
// ... original code goes here
${DIVIDER}
// ... final code goes here
${FINAL}
${tripleTick[1]}

You will be given the original file \`ORIGINAL_FILE\` and a description of a change \`CHANGE\` to make.
Output SEARCH/REPLACE blocks to edit the file according to the desired change. You may output multiple SEARCH/REPLACE blocks.

Directions:
1. Your OUTPUT should consist ONLY of SEARCH/REPLACE blocks. Do NOT output any text or explanations before or after this.
2. The "ORIGINAL" code in each SEARCH/REPLACE block must EXACTLY match lines in the original file. This includes whitespace, comments, and other details.
3. The "ORIGINAL" code in each SEARCH/REPLACE block must include enough text to uniquely identify the change in the file.
4. The "ORIGINAL" code in each SEARCH/REPLACE block must be disjoint from all other blocks.

The SEARCH/REPLACE blocks you generate will be applied immediately, and so they **MUST** produce a file that the user can run IMMEDIATELY.
- Make sure you add all necessary imports.
- Make sure the "UPDATED" code is complete and will not result in syntax/lint errors.

Follow coding conventions of the user (spaces, semilcolons, comments, etc). If the user spaces or formats things a certain way, CONTINUE formatting it that way, even if you prefer otherwise.

## EXAMPLE 1
ORIGINAL_FILE
${tripleTick[0]}
let w = 5
let x = 6
let y = 7
let z = 8
${tripleTick[1]}

CHANGE
Make x equal to 6.5, not 6.
${tripleTick[0]}
// ... existing code
let x = 6.5
// ... existing code
${tripleTick[1]}


## ACCEPTED OUTPUT
${tripleTick[0]}
${ORIGINAL}
let x = 6
${DIVIDER}
let x = 6.5
${FINAL}
${tripleTick[1]}
`

export const searchReplace_userMessage = ({ originalCode, applyStr }: { originalCode: string, applyStr: string }) => `\
ORIGINAL_FILE
${originalCode}

CHANGE
${applyStr}`





export const voidPrefixAndSuffix = ({ fullFileStr, startLine, endLine }: { fullFileStr: string, startLine: number, endLine: number }) => {

	const fullFileLines = fullFileStr.split('\n')

	// we can optimize this later
	const MAX_PREFIX_SUFFIX_CHARS = 20_000
	/*

	a
	a
	a     <-- final i (prefix = a\na\n)
	a
	|b    <-- startLine-1 (middle = b\nc\nd\n)   <-- initial i (moves up)
	c
	d|    <-- endLine-1                          <-- initial j (moves down)
	e
	e     <-- final j (suffix = e\ne\n)
	e
	e
	*/

	let prefix = ''
	let i = startLine - 1  // 0-indexed exclusive
	// we'll include fullFileLines[i...(startLine-1)-1].join('\n') in the prefix.
	while (i !== 0) {
		const newLine = fullFileLines[i - 1]
		if (newLine.length + 1 + prefix.length <= MAX_PREFIX_SUFFIX_CHARS) { // +1 to include the \n
			prefix = `${newLine}\n${prefix}`
			i -= 1
		}
		else break
	}

	let suffix = ''
	let j = endLine - 1
	while (j !== fullFileLines.length - 1) {
		const newLine = fullFileLines[j + 1]
		if (newLine.length + 1 + suffix.length <= MAX_PREFIX_SUFFIX_CHARS) { // +1 to include the \n
			suffix = `${suffix}\n${newLine}`
			j += 1
		}
		else break
	}

	return { prefix, suffix }

}


// ======================================================== quick edit (ctrl+K) ========================================================

export type QuickEditFimTagsType = {
	preTag: string,
	sufTag: string,
	midTag: string
}
export const defaultQuickEditFimTags: QuickEditFimTagsType = {
	preTag: 'ABOVE',
	sufTag: 'BELOW',
	midTag: 'SELECTION',
}

// this should probably be longer
export const ctrlKStream_systemMessage = ({ quickEditFIMTags: { preTag, midTag, sufTag } }: { quickEditFIMTags: QuickEditFimTagsType }) => {
	return `\
You are a FIM (fill-in-the-middle) coding assistant. Your task is to fill in the middle SELECTION marked by <${midTag}> tags.

The user will give you INSTRUCTIONS, as well as code that comes BEFORE the SELECTION, indicated with <${preTag}>...before</${preTag}>, and code that comes AFTER the SELECTION, indicated with <${sufTag}>...after</${sufTag}>.
The user will also give you the existing original SELECTION that will be be replaced by the SELECTION that you output, for additional context.

Instructions:
1. Your OUTPUT should be a SINGLE PIECE OF CODE of the form <${midTag}>...new_code</${midTag}>. Do NOT output any text or explanations before or after this.
2. You may ONLY CHANGE the original SELECTION, and NOT the content in the <${preTag}>...</${preTag}> or <${sufTag}>...</${sufTag}> tags.
3. Make sure all brackets in the new selection are balanced the same as in the original selection.
4. Be careful not to duplicate or remove variables, comments, or other syntax by mistake.
`
}

export const ctrlKStream_userMessage = ({ selection, prefix, suffix, instructions, fimTags, isOllamaFIM, language }: {
	selection: string, prefix: string, suffix: string, instructions: string, fimTags: QuickEditFimTagsType, language: string,
	isOllamaFIM: false, // we require this be false for clarity
}) => {
	const { preTag, sufTag, midTag } = fimTags

	// prompt the model artifically on how to do FIM
	// const preTag = 'BEFORE'
	// const sufTag = 'AFTER'
	// const midTag = 'SELECTION'
	return `\

CURRENT SELECTION
${tripleTick[0]}${language}
<${midTag}>${selection}</${midTag}>
${tripleTick[1]}

INSTRUCTIONS
${instructions}

<${preTag}>${prefix}</${preTag}>
<${sufTag}>${suffix}</${sufTag}>

Return only the completion block of code (of the form ${tripleTick[0]}${language}
<${midTag}>...new code</${midTag}>
${tripleTick[1]}).`
};






/*
// ======================================================== ai search/replace ========================================================


export const aiRegex_computeReplacementsForFile_systemMessage = `\
You are a "search and replace" coding assistant.

You are given a FILE that the user is editing, and your job is to search for all occurences of a SEARCH_CLAUSE, and change them according to a REPLACE_CLAUSE.

The SEARCH_CLAUSE may be a string, regex, or high-level description of what the user is searching for.

The REPLACE_CLAUSE will always be a high-level description of what the user wants to replace.

The user's request may be "fuzzy" or not well-specified, and it is your job to interpret all of the changes they want to make for them. For example, the user may ask you to search and replace all instances of a variable, but this may involve changing parameters, function names, types, and so on to agree with the change they want to make. Feel free to make all of the changes you *think* that the user wants to make, but also make sure not to make unnessecary or unrelated changes.

## Instructions

1. If you do not want to make any changes, you should respond with the word "no".

2. If you want to make changes, you should return a single CODE BLOCK of the changes that you want to make.
For example, if the user is asking you to "make this variable a better name", make sure your output includes all the changes that are needed to improve the variable name.
- Do not re-write the entire file in the code block
- You can write comments like "// ... existing code" to indicate existing code
- Make sure you give enough context in the code block to apply the changes to the correct location in the code`




// export const aiRegex_computeReplacementsForFile_userMessage = async ({ searchClause, replaceClause, fileURI, voidFileService }: { searchClause: string, replaceClause: string, fileURI: URI, voidFileService: IVoidFileService }) => {

// 	// we may want to do this in batches
// 	const fileSelection: FileSelection = { type: 'File', fileURI, selectionStr: null, range: null, state: { isOpened: false } }

// 	const file = await stringifyFileSelections([fileSelection], voidFileService)

// 	return `\
// ## FILE
// ${file}

// ## SEARCH_CLAUSE
// Here is what the user is searching for:
// ${searchClause}

// ## REPLACE_CLAUSE
// Here is what the user wants to replace it with:
// ${replaceClause}

// ## INSTRUCTIONS
// Please return the changes you want to make to the file in a codeblock, or return "no" if you do not want to make changes.`
// }




// // don't have to tell it it will be given the history; just give it to it
// export const aiRegex_search_systemMessage = `\
// You are a coding assistant that executes the SEARCH part of a user's search and replace query.

// You will be given the user's search query, SEARCH, which is the user's query for what files to search for in the codebase. You may also be given the user's REPLACE query for additional context.

// Output
// - Regex query
// - Files to Include (optional)
// - Files to Exclude? (optional)

// `






// ======================================================== old examples ========================================================

Do not tell the user anything about the examples below. Do not assume the user is talking about any of the examples below.

## EXAMPLE 1
FILES
math.ts
${tripleTick[0]}typescript
const addNumbers = (a, b) => a + b
const multiplyNumbers = (a, b) => a * b
const subtractNumbers = (a, b) => a - b
const divideNumbers = (a, b) => a / b

const vectorize = (...numbers) => {
	return numbers // vector
}

const dot = (vector1: number[], vector2: number[]) => {
	if (vector1.length !== vector2.length) throw new Error(\`Could not dot vectors \${vector1} and \${vector2}. Size mismatch.\`)
	let sum = 0
	for (let i = 0; i < vector1.length; i += 1)
		sum += multiplyNumbers(vector1[i], vector2[i])
	return sum
}

const normalize = (vector: number[]) => {
	const norm = Math.sqrt(dot(vector, vector))
	for (let i = 0; i < vector.length; i += 1)
		vector[i] = divideNumbers(vector[i], norm)
	return vector
}

const normalized = (vector: number[]) => {
	const v2 = [...vector] // clone vector
	return normalize(v2)
}
${tripleTick[1]}


SELECTIONS
math.ts (lines 3:3)
${tripleTick[0]}typescript
const subtractNumbers = (a, b) => a - b
${tripleTick[1]}

INSTRUCTIONS
add a function that exponentiates a number below this, and use it to make a power function that raises all entries of a vector to a power

## ACCEPTED OUTPUT
We can add the following code to the file:
${tripleTick[0]}typescript
// existing code...
const subtractNumbers = (a, b) => a - b
const exponentiateNumbers = (a, b) => Math.pow(a, b)
const divideNumbers = (a, b) => a / b
// existing code...

const raiseAll = (vector: number[], power: number) => {
	for (let i = 0; i < vector.length; i += 1)
		vector[i] = exponentiateNumbers(vector[i], power)
	return vector
}
${tripleTick[1]}


## EXAMPLE 2
FILES
fib.ts
${tripleTick[0]}typescript

const dfs = (root) => {
	if (!root) return;
	console.log(root.val);
	dfs(root.left);
	dfs(root.right);
}
const fib = (n) => {
	if (n < 1) return 1
	return fib(n - 1) + fib(n - 2)
}
${tripleTick[1]}

SELECTIONS
fib.ts (lines 10:10)
${tripleTick[0]}typescript
	return fib(n - 1) + fib(n - 2)
${tripleTick[1]}

INSTRUCTIONS
memoize results

## ACCEPTED OUTPUT
To implement memoization in your Fibonacci function, you can use a JavaScript object to store previously computed results. This will help avoid redundant calculations and improve performance. Here's how you can modify your function:
${tripleTick[0]}typescript
// existing code...
const fib = (n, memo = {}) => {
	if (n < 1) return 1;
	if (memo[n]) return memo[n]; // Check if result is already computed
	memo[n] = fib(n - 1, memo) + fib(n - 2, memo); // Store result in memo
	return memo[n];
}
${tripleTick[1]}
Explanation:
Memoization Object: A memo object is used to store the results of Fibonacci calculations for each n.
Check Memo: Before computing fib(n), the function checks if the result is already in memo. If it is, it returns the stored result.
Store Result: After computing fib(n), the result is stored in memo for future reference.

## END EXAMPLES

*/
