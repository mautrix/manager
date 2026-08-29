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
	| "v1.12"
	| "v1.13"
	| "v1.14"
	| "v1.15"
	| "v1.16"
	| "v1.17"
	| "v1.18"
	| "v1.19"

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

export interface RespAuthMetadata {
	issuer: string
	authorization_endpoint: string
	token_endpoint: string
	registration_endpoint?: string
	device_authorization_endpoint?: string
	revocation_endpoint?: string
	grant_types_supported?: string[]
	code_challenge_methods_supported?: string[]
	response_types_supported?: string[]
}

export interface RespClientRegistration {
	client_id: string
	client_id_issued_at?: number
}

export interface RespDeviceAuthorization {
	device_code: string
	user_code: string
	verification_uri: string
	verification_uri_complete?: string
	expires_in: number
	interval?: number
}

export interface RespOAuthToken {
	access_token: string
	token_type: string
	expires_in?: number
	refresh_token?: string
	scope?: string
}
