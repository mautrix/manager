import https from "https"
import { Socket } from "net"
import path from "path"
import { BrowserWindow, app, ipcMain, net, shell } from "electron"
import started from "electron-squirrel-startup"
import type { AccessTokenChangedParams } from "./preload"
import type { LoginClientHTTPResponse } from "./types/loginstep.ts"
import { getSearch } from "./util/urlParse"
import "./webauthn.ts"
import "./webview.ts"

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
	app.quit()
}

let homeserverURL = ""
let accessToken = ""

ipcMain.handle("mautrix:access-token-changed", (_event, newDetails: AccessTokenChangedParams) => {
	homeserverURL = newDetails.homeserverURL
	accessToken = newDetails.accessToken
})

ipcMain.handle("mautrix:open-in-browser", (_event, url: string) => {
	if (!url.startsWith("https://")) {
		throw new Error("URL must start with https://")
	}
	return shell.openExternal(url)
})

ipcMain.handle("mautrix:client-websocket", (
	_event, tunnelURL: string, url: string, headers: Record<string, string>,
): Promise<LoginClientHTTPResponse> => {
	const makeTunnel = (socket: Socket, head: Buffer | null) => {
		socket.pause()
		console.log("Opening client websocket tunnel to", tunnelURL)
		const tunnel = new net.WebSocket(tunnelURL, {
			headers: {
				"Authorization": `Bearer ${accessToken}`,
			},
		})
		tunnel.binaryType = "nodebuffer"
		socket.on("data", data => {
			console.log("Client websocket upstream -> tunnel message", data.length)
			tunnel.send(data)
		})
		tunnel.onmessage = (msg: MessageEvent) => {
			console.log("Client websocket tunnel -> upstream message", msg.data.length)
			socket.write(msg.data)
		}
		tunnel.onopen = () => {
			console.log("Client websocket tunnel opened")
			if (head) {
				console.log("Sending", head.length, "initial bytes")
				tunnel.send(head)
				head = null
			}
			socket.resume()
		}
		tunnel.onerror = (err: Error) => {
			console.log("Client websocket tunnel errored", err)
			socket.destroy()
		}
		tunnel.onclose = () => {
			console.log("Client websocket tunnel closed")
			if (!socket.closed) {
				socket.end()
				socket.setTimeout(2000, () => socket.destroy())
			}
		}
		const closeTunnel = (err?: Error) => {
			console.log("Client websocket upstream closed", err)
			if (tunnel.readyState !== WebSocket.CLOSED && tunnel.readyState !== WebSocket.CLOSING) {
				tunnel.close()
			}
		}
		socket.on("close", closeTunnel)
		socket.on("error", closeTunnel)
	}
	return new Promise<LoginClientHTTPResponse>((resolve, reject) => {
		console.log("Opening client websocket to", url, "with headers", headers)
		const wsReq = https.request(url, { headers })
		wsReq.on("upgrade", (res, socket, head) => {
			console.log("Client websocket upstream opened successfully", res.statusCode, headers)
			resolve({
				status_code: res.statusCode ?? 101,
				headers: Object.fromEntries(Object.entries(res.headers).map(([name, value]) => {
					if (value == undefined) {
						value = [""]
					} else if (typeof value === "string") {
						value = [value]
					}
					return [name, value]
				})),
			})
			makeTunnel(socket, head)
		})
		wsReq.on("error", err => {
			console.log("Client websocket upstream errored", err)
			reject(err)
		})
		wsReq.end()
	})
})

ipcMain.handle("mautrix:client-http", async (
	_event, url: string, init: Parameters<typeof fetch>[1],
): Promise<LoginClientHTTPResponse> => {
	console.log("Sending client HTTP request", init?.method, url)
	const resp = await fetch(url, init)
	console.log("Got response", resp.status, "to", url)
	return {
		status_code: resp.status,
		headers: Object.fromEntries(resp.headers.entries().map(([key, value]) => [key, [value]])),
		body: new Uint8Array(await resp.arrayBuffer()).toBase64(),
		final_url: resp.url,
	}
})

let mainWindow: BrowserWindow | undefined

function loadIndexPage(search?: string) {
	if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
		if (search) {
			search = `?${search}`
		}
		return mainWindow!.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}${search || ""}`)
	} else {
		return mainWindow!.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`), {
			search,
		})
	}
}

const createWindow = () => {
	mainWindow = new BrowserWindow({
		width: MAIN_WINDOW_VITE_DEV_SERVER_URL ? 1600 : 1280,
		height: 800,
		autoHideMenuBar: true,
		icon: "icon.png",
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
		},
	})

	mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
		if (
			details.resourceType !== "image" ||
			!details.url.startsWith(`${homeserverURL}/_matrix/client/v1/media/download/`)
		) {
			callback({})
			return
		}
		callback({
			requestHeaders: {
				...details.requestHeaders,
				Authorization: `Bearer ${accessToken}`,
			},
		})
	})

	loadIndexPage()
	if (process.env.NODE_ENV === "development") {
		mainWindow.webContents.openDevTools()
	}
}

if (process.defaultApp) {
	if (process.argv.length >= 2) {
		app.setAsDefaultProtocolClient("mautrix-manager", process.execPath, [path.resolve(process.argv[1])])
	}
} else {
	app.setAsDefaultProtocolClient("mautrix-manager")
}

if (!app.requestSingleInstanceLock()) {
	app.quit()
} else {
	app.on("second-instance", (_event, commandLine) => {
		if (mainWindow) {
			if (mainWindow.isMinimized()) {mainWindow.restore()}
			mainWindow.focus()
		}

		const arg = commandLine.pop()
		const search = getSearch(arg)
		if (search){
			loadIndexPage(search)
		}
	})

	app.on("window-all-closed", () => {
		mainWindow = undefined
		if (process.platform !== "darwin") {
			app.quit()
		}
	})

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow()
		}
	})
	app.whenReady().then(createWindow)

	app.on("open-url", (_event, url) => {
		const search = getSearch(url)
		if (search){
			loadIndexPage(search)
		}
	})
}
