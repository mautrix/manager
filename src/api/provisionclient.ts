import type { RespLoginFlows, RespLogout, RespSubmitLogin } from "../types/login"
import type { RespGetContactList, RespResolveIdentifier, RespStartChat } from "../types/startchat"
import type { RespWhoami } from "../types/whoami"
import { BaseAPIClient } from "./baseclient"
import { LoginClient } from "./loginclient"
import type { MatrixClient } from "./matrixclient"

export class ProvisioningClient extends BaseAPIClient {
	declare readonly userID: string

	constructor(
		baseURL: string,
		readonly matrixClient: MatrixClient,
		readonly external: boolean,
		loginID?: string,
	) {
		if (!matrixClient.userID) {
			throw new Error("MatrixClient must be logged in")
		}
		super(baseURL, "/_matrix/provision", matrixClient.userID, undefined, loginID)
	}

	getToken(): Promise<string | undefined> {
		if (this.external) {
			return this.matrixClient?.getCachedOpenIDToken()
		} else {
			return this.matrixClient?.getToken()
		}
	}

	withLogin(loginID: string): ProvisioningClient {
		return new ProvisioningClient(this.baseURL, this.matrixClient, this.external, loginID)
	}

	getWebsocketTunnelURL(streamID: string): string {
		const url = new URL(this.baseURL)
		url.protocol = url.protocol === "http:" ? "ws" : "wss:"
		url.pathname = `${url.pathname}${this.pathPrefix}/v3/login/client_websocket/${this.loginID}/${streamID}`
		if (this.userID) {
			url.searchParams.set("user_id", this.userID)
		}
		return url.toString()
	}

	whoami(signal?: AbortSignal): Promise<RespWhoami> {
		return this.request("GET", "/v3/whoami", { signal })
	}

	getLoginFlows(): Promise<RespLoginFlows> {
		return this.request("GET", "/v3/login/flows")
	}

	async startLogin(flowID: string, refresh: () => void): Promise<LoginClient> {
		const resp: RespSubmitLogin = await this.request(
			"POST", `/v3/login/start/${encodeURIComponent(flowID)}`, {}, {
				query: { client_http: "1", client_websocket: "2" },
			},
		)
		return new LoginClient(this.withLogin(resp.login_id), resp, refresh)
	}

	logout(loginID: string | "all"): Promise<RespLogout> {
		return this.request("POST", `/v3/logout/${encodeURIComponent(loginID)}`, {})
	}

	getContacts(): Promise<RespGetContactList> {
		return this.request("GET", "/v3/contacts")
	}

	resolveIdentifier(identifier: string): Promise<RespResolveIdentifier> {
		return this.request("GET", `/v3/resolve_identifier/${encodeURIComponent(identifier)}`)
	}

	startChat(identifier: string): Promise<RespStartChat> {
		return this.request("POST", `/v3/create_dm/${encodeURIComponent(identifier)}`, {})
	}
}
