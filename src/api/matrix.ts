import { BaseAPIClient } from "./base"
import { ReqLogin, RespLogin, RespLoginFlows, RespVersions, RespWhoami } from "../types/matrix"

const mxcRegex = /^mxc:\/\/([^/]+?)\/([a-zA-Z0-9_-]+)$/

export class MatrixClient extends BaseAPIClient {
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

	get ssoRedirectURL(): string {
		const redirectURL = new URL(window.location.toString())
		redirectURL.hash = ""
		redirectURL.search = ""
		const url = new URL(this.baseURL)
		url.pathname = `${url.pathname}${this.pathPrefix}/v3/login/sso/redirect`
		url.searchParams.set("redirectUrl", redirectURL.toString())
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
}
