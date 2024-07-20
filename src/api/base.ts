import { APIError } from "./error"

export interface ExtraParams {
	signal?: AbortSignal
	pathPrefix?: string
}

export class BaseAPIClient {
	readonly baseURL: string
	readonly pathPrefix: string

	constructor(
		baseURL: string,
		pathPrefix: string,
		readonly userID?: string,
		readonly token?: string,
		readonly loginID?: string,
	) {
		if (!baseURL.endsWith("/")) {
			baseURL += "/"
		}
		if (pathPrefix.startsWith("/")) {
			pathPrefix = pathPrefix.slice(1)
		}
		if (pathPrefix.endsWith("/")) {
			pathPrefix = pathPrefix.slice(0, -1)
		}
		this.pathPrefix = pathPrefix
		this.baseURL = baseURL
	}

	async request<ResponseType>(
		method: "GET" | "HEAD",
		path: string,
		extraParams?: ExtraParams,
	): Promise<ResponseType>
	async request<ResponseType, RequestType>(
		method: "DELETE",
		path: string,
		reqData?: RequestType,
		extraParams?: ExtraParams,
	): Promise<ResponseType>
	async request<ResponseType, RequestType>(
		method: "POST" | "PUT",
		path: string,
		reqData: RequestType,
		extraParams?: ExtraParams,
	): Promise<ResponseType>

	async request<ResponseType, RequestType>(
		method: "GET" | "HEAD" | "DELETE" | "POST" | "PUT",
		path: string,
		reqData?: RequestType | ExtraParams,
		extraParams?: ExtraParams,
	): Promise<ResponseType> {
		if (method === "GET" || method === "HEAD") {
			reqData = extraParams
		}
		const reqParams: RequestInit & { headers: Record<string, string> } = {
			method,
			headers: {},
		}
		if (this.token) {
			reqParams.headers.Authorization = `Bearer ${this.token}`
		}
		if (reqData) {
			reqParams.body = JSON.stringify(reqData)
			reqParams.headers["Content-Type"] = "application/json"
		}
		const url = new URL(this.baseURL)
		url.pathname = `${url.pathname}${this.pathPrefix}${path}`
		if (this.userID) {
			url.searchParams.set("user_id", this.userID)
		}
		if (this.loginID && !path.startsWith("/v3/login/")) {
			url.searchParams.set("login_id", this.loginID)
		}
		const resp = await fetch(url.toString(), reqParams)
		let respData
		try {
			respData = await resp.json()
		} catch (err) {
			const text = await resp.text()
			if (resp.status >= 400) {
				console.error("Got non-OK status", resp.status, "with non-JSON response", text)
				throw new Error(`HTTP ${resp.status} ${resp.statusText}`)
			} else {
				console.error("Failed to parse JSON response", text)
				throw err
			}
		}
		if (respData.errcode) {
			console.error("Got API error", respData)
			throw new APIError(respData)
		} else if (respData.status >= 400) {
			console.error("Got non-OK status", resp.status, "with JSON response", respData)
			throw new Error(`HTTP ${respData.status} ${respData.statusText}`)
		}
		return respData
	}
}
