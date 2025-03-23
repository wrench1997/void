/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { JSX, useMemo, useState } from 'react'
import { marked, MarkedToken, Token } from 'marked'

import { convertToVscodeLang, detectLanguage } from '../../../../common/helpers/languageHelpers.js'
import { BlockCodeApplyWrapper } from './ApplyBlockHoverButtons.js'
import { useAccessor } from '../util/services.js'
import { ScrollType } from '../../../../../../../editor/common/editorCommon.js'
import { URI } from '../../../../../../../base/common/uri.js'
import { isAbsolute } from '../../../../../../../base/common/path.js'
import { separateOutFirstLine } from '../../../../common/helpers/util.js'
import { BlockCode } from '../util/inputs.js'


export type ChatMessageLocation = {
	threadId: string;
	messageIdx: number;
}

type ApplyBoxLocation = ChatMessageLocation & { tokenIdx: string }

export const getApplyBoxId = ({ threadId, messageIdx, tokenIdx }: ApplyBoxLocation) => {
	return `${threadId}-${messageIdx}-${tokenIdx}`
}

function isValidUri(s: string): boolean {
	return s.length > 5 && isAbsolute(s) && !s.includes('//') && !s.includes('/*') // common case that is a false positive is comments like //
}

const Codespan = ({ text, className, onClick }: { text: string, className?: string, onClick?: () => void }) => {

	// TODO compute this once for efficiency. we should use `labels.ts/shorten` to display duplicates properly

	return <code
		className={`font-mono font-medium rounded-sm bg-void-bg-1 px-1 ${className}`}
		onClick={onClick}
	>
		{text}
	</code>

}

const CodespanWithLink = ({ text, rawText, chatMessageLocation }: { text: string, rawText: string, chatMessageLocation: ChatMessageLocation }) => {

	const accessor = useAccessor()

	const chatThreadService = accessor.get('IChatThreadService')
	const commandService = accessor.get('ICommandService')
	const editorService = accessor.get('ICodeEditorService')

	const { messageIdx, threadId } = chatMessageLocation

	const [didComputeCodespanLink, setDidComputeCodespanLink] = useState<boolean>(false)

	let link = undefined
	if (rawText.endsWith("`")) { // if codespan was completed

		// get link from cache
		link = chatThreadService.getCodespanLink({ codespanStr: text, messageIdx, threadId })

		if (link === undefined) {
			// if no link, generate link and add to cache
			(chatThreadService.generateCodespanLink({ codespanStr: text, threadId })
				.then(link => {
					chatThreadService.addCodespanLink({ newLinkText: text, newLinkLocation: link, messageIdx, threadId })
					setDidComputeCodespanLink(true) // rerender
				})
			)
		}

	}


	const onClick = () => {

		if (!link) return;
		const selection = link.selection

		// open the file
		commandService.executeCommand('vscode.open', link.uri).then(() => {

			// select the text
			setTimeout(() => {
				if (!selection) return;

				const editor = editorService.getActiveCodeEditor()
				if (!editor) return;

				editor.setSelection(selection)
				editor.revealRange(selection, ScrollType.Immediate)

			}, 50) // needed when document was just opened and needs to initialize

		})

	}

	return <Codespan
		// text={link?.displayText || text}
		text={link?.displayText || text}
		onClick={onClick}
		className={link ? 'underline hover:brightness-90 transition-all duration-200 cursor-pointer' : ''}
	/>
}


