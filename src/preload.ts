import { contextBridge, ipcRenderer } from "electron"
import type {
	LoginClientHTTPResponse,
	LoginCookieOutput,
	LoginCookiesParams,
	LoginWebAuthnParams,
} from "./types/loginstep"

export interface AccessTokenChangedParams {
	homeserverURL: string
	accessToken: string
}

interface MautrixAPI {
	openWebview: (params: LoginCookiesParams) => Promise<{ cookies: LoginCookieOutput }>
	closeWebview: () => Promise<void>
	doWebAuthn: (params: LoginWebAuthnParams) => Promise<AuthenticationResponseJSON>
	doClientHTTP: (...params: Parameters<typeof fetch>) => Promise<LoginClientHTTPResponse>,
	accessTokenChanged: (newDetails: AccessTokenChangedParams) => Promise<void>
	openInBrowser: (url: string) => Promise<void>
	isDevBuild: boolean,
}

const api: MautrixAPI = {
	openWebview: params => ipcRenderer.invoke("mautrix:open-webview", params),
	closeWebview: () => ipcRenderer.invoke("mautrix:close-webview"),
	doWebAuthn: params => ipcRenderer.invoke("mautrix:webauthn", params),
	doClientHTTP: (url, init) => ipcRenderer.invoke("mautrix:client-http", url, init),
	accessTokenChanged: newDetails => ipcRenderer.invoke("mautrix:access-token-changed", newDetails),
	openInBrowser: url => ipcRenderer.invoke("mautrix:open-in-browser", url),
	isDevBuild: process.env.NODE_ENV === "development",
}

contextBridge.exposeInMainWorld("mautrixAPI", api)

declare global {
	interface Window {
		mautrixAPI: MautrixAPI
	}
}

ipcRenderer.on("mautrix:webauthn:cable-ui", (_event, args) => {
	window.dispatchEvent(new CustomEvent("mautrix:webauthn:cable-ui", { detail: args }))
})

ipcRenderer.invoke("mautrix:access-token-changed", {
	homeserverURL: localStorage.matrix_homeserver_url || "",
	accessToken: localStorage.access_token || "",
})
