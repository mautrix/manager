import {
	ipcMain,
	BrowserWindow,
	OnBeforeSendHeadersListenerDetails,
	BeforeSendResponse,
} from "electron"
import type {
	LoginCookieField,
	LoginCookieFieldSource,
	LoginCookieFieldSourceCookie,
	LoginCookieFieldSourceLocalStorage,
	LoginCookieFieldSourceRequest,
	LoginCookieOutput,
	LoginCookiesParams,
} from "./types/loginstep"

ipcMain.handle("mautrix:open-webview", (event, args: LoginCookiesParams) => {
	console.log("Received open webview request from", event.senderFrame.url)
	const parent = BrowserWindow.fromWebContents(event.sender)
	if (!parent) {
		throw new Error("No parent window found")
	}
	return new Promise<{ cookies: LoginCookieOutput }>((resolve, reject) => {
		try {
			openWebview(args, parent, resolve, reject)
		} catch (err) {
			reject(err)
		}
	})
})

ipcMain.handle("mautrix:close-webview", (event) => {
	closeWebview()
})

interface fieldWithSource<T extends LoginCookieFieldSource> {
	field: LoginCookieField
	source: T
}

interface requestFieldList {
	pattern: RegExp
	fields: fieldWithSource<LoginCookieFieldSourceRequest>[]
}

type onBeforeSendHeaders = (
	details: OnBeforeSendHeadersListenerDetails,
	callback: (params: BeforeSendResponse) => void,
) => void

type parsedRequestBody = { [key: string]: unknown }

const contentDispositionPattern = /Content-Disposition: form-data; name="(.+)"/

function parseMultipart(data: string, boundary: string): parsedRequestBody {
	const parts = data.split(`--${boundary}`)
	const output: parsedRequestBody = {}
	for (const part of parts) {
		if (!part) {
			continue
		} else if (part.trim() === "--") {
			break
		}
		const [headers, ...data] = part.split("\r\n\r\n")
		const name = headers.match(contentDispositionPattern)?.[1]
		if (name) {
			output[name] = data.join("\r\n").slice(0, -2)
		}
	}
	return output
}

function parseRequestBody(details: OnBeforeSendHeadersListenerDetails): parsedRequestBody | null {
	if (
		details.resourceType !== "xhr" ||
		details.method === "GET" ||
		details.method === "HEAD"
	) {
		return null
	}
	const contentType = details.requestHeaders["Content-Type"].split(";")[0]
	if (
		contentType !== "application/json" &&
		contentType !== "application/x-www-form-urlencoded" &&
		contentType !== "multipart/form-data"
	) {
		return null
	}
	const body = details.uploadData?.find((data) => data.bytes)
	if (!body) {
		return null
	}
	const bodyString = Buffer.from(body.bytes).toString("utf8")
	if (contentType === "application/json") {
		return JSON.parse(bodyString)
	} else if (contentType === "application/x-www-form-urlencoded") {
		return Object.fromEntries(new URLSearchParams(bodyString))
	} else if (contentType === "multipart/form-data") {
		const boundary = details.requestHeaders["Content-Type"].split("; boundary=")[1]
		return parseMultipart(bodyString, boundary)
	} else {
		return null
	}
}

interface parsedLoginCookiesParams {
	requiredFields: string[]
	cookiesByDomain: Map<string, fieldWithSource<LoginCookieFieldSourceCookie>[]>
	localStorageKeys: fieldWithSource<LoginCookieFieldSourceLocalStorage>[]
	requestKeysByPattern: Map<string, requestFieldList>
}

function parseLoginCookiesParams(args: LoginCookiesParams): parsedLoginCookiesParams {
	const requiredFields: string[] = []
	const cookiesByDomain: Map<string, fieldWithSource<LoginCookieFieldSourceCookie>[]> = new Map()
	const localStorageKeys: fieldWithSource<LoginCookieFieldSourceLocalStorage>[] = []
	const requestKeysByPattern: Map<string, requestFieldList> = new Map()
	for (const field of args.fields) {
		if (field.required) {
			requiredFields.push(field.id)
		}
		let hasAnySupported = false
		for (const source of field.sources) {
			switch (source.type) {
			case "cookie":
				if (!cookiesByDomain.has(source.cookie_domain)) {
					cookiesByDomain.set(source.cookie_domain, [])
				}
				cookiesByDomain.get(source.cookie_domain)!.push({ field, source })
				break
			case "local_storage":
				localStorageKeys.push({ field, source })
				break
			case "request_header":
			case "request_body":
				if (!requestKeysByPattern.has(source.request_url_regex)) {
					requestKeysByPattern.set(source.request_url_regex, {
						pattern: new RegExp(source.request_url_regex),
						fields: [],
					})
				}
				requestKeysByPattern.get(source.request_url_regex)!.fields.push({ field, source })
				break
			case "special":
				continue
			default:
				continue
			}
			hasAnySupported = true
		}
		if (!hasAnySupported) {
			throw new Error(`No supported sources for field ${field.id}`)
		}
	}
	return { requiredFields, cookiesByDomain, localStorageKeys, requestKeysByPattern }
}

