export type SpecVersion =
	"r0.0.0"
	| "r0.0.1"
	| "r0.1.0"
	| "r0.2.0"
	| "r0.3.0"
	| "r0.4.0"
	| "r0.5.0"
	| "r0.6.0"
	| "r0.6.1"
	| "v1.1"
	| "v1.2"
	| "v1.3"
	| "v1.4"
	| "v1.5"
	| "v1.6"
	| "v1.7"
	| "v1.8"
	| "v1.9"
	| "v1.10"
	| "v1.11"

export interface RespVersions {
	unstable_features: Record<string, boolean>
	versions: SpecVersion[]
}

export interface RespWhoami {
	user_id: string
	is_guest?: boolean
	device_id?: string
}

export interface RespOpenIDToken {
	access_token: string
	expires_in: number
	matrix_server_name: string
	token_type: "Bearer"
}

export interface LoginFlow {
	type: string
}

export interface RespLoginFlows {
	flows: LoginFlow[]
}

export interface UserIdentifier {
	type: "m.id.user"
	user: string
}

interface ReqLoginPassword {
	type: "m.login.password"
	identifier: UserIdentifier
	password: string
}

interface ReqLoginToken {
	type: "m.login.token"
	token: string
}

export type ReqLogin = ReqLoginPassword | ReqLoginToken

export interface RespClientWellKnown {
	"m.homeserver"?: {
		base_url?: string
	}
}

export interface RespMautrixWellKnown {
	"fi.mau.bridges"?: string[]
	"fi.mau.external_bridge_servers"?: string[]
}

export interface RespLogin {
	access_token: string
	device_id: string
	user_id: string
	refresh_token?: string
	expires_in_ms?: number
	well_known?: RespClientWellKnown
}
