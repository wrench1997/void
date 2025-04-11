/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { EndOfLinePreference } from '../../../../../editor/common/model.js';
import { StagingSelectionItem } from '../chatThreadServiceTypes.js';
import { os } from '../helpers/systemInfo.js';
import { RawToolCallObj } from '../sendLLMMessageTypes.js';
import { toolNamesThatRequireApproval } from '../toolsServiceTypes.js';
import { IVoidModelService } from '../voidModelService.js';
import { ChatMode } from '../voidSettingsTypes.js';

// this is just for ease of readability
export const tripleTick = ['```', '```']

export const MAX_DIRSTR_CHARS_TOTAL_BEGINNING = 20_000
export const MAX_DIRSTR_CHARS_TOTAL_TOOL = 20_000
export const MAX_DIRSTR_RESULTS_TOTAL_BEGINNING = 100
export const MAX_DIRSTR_RESULTS_TOTAL_TOOL = 100



export const MAX_PREFIX_SUFFIX_CHARS = 20_000


// ======================================================== tools ========================================================
const changesExampleContent = `\
// ... existing code ...
// {{change 1}}
// ... existing code ...
// {{change 2}}
// ... existing code ...
// {{change 3}}
// ... existing code ...`

const editToolDescriptionExample = `\
${tripleTick[0]}
${changesExampleContent}
${tripleTick[1]}`

const fileNameEditExample = `${tripleTick[0]}typescript
/Users/username/Dekstop/my_project/app.ts
${changesExampleContent}
${tripleTick[1]}`



export type InternalToolInfo = {
	name: string,
	description: string,
	params: {
		[paramName: string]: { description: string }
	},
}



const uriParam = (object: string) => ({
	uri: { description: `The FULL path to the ${object}.` }
})

const paginationParam = {
	page_number: { description: 'Optional. The page number of the result. Default is 1.' }
} as const


export const voidTools = {
	// --- context-gathering (read/search/list) ---

	read_file: {
		name: 'read_file',
		description: `Returns file contents of a given URI.`,
		params: {
			...uriParam('file'),
			start_line: { description: 'Optional. Default is 1. Start reading on this line.' },
			end_line: { description: 'Optional. Default is Infinity. Stop reading after this line.' },
			...paginationParam,
		},
	},

	ls_dir: {
		name: 'ls_dir',
		description: `Lists all files and folders in the given URI.`,
		params: {
			...uriParam('folder'),
			...paginationParam,
		},
	},

	get_dir_structure: {
		name: 'get_dir_structure',
		description: `This is a very effective way to learn about the user's codebase. Returns a tree diagram of all the files and folders in the given folder. `,
		params: {
			...uriParam('folder')
		}
	},

	// pathname_search: {
	// 	name: 'pathname_search',
	// 	description: `Returns all pathnames that match a given \`find\`-style query over the entire workspace. ONLY searches file names. ONLY searches the current workspace. You should use this when looking for a file with a specific name or path. ${paginationHelper.desc}`,

	search_pathnames_only: {
		name: 'search_pathnames_only',
		description: `Returns all pathnames that match a given query (searches ONLY file names). You should use this when looking for a file with a specific name or path.`,
		params: {
			query: { description: `Your query for the search.` },
			search_in_folder: { description: 'Optional. Only search files in this given folder glob.' },
			...paginationParam,
		},
	},



	search_files: {
		name: 'search_files',
		description: `Returns all pathnames that match a given query (searches ONLY file contents). The query can be any substring or glob. You can follow this with read_file to view result contents.`,
		params: {
			query: { description: `Your query for the search.` },
			search_in_folder: { description: 'Optional. Only search files in this given folder glob.' },
			is_regex: { description: 'Optional. Default is false. Whether query is a regex.' },
			...paginationParam,
		},
	},

	// --- editing (create/delete) ---

	create_file_or_folder: {
		name: 'create_file_or_folder',
		description: `Create a file or folder at the given path. To create a folder, ensure the path ends with a trailing slash.`,
		params: {
			...uriParam('file or folder'),
		},
	},

	delete_file_or_folder: {
		name: 'delete_file_or_folder',
		description: `Delete a file or folder at the given path.`,
		params: {
			...uriParam('file or folder'),
			params: { description: 'Optional. Return -r here to delete recursively.' }
		},
	},

	edit_file: { // APPLY TOOL
		name: 'edit_file',
		description: `Edits the contents of a file given the file's URI and a description.`,
		params: {
			...uriParam('file'),
			change_description: {
				description: `\
A brief code description of the change you want to make, with comments like "// ... existing code ..." to condense your writing. \
NEVER re-write the whole file. Instead, use comments like  "// ... existing code ...". Bias towards writing as little as possible. \
Your description will be handed to a smaller model to make the change, so it must be clear and concise. \
Your description MUST be wrapped in triple backticks. \
Here's an example of a good description:\n${editToolDescriptionExample}`
			}
		},
	},

	run_terminal_command: {
		name: 'run_terminal_command',
		description: `Executes a terminal command.`,
		params: {
			command: { description: 'The terminal command to execute.' },
			wait_for_completion: { description: `Optional. Default is true. Make this value false when you want a command to run without waiting for it to complete.` },
			terminal_id: { description: 'Optional. The ID of the terminal instance that should execute the command (if not provided, defaults to the preferred terminal ID). The primary purpose of this is to let you open a new terminal for testing or background processes (e.g. running a dev server for the user in a separate terminal). Must be an integer >= 1.' },
		},
	},

	// go_to_definition
	// go_to_usages

} satisfies { [name: string]: InternalToolInfo }


