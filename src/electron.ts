import { app, BrowserWindow, ipcMain } from "electron"
import path from "path"
import "./webview.ts"
import type { AccessTokenChangedParams } from "./preload"

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

const createWindow = () => {
	const mainWindow = new BrowserWindow({
		width: 1280,
		height: 800,
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

	if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
	} else {
		mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
	}

	mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow)

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit()
	}
})

app.on("activate", () => {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow()
	}
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
