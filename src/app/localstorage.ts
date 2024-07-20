import type { RespWhoami } from "../types/whoami"
import type { Credentials } from "./AuthWrap"

type BridgeStore = Record<string, RespWhoami | null>

export default class TypedLocalStorage {
	static get bridges(): BridgeStore {
		const cache = localStorage.bridges
		if (!cache) {
			return {}
		}
		return JSON.parse(cache)
	}

	static set bridges(bridges: BridgeStore) {
		localStorage.bridges = JSON.stringify(bridges)
	}

	static get homeserverURL(): string {
		return localStorage.matrix_homeserver_url ?? ""
	}

	static set homeserverURL(url: string) {
		localStorage.matrix_homeserver_url = url
		this.updateElectron()
	}

	static get credentials(): Credentials | null {
		const creds = {
			user_id: localStorage.user_id,
			access_token: localStorage.access_token,
		}
		if (creds.user_id && creds.access_token) {
			return creds
		}
		return null
	}

	static set credentials(creds: Credentials | null) {
		if (creds === null) {
			delete localStorage.user_id
			delete localStorage.access_token
		} else {
			localStorage.user_id = creds.user_id
			localStorage.access_token = creds.access_token
		}
		this.updateElectron()
	}

	private static updateElectron() {
		window.mautrixAPI.accessTokenChanged({
			accessToken: this.credentials?.access_token ?? "",
			homeserverURL: this.homeserverURL,
		})
	}
}
