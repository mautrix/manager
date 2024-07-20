import type { RespWhoami } from "../types/whoami"
import type { RespLoginFlows, RespLogout, RespSubmitLogin } from "../types/login"
import type { LoginStepData } from "../types/loginstep"
import type { RespGetContactList, RespResolveIdentifier, RespStartChat } from "../types/startchat"
import { LoginClient } from "./login"
import { BaseAPIClient } from "./base"

export class ProvisioningClient extends BaseAPIClient {
	declare readonly token: string
	declare readonly userID: string

	constructor(
		baseURL: string,
		userID: string,
		token: string,
		loginID?: string,
	) {
		super( baseURL, "/_matrix/provision", userID, token, loginID)
	}

	withLogin(loginID: string): ProvisioningClient {
		return new ProvisioningClient(this.baseURL, this.userID, this.token, loginID)
	}

	whoami(signal?: AbortSignal): Promise<RespWhoami> {
		return this.request("GET", "/v3/whoami", { signal })
	}

	getLoginFlows(): Promise<RespLoginFlows> {
		return this.request("GET", "/v3/login/flows")
	}

	async startLogin(flowID: string, refresh: () => void): Promise<LoginClient> {
		const resp: RespSubmitLogin = await this.request(
			"POST", `/v3/login/start/${encodeURIComponent(flowID)}`, {},
		)
		return new LoginClient(this, resp, refresh)
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
