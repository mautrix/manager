import { contextBridge, ipcRenderer } from "electron"
import type { LoginCookieOutput, LoginCookiesParams } from "./types/loginstep"

export interface AccessTokenChangedParams {
	homeserverURL: string
	accessToken: string
}

contextBridge.exposeInMainWorld("mautrixAPI", {
	openWebview: (params: LoginCookiesParams) =>
		ipcRenderer.invoke("mautrix:open-webview", params),
	closeWebview: () => ipcRenderer.invoke("mautrix:close-webview"),
	accessTokenChanged: (newDetails: AccessTokenChangedParams) =>
		ipcRenderer.invoke("mautrix:access-token-changed", newDetails),
	openInBrowser: (url: string) => ipcRenderer.invoke("mautrix:open-in-browser", url),
	isDevBuild: process.env.NODE_ENV === "development",
})

declare global {
	interface Window {
		mautrixAPI: {
			openWebview: (params: LoginCookiesParams) => Promise<{ cookies: LoginCookieOutput }>
			closeWebview: () => Promise<void>
			accessTokenChanged: (newDetails: AccessTokenChangedParams) => Promise<void>
			openInBrowser: (url: string) => Promise<void>
			isDevBuild: boolean,
		}
	}
}
ipcRenderer.invoke("mautrix:access-token-changed", {
	homeserverURL: localStorage.matrix_homeserver_url || "",
	accessToken: localStorage.access_token || "",
})
