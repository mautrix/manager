import { BaseAPIClient } from "./baseclient"
import {
	ReqLogin,
	RespLogin,
	RespLoginFlows,
	RespOpenIDToken,
	RespVersions,
	RespWhoami,
} from "../types/matrix"

const mxcRegex = /^mxc:\/\/([^/]+?)\/([a-zA-Z0-9_-]+)$/

type OpenIDTokenCache = RespOpenIDToken & {
	expires_at: number
}

export class MatrixClient extends BaseAPIClient {
	private openIDTokenCache: Promise<OpenIDTokenCache> | undefined

	constructor(
		baseURL: string,
		userID?: string,
		token?: string,
	) {
		super(baseURL, "/_matrix/client", userID, token)
	}

	versions(): Promise<RespVersions> {
		return this.request("GET", "/versions")
	}

	whoami(): Promise<RespWhoami> {
		return this.request("GET", "/v3/account/whoami")
	}

	get hasToken(): boolean {
		return !!this.staticToken
	}

	get ssoRedirectURL(): string {
		let redirectURL: string
		if (window.mautrixAPI.isDevBuild) {
			const wrappedRedirectURL = new URL(window.location.toString())
			wrappedRedirectURL.hash = ""
			wrappedRedirectURL.search = ""
			redirectURL = wrappedRedirectURL.toString()
		} else {
			redirectURL = "mautrix-manager://sso"
		}
		const url = new URL(this.baseURL)
		url.pathname = `${url.pathname}${this.pathPrefix}/v3/login/sso/redirect`
		url.searchParams.set("redirectUrl", redirectURL)
		return url.toString()
	}

	getMediaURL(mxc: string): string {
		const [, server, mediaID] = mxc.match(mxcRegex) ?? []
		if (!server || !mediaID) {
			throw new Error("Invalid mxc URL")
		}
		const url = new URL(this.baseURL)
		url.pathname = `${url.pathname}${this.pathPrefix}/v1/media/download/${server}/${mediaID}`
		return url.toString()
	}

	getLoginFlows(): Promise<RespLoginFlows> {
		return this.request("GET", "/v3/login")
	}

	login(req: ReqLogin): Promise<RespLogin> {
		return this.request("POST", "/v3/login", req)
	}

	logout(): Promise<Record<string, never>> {
		return this.request("POST", "/v3/logout", {})
	}

	async getCachedOpenIDToken(): Promise<string> {
		const cache = await this.openIDTokenCache
		if (cache && cache.expires_at > Date.now()) {
			return cache.access_token
		}
		this.openIDTokenCache = this.getOpenIDToken().then(resp => ({
			...resp,
			access_token: `openid:${resp.access_token}`,
			expires_at: Date.now() + (resp.expires_in / 60 * 59000),
		}), err => {
			console.error("Failed to get OpenID token", err)
			this.openIDTokenCache = undefined
			throw err
		})
		return this.openIDTokenCache.then(res => res.access_token)
	}

	getOpenIDToken(): Promise<RespOpenIDToken> {
		return this.request("POST", `/v3/user/${this.userID}/openid/request_token`, {})
	}
}