export type ToolName = keyof typeof voidTools
export const toolNames = Object.keys(voidTools) as ToolName[]

type ToolParamNameOfTool<T extends ToolName> = keyof (typeof voidTools)[T]['params']
export type ToolParamName = { [T in ToolName]: ToolParamNameOfTool<T> }[ToolName]

const toolNamesSet = new Set<string>(toolNames)

export const isAToolName = (toolName: string): toolName is ToolName => {
	const isAToolName = toolNamesSet.has(toolName)
	return isAToolName
}

export const availableTools = (chatMode: ChatMode) => {
	const toolNames: ToolName[] | undefined = chatMode === 'normal' ? undefined
		: chatMode === 'gather' ? (Object.keys(voidTools) as ToolName[]).filter(toolName => !toolNamesThatRequireApproval.has(toolName))
			: chatMode === 'agent' ? Object.keys(voidTools) as ToolName[]
				: undefined

	const tools: InternalToolInfo[] | undefined = toolNames?.map(toolName => voidTools[toolName])
	return tools
}

const availableXMLToolsStr = (tools: InternalToolInfo[]) => {
	return `${tools.map((t, i) => {
		const params = Object.keys(t.params).map(paramName => `<${paramName}>${t.params[paramName].description}</${paramName}>`).join('\n')
		return `\
${i + 1}. ${t.name}
Description: ${t.description}
Format:
<${t.name}>${!params ? '' : `\n${params}`}
</${t.name}>`
	}).join('\n\n')}`
}

export const toolCallXMLStr = (toolCall: RawToolCallObj) => {
	const t = toolCall
	const params = Object.keys(t.rawParams).map(paramName => `<${paramName}>${t.rawParams[paramName as ToolParamName]}</${paramName}>`).join('\n')
	return `\
<${toolCall.name}>${!params ? '' : `\n${params}`}
</${toolCall.name}>`
		.replace('\t', '  ')
}

/* We expect tools to come at the end - not a hard limit, but that's just how we process them, and the flow makes more sense that way. */
// - You are allowed to call multiple tools by specifying them consecutively. However, there should be NO text or writing between tool calls or after them.
const systemToolsXMLPrompt = (chatMode: ChatMode) => {
	const tools = availableTools(chatMode)
	if (!tools || tools.length === 0) return ''

	const toolXMLDefinitions = (`\
Available tools:

${availableXMLToolsStr(tools)}`)

	const toolCallXMLGuidelines = (`\
Tool calling details:
- Once you write a tool call, you must STOP and WAIT for the result.
- All parameters are REQUIRED unless noted otherwise.
- To call a tool, write its name and parameters in one of the XML formats specified above.
- You are only allowed to output ONE tool call, and it must be at the END of your response.
- Your tool call will be executed immediately, and the results will appear in the following user message.`)

	return `\
${toolXMLDefinitions}

${toolCallXMLGuidelines}`
}

