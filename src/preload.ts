import { contextBridge, ipcRenderer } from "electron"
import type { LoginCookieOutput, LoginCookiesParams, LoginWebAuthnParams } from "./types/loginstep"

export interface AccessTokenChangedParams {
	homeserverURL: string
	accessToken: string
}

contextBridge.exposeInMainWorld("mautrixAPI", {
	openWebview: (params: LoginCookiesParams) =>
		ipcRenderer.invoke("mautrix:open-webview", params),
	closeWebview: () => ipcRenderer.invoke("mautrix:close-webview"),
	doWebAuthn: (params: LoginWebAuthnParams) =>
		ipcRenderer.invoke("mautrix:webauthn", params),
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
			doWebAuthn: (params: LoginWebAuthnParams) => Promise<AuthenticationResponseJSON>
			accessTokenChanged: (newDetails: AccessTokenChangedParams) => Promise<void>
			openInBrowser: (url: string) => Promise<void>
			isDevBuild: boolean,
		}
	}
}

ipcRenderer.on("mautrix:webauthn:cable-ui", (_event, args) => {
	window.dispatchEvent(new CustomEvent("mautrix:webauthn:cable-ui", { detail: args }))
})

ipcRenderer.invoke("mautrix:access-token-changed", {
	homeserverURL: localStorage.matrix_homeserver_url || "",
	accessToken: localStorage.access_token || "",
})
