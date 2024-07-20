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
})

declare global {
	interface Window {
		mautrixAPI: {
			openWebview: (params: LoginCookiesParams) => Promise<{ cookies: LoginCookieOutput }>
			closeWebview: () => Promise<void>
			accessTokenChanged: (newDetails: AccessTokenChangedParams) => Promise<void>
		}
	}
}
ipcRenderer.invoke("mautrix:access-token-changed", {
	homeserverURL: localStorage.matrix_homeserver_url || "",
	accessToken: localStorage.access_token || "",
})