// ======================================================== chat (normal, gather, agent) ========================================================


export const chat_systemMessage = ({ workspaceFolders, openedURIs, activeURI, runningTerminalIds, directoryStr, chatMode: mode }: { workspaceFolders: string[], directoryStr: string, openedURIs: string[], activeURI: string | undefined, runningTerminalIds: string[], chatMode: ChatMode }) => {
	const header = (`You are an expert coding ${mode === 'agent' ? 'agent' : 'assistant'} whose job is \
${mode === 'agent' ? `to help the user develop, run, and make changes to their codebase.`
			: mode === 'gather' ? `to search, understand, and reference files in the user's codebase.`
				: mode === 'normal' ? `to assist the user with their coding tasks.`
					: ''}
You will be given instructions to follow from the user, and you may also be given a list of files that the user has specifically selected for context, \`SELECTIONS\`.
Please assist the user with their query.`)



	const sysInfo = (`Here is the user's system information:
<system_info>
- ${os}

- Open workspaces:
${workspaceFolders.join('\n') || 'NO WORKSPACE OPEN'}

- Active file:
${activeURI}

- Open files:
${openedURIs.join('\n') || 'NO OPENED EDITORS'}${''/* separator */}${mode === 'agent' && runningTerminalIds.length !== 0 ? `

- Existing terminal IDs: ${runningTerminalIds.join(', ')}` : ''}
</system_info>`)


	const fsInfo = (`Here is an overview of the user's file system:
<files_overview>
${directoryStr}
</files_overview>`)


	const toolDefinitions = systemToolsXMLPrompt(mode)

	const details: string[] = []

	if (mode === 'agent' || mode === 'gather') {
		details.push(`Only call tools if they help you accomplish the user's goal. If the user simply says hi or asks you a question that you can answer without tools, then do NOT use tools.`)
		details.push('Only use ONE tool call at a time, and always wait for the result before proceeding.') // XML
		details.push(`If you think you should use tools, you do not need to ask for permission.`)
		details.push(`NEVER say something like "I'm going to use \`tool_name\`". Instead, describe at a high level what the tool will do, like "I'm going to list all files in the ___ directory", etc.`)
		details.push(`Many tools only work if the user has a workspace open.`)
	}
	else {
		details.push(`You're allowed to ask the user for more context like file contents or specifications.`)
	}

	if (mode === 'agent') {
		details.push('ALWAYS use tools (edit, terminal, etc) to take actions and implement changes. For example, if you would like to edit a file, you MUST use a tool.')
		details.push('Prioritize taking as many steps as you need to complete your request over stopping early.')
		details.push(`You will OFTEN need to gather context before making a change. Do not immediately make a change unless you have ALL relevant context.`)
		details.push(`ALWAYS have maximal certainty in a change BEFORE you make it. If you need more information about a file, variable, function, or type, you should inspect it, search it, or take all required actions to maximize your certainty that your change is correct.`)
		details.push(`NEVER modify a file outside the user's workspace(s) without permission from the user.`)
	}

	if (mode === 'gather') {
		details.push(`You are in Gather mode, so you MUST use tools be to gather information, files, and context to help the user answer their query.`)
		details.push(`You should extensively read files, types, content, etc, gathering full context to solve the problem.`)
	}


	if (mode === 'gather' || mode === 'normal') {
		details.push(`If you write any code blocks, please use this format:
- The first line of the code block must be the FULL PATH of the related file if known (otherwise omit).
- The remaining contents of the file should proceed as usual.`)

		details.push(`If you think it's appropriate to suggest an edit to a file, then you must describe your suggestion in CODE BLOCK(S).
- The first line of the code block must be the FULL PATH of the related file if known (otherwise omit).
- The remaining contents should be \
a brief code description of the change you want to make, with comments like "// ... existing code ..." to condense your writing. \
NEVER re-write the whole file. Instead, use comments like  "// ... existing code ...". Bias towards writing as little as possible. \
Here's an example of a good edit suggestion:
${fileNameEditExample}.`)
	}

	details.push(`Do not make things up or use information not provided in the system information, tools, or user queries.`)
	details.push(`Today's date is ${new Date().toDateString()}.`)

	const importantDetails = (`Important notes:
${details.map((d, i) => `${i + 1}. ${d}`).join('\n\n')}`)


	// return answer
	const ansStrs: string[] = []
	ansStrs.push(header)
	ansStrs.push(sysInfo)
	ansStrs.push(fsInfo)
	if (toolDefinitions) ansStrs.push(toolDefinitions)
	ansStrs.push(importantDetails)
	ansStrs.push('Now, please assist the user with their query.')

	const fullSystemMsgStr = ansStrs
		.join('\n\n\n')
		.trim()
		.replace('\t', '  ')

	return fullSystemMsgStr

}