function makeCookieWatcher(
	cookiesByDomain: Map<string, fieldWithSource<LoginCookieFieldSourceCookie>[]>,
	webview: BrowserWindow,
	output: LoginCookieOutput,
	checkIfAllFieldsPresent: () => void,
): (() => Promise<void>) | null {
	if (!cookiesByDomain.size) {
		return null
	}
	return async () => {
		let foundAny = false
		for (const [domain, fields] of cookiesByDomain) {
			const cookies = await webview.webContents.session.cookies.get({ domain })
			for (const { field, source } of fields) {
				const cookie = cookies.find(({ name }) => name === source.name)
				if (cookie) {
					foundAny = true
					output[field.id] = decodeURIComponent(cookie.value)
				}
			}
		}
		if (foundAny) {
			checkIfAllFieldsPresent()
		}
	}
}

function makeRequestWatcher(
	requestKeysByPattern: Map<string, requestFieldList>,
	output: LoginCookieOutput,
	checkIfAllFieldsPresent: () => void,
): onBeforeSendHeaders | null {
	if (!requestKeysByPattern.size) {
		return null
	}
	return (details, callback) => {
		let parsedRequestBody: parsedRequestBody | undefined | null
		const getRequestBody = () => {
			if (parsedRequestBody === undefined) {
				parsedRequestBody = parseRequestBody(details)
			}
			return parsedRequestBody
		}
		let foundAny = false
		for (const fieldList of requestKeysByPattern.values()) {
			if (!fieldList.pattern.test(details.url)) {
				continue
			}
			for (const { field, source } of fieldList.fields) {
				if (source.type == "request_header") {
					if (details.requestHeaders && source.name in details.requestHeaders) {
						output[field.id] = details.requestHeaders[source.name]
						foundAny = true
					}
				} else if (source.type == "request_body") {
					const value = getRequestBody()?.[source.name]
					if (value) {
						switch (typeof value) {
						case "string":
							output[field.id] = value
							break
						case "number":
							output[field.id] = value.toString()
							break
						case "boolean":
							output[field.id] = value ? "true" : "false"
							break
						case "undefined":
						default:
							continue
						}
						foundAny = true
					}
				}
			}
		}
		if (foundAny) {
			checkIfAllFieldsPresent()
		}
		callback({})
	}
}

function makeLocalStorageWatcher(
	localStorageKeys: fieldWithSource<LoginCookieFieldSourceLocalStorage>[],
	webview: BrowserWindow,
	output: LoginCookieOutput,
	checkIfAllFieldsPresent: () => void,
): (() => void) | null {
	if (!localStorageKeys.length) {
		return null
	}
	// NOTE: This function is stringified and executed inside the webview
	const watcher = (watchKeys: { [outputKey: string]: string }) => {
		return new Promise(resolve => {
			const output: {
				[key: string]: string | null
			} = Object.fromEntries(Object.keys(watchKeys).map(key => [key, null]))
			const origSetItem = window.localStorage.setItem.bind(localStorage)
			let checkInterval: number | undefined = undefined

			function lookForKeys() {
				let foundAll = true
				for (const [outputKey, localStorageKey] of Object.entries(watchKeys)) {
					output[outputKey] = localStorage.getItem(localStorageKey)
					if (!output[outputKey]) {
						foundAll = false
					}
				}
				if (foundAll) {
					if (checkInterval !== undefined) {
						window.clearInterval(checkInterval)
					}
					window.localStorage.setItem = origSetItem
					resolve(output)
				}
			}

			checkInterval = window.setInterval(lookForKeys, 3000)
			window.localStorage.setItem = (key: string, ...rest) => {
				if (key in watchKeys) {
					lookForKeys()
				}
				origSetItem.apply(localStorage, [key, ...rest])
			}
		})
	}
	const watchKeys = JSON.stringify(Object.fromEntries(localStorageKeys.map(({
		field,
		source,
	}) => [field.id, source.name])))
	return () => {
		webview.webContents
			.executeJavaScript(`(${watcher.toString()})(${watchKeys})`)
			.then((result) => {
				removeExtraPromiseFields(result)
				console.log("Local storage extract script returned")
				Object.assign(output, result)
				checkIfAllFieldsPresent()
			})
	}
}