export type RenderTokenOptions = { isApplyEnabled?: boolean, isLinkDetectionEnabled?: boolean }
const RenderToken = ({ token, inPTag, codeURI, chatMessageLocation, tokenIdx, ...options }: { token: Token | string, inPTag?: boolean, codeURI?: URI, chatMessageLocation?: ChatMessageLocation, tokenIdx: string, } & RenderTokenOptions): React.ReactNode => {
	const accessor = useAccessor()
	const languageService = accessor.get('ILanguageService')

	// deal with built-in tokens first (assume marked token)
	const t = token as MarkedToken

	if (t.raw.trim() === '') {
		return null;
	}

	if (t.type === "space") {
		return <span>{t.raw}</span>
	}

	if (t.type === "code") {
		const [firstLine, remainingContents] = separateOutFirstLine(t.text)
		const firstLineIsURI = isValidUri(firstLine) && !codeURI
		const contents = firstLineIsURI ? (remainingContents?.trimStart() || '') : t.text // exclude first-line URI from contents

		if (!contents) return null

		// figure out langauge and URI
		let uri: URI | null
		let language: string
		if (codeURI) {
			uri = codeURI
		}
		else if (firstLineIsURI) { // get lang from the uri in the first line of the markdown
			uri = URI.file(firstLine)
		}
		else {
			uri = null
		}

		if (t.lang) { // a language was provided. empty string is common so check truthy, not just undefined
			language = convertToVscodeLang(languageService, t.lang) // convert markdown language to language that vscode recognizes (eg markdown doesn't know bash but it does know shell)
		}
		else { // no language provided - fallback - get lang from the uri and contents
			language = detectLanguage(languageService, { uri, fileContents: contents })
		}

		if (options.isApplyEnabled && chatMessageLocation) {
			const isCodeblockClosed = t.raw.trimEnd().endsWith('```') // user should only be able to Apply when the code has been closed (t.raw ends with "```")

			const applyBoxId = getApplyBoxId({
				threadId: chatMessageLocation.threadId,
				messageIdx: chatMessageLocation.messageIdx,
				tokenIdx: tokenIdx,
			})
			return <BlockCodeApplyWrapper
				canApply={isCodeblockClosed}
				applyBoxId={applyBoxId}
				initValue={contents}
				language={language}
				uri={uri || 'current'}
			>
				<BlockCode
					initValue={contents}
					language={language}
				/>
			</BlockCodeApplyWrapper>
		}

		return <BlockCode
			initValue={contents}
			language={language}
		/>
	}

	if (t.type === "heading") {

		const HeadingTag = `h${t.depth}` as keyof JSX.IntrinsicElements

		return <HeadingTag>
			<ChatMarkdownRender chatMessageLocation={chatMessageLocation} string={t.text} inPTag={true} codeURI={codeURI} {...options} />
		</HeadingTag>
	}

	if (t.type === "table") {
		return (
			<div>
				<table>
					<thead>
						<tr>
							{t.header.map((cell: any, index: number) => (
								<th key={index}>
									{cell.raw}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{t.rows.map((row: any[], rowIndex: number) => (
							<tr key={rowIndex}>
								{row.map((cell: any, cellIndex: number) => (
									<td key={cellIndex} >
										{cell.raw}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		)
		// return (
		// 	<div>
		// 		<table className={"min-w-full border border-void-bg-2"}>
		// 			<thead>
		// 				<tr className="bg-void-bg-1">
		// 					{t.header.map((cell: any, index: number) => (
		// 						<th
		// 							key={index}
		// 							className="px-4 py-2 border border-void-bg-2 font-semibold"
		// 							style={{ textAlign: t.align[index] || "left" }}
		// 						>
		// 							{cell.raw}
		// 						</th>
		// 					))}
		// 				</tr>
		// 			</thead>
		// 			<tbody>
		// 				{t.rows.map((row: any[], rowIndex: number) => (
		// 					<tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-void-bg-1'}>
		// 						{row.map((cell: any, cellIndex: number) => (
		// 							<td
		// 								key={cellIndex}
		// 								className={"px-4 py-2 border border-void-bg-2"}
		// 								style={{ textAlign: t.align[cellIndex] || "left" }}
		// 							>
		// 								{cell.raw}
		// 							</td>
		// 						))}
		// 					</tr>
		// 				))}
		// 			</tbody>
		// 		</table>
		// 	</div>
		// )
	}

	if (t.type === "hr") {
		return <hr />
	}

	if (t.type === "blockquote") {
		return <blockquote>{t.text}</blockquote>
	}

	if (t.type === 'list_item') {
		return <li>
			<input type="checkbox" checked={t.checked} readOnly />
			<span>
				<ChatMarkdownRender chatMessageLocation={chatMessageLocation} string={t.text} inPTag={true} codeURI={codeURI} {...options} />
			</span>
		</li>
	}

	if (t.type === "list") {
		const ListTag = t.ordered ? "ol" : "ul"

		return (
			<ListTag start={t.start ? t.start : undefined}>
				{t.items.map((item, index) => (
					<li key={index}>
						{item.task && (
							<input type="checkbox" checked={item.checked} readOnly />
						)}
						<span>
							<ChatMarkdownRender chatMessageLocation={chatMessageLocation} string={item.text} inPTag={true} {...options} />
						</span>
					</li>
				))}
			</ListTag>
		)
	}

	if (t.type === "paragraph") {
		const contents = <>
			{t.tokens.map((token, index) => (
				<RenderToken key={index}
					token={token}
					tokenIdx={`${tokenIdx ? `${tokenIdx}-` : ''}${index}`} // assign a unique tokenId to inPTag components
					chatMessageLocation={chatMessageLocation}
					inPTag={true}
					{...options}
				/>
			))}
		</>

		if (inPTag) return <span className='block'>{contents}</span>
		return <p>{contents}</p>
	}

	if (t.type === "html") {
		const contents = t.raw
		if (inPTag) return <span className='block'>{contents}</span>
		return <p>{contents}</p>
	}

	if (t.type === "text" || t.type === "escape") {
		return <span>{t.raw}</span>
	}

	if (t.type === "def") {
		return <></> // Definitions are typically not rendered
	}

	if (t.type === "link") {
		return (
			<a
				onClick={() => { window.open(t.href) }}
				href={t.href}
				title={t.title ?? undefined}
				className='underline cursor-pointer hover:brightness-90 transition-all duration-200'
			>
				{t.text}
			</a>
		)
	}

	if (t.type === "image") {
		return <img
			src={t.href}
			alt={t.text}
			title={t.title ?? undefined}

		/>
	}

	if (t.type === "strong") {
		return <strong>{t.text}</strong>
	}

	if (t.type === "em") {
		return <em>{t.text}</em>
	}

	// inline code
	if (t.type === "codespan") {

		if (options.isLinkDetectionEnabled && chatMessageLocation) {
			return <CodespanWithLink
				text={t.text}
				rawText={t.raw}
				chatMessageLocation={chatMessageLocation}
			/>

		}

		return <Codespan text={t.text} />
	}

	if (t.type === "br") {
		return <br />
	}

	// strikethrough
	if (t.type === "del") {
		return <del>{t.text}</del>
	}
	// default
	return (
		<div className="bg-orange-50 rounded-sm overflow-hidden p-2">
			<span className="text-sm text-orange-500">Unknown token rendered...</span>
		</div>
	)
}


export const ChatMarkdownRender = ({ string, inPTag = false, chatMessageLocation, ...options }: { string: string, inPTag?: boolean, codeURI?: URI, chatMessageLocation: ChatMessageLocation | undefined } & RenderTokenOptions) => {
	const tokens = marked.lexer(string); // https://marked.js.org/using_pro#renderer
	return (
		<>
			{tokens.map((token, index) => (
				<RenderToken key={index} token={token} inPTag={inPTag} chatMessageLocation={chatMessageLocation} tokenIdx={index + ''} {...options} />
			))}
		</>
	)
}