// // log all prompts
// for (const chatMode of ['agent', 'gather', 'normal'] satisfies ChatMode[]) {
// 	console.log(`========================================= SYSTEM MESSAGE FOR ${chatMode} ===================================\n`,
// 		chat_systemMessage({ chatMode, workspaceFolders: [], openedURIs: [], activeURI: 'pee', runningTerminalIds: [], directoryStr: 'lol', }))
// }


export const chat_userMessageContent = async (instructions: string, currSelns: StagingSelectionItem[] | null,
	opts: { type: 'references' } | { type: 'fullCode', voidModelService: IVoidModelService }
) => {

	const lineNumAddition = (range: [number, number]) => ` (lines ${range[0]}:${range[1]})`
	let selnsStrs: string[] = []
	if (opts.type === 'references') {
		selnsStrs = currSelns?.map((s) => {
			if (s.type === 'File') return `${s.uri.fsPath}`
			if (s.type === 'CodeSelection') return `${s.uri.fsPath}${lineNumAddition(s.range)}`
			if (s.type === 'Folder') return `${s.uri.fsPath}/`
			return ''
		}) ?? []
	}
	if (opts.type === 'fullCode') {
		selnsStrs = await Promise.all(currSelns?.map(async (s) => {
			if (s.type === 'File' || s.type === 'CodeSelection') {
				const voidModelService = opts.voidModelService
				const { model } = await voidModelService.getModelSafe(s.uri)
				if (!model) return ''
				const val = model.getValue(EndOfLinePreference.LF)

				const lineNumAdd = s.type === 'CodeSelection' ? lineNumAddition(s.range) : ''
				const str = `${s.uri.fsPath}${lineNumAdd}\n${tripleTick[0]}${s.language}\n${val}\n${tripleTick[1]}`
				return str
			}
			if (s.type === 'Folder') {
				// TODO
				return ''
			}
			return ''
		}) ?? [])
	}

	const selnsStr = selnsStrs.join('\n') ?? ''
	let str = ''
	str += `${instructions}`
	if (selnsStr) str += `\n---\nSELECTIONS\n${selnsStr}`
	return str;
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







// const toAnthropicTool = (toolInfo: InternalToolInfo) => {
// 	const { name, description, params } = toolInfo
// 	return {
// 		name: name,
// 		description: description,
// 		input_schema: {
// 			type: 'object',
// 			properties: params,
// 			// required: Object.keys(params),
// 		},
// 	} satisfies Anthropic.Messages.Tool
// }


// const toOpenAICompatibleTool = (toolInfo: InternalToolInfo) => {
// 	const { name, description, params } = toolInfo
// 	return {
// 		type: 'function',
// 		function: {
// 			name: name,
// 			// strict: true, // strict mode - https://platform.openai.com/docs/guides/function-calling?api-mode=chat
// 			description: description,
// 			parameters: {
// 				type: 'object',
// 				properties: params,
// 				// required: Object.keys(params), // in strict mode, all params are required and additionalProperties is false
// 				// additionalProperties: false,
// 			},
// 		}
// 	} satisfies OpenAI.Chat.Completions.ChatCompletionTool
// }


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