let currentWebview: BrowserWindow | null = null

function closeWebview() {
	console.log("Closing webview by request")
	currentWebview?.destroy()
}

const extraPromiseFields = new Set([
	"_bitField",
	"_fulfillmentHandler0",
	"_rejectionHandler0",
	"_promise0",
	"_receiver0",
	"_settledValue",
])

function removeExtraPromiseFields(obj: Record<string, unknown>) {
	for (const key of Object.keys(obj)) {
		if (extraPromiseFields.has(key)) {
			delete obj[key]
		}
	}
}

function openWebview(
	args: LoginCookiesParams,
	parent: BrowserWindow,
	resolve: (output: { cookies: LoginCookieOutput }) => void,
	reject: (err: Error) => void,
) {
	const {
		requiredFields,
		cookiesByDomain,
		requestKeysByPattern,
		localStorageKeys,
	} = parseLoginCookiesParams(args)

	const webview = new BrowserWindow({
		parent,
		modal: true,
		webPreferences: {
			sandbox: true,
			// Create a new temporary session for each webview
			partition: Math.random().toString(),
		},
	})
	if (currentWebview) {
		console.warn("Closing previous webview")
		currentWebview.destroy()
	}
	currentWebview = webview
	const output: LoginCookieOutput = {}
	let resolved = false
	const checkIfAllFieldsPresent = () => {
		for (const field of requiredFields) {
			if (!(field in output)) {
				console.log("Still missing", field)
				return
			}
		}
		console.log("All fields found, resolving webview")
		resolved = true
		webview.close()
		resolve({ cookies: output })
	}
	const closeOnError = (err: Error) => {
		if (!resolved) {
			resolved = true
			webview.destroy()
			reject(err)
		}
	}

	const requestWatcher = makeRequestWatcher(
		requestKeysByPattern, output, checkIfAllFieldsPresent,
	)
	if (requestWatcher) {
		webview.webContents.session.webRequest.onBeforeSendHeaders(requestWatcher)
	}

	const cookieWatcher = makeCookieWatcher(
		cookiesByDomain, webview, output, checkIfAllFieldsPresent,
	)
	if (cookieWatcher) {
		webview.webContents.on("did-finish-load", cookieWatcher)
		webview.webContents.on("did-navigate-in-page", cookieWatcher)
	}

	const registerLocalStorageWatcher = makeLocalStorageWatcher(
		localStorageKeys, webview, output, checkIfAllFieldsPresent,
	)
	if (registerLocalStorageWatcher) {
		webview.webContents.on("did-finish-load", registerLocalStorageWatcher)
		// webview.webContents.on("did-navigate-in-page", registerLocalStorageWatcher)
	}

	if (args.extract_js) {
		const registerSpecialExtractJS = () => {
			webview.webContents.executeJavaScript(args.extract_js!).then((result) => {
				removeExtraPromiseFields(result)
				console.log("Special extract JS script returned")
				Object.assign(output, result)
				checkIfAllFieldsPresent()
			}, err => {
				console.error("Failed to execute extract_js", err)
				closeOnError(err)
			})
		}
		webview.webContents.on("did-finish-load", registerSpecialExtractJS)
	}

	webview.on("closed", () => {
		if (currentWebview === webview) {
			currentWebview = null
		}
		console.log("Webview closed")
		if (!resolved) {
			reject(new Error("Webview closed before all fields were found"))
		}
	})

	webview.webContents.setWindowOpenHandler((details) => {
		console.log("Overriding window open", details.url, "with a redirect")
		webview.webContents.executeJavaScript(`window.location = ${JSON.stringify(details.url)}`)
		return { action: "deny" }
	})
	webview.webContents.on("will-navigate", (evt, url) => {
		if (url.startsWith("slack://")) {
			console.log("Preventing slack:// navigation")
			evt.preventDefault()
		}
	})

	webview.loadURL(args.url, { userAgent: args.user_agent })
		.then(
			() => {
				console.log("Webview for", args.url, "loaded")
			},
			err => {
				console.error("Failed to load webview for", args.url, err)
				closeOnError(err)
			},
		)
}
