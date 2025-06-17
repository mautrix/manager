import { app, BrowserWindow, ipcMain, shell } from "electron"
import path from "path"
import "./webview.ts"
import type { AccessTokenChangedParams } from "./preload"
import { getSearch } from "./util/urlParse"

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
	app.quit()
}

let homeserverURL = ""
let accessToken = ""

ipcMain.handle("mautrix:access-token-changed", (event, newDetails: AccessTokenChangedParams) => {
	homeserverURL = newDetails.homeserverURL
	accessToken = newDetails.accessToken
})

ipcMain.handle("mautrix:open-in-browser", (event, url: string) => {
	if (!url.startsWith("https://")) {
		throw new Error("URL must start with https://")
	}
	return shell.openExternal(url)
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

	// Force-allow cross-origin requests, particularly for development mode,
	// where the file is served from localhost
	mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
		const responseHeaders = details.responseHeaders || {};
		responseHeaders["access-control-allow-origin"] = ["*"]
		callback({
			responseHeaders,
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
	app.on("second-instance", (event, commandLine, workingDirectory) => {
		if (mainWindow) {
			if (mainWindow.isMinimized()) mainWindow.restore()
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

	app.on("open-url", (event, url) => {
		const search = getSearch(url)
		if (search){
			loadIndexPage(search)
		}
	})
}
