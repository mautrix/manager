import type { LoginFlow } from "./login"

export interface RespWhoami {
	network: BridgeName
	login_flows: LoginFlow[]
	homeserver: string
	bridge_bot: string
	command_prefix: string
	management_room: string
	logins: RespWhoamiLogin[]
}

export interface BridgeName {
	displayname: string
	network_url: string
	network_icon: string
	network_id: string
	beeper_bridge_type: string
	default_port?: number
	default_command_prefix?: number
}

export type RemoteStateEvent =
	"CONNECTING" |
	"BACKFILLING" |
	"CONNECTED" |
	"TRANSIENT_DISCONNECT" |
	"BAD_CREDENTIALS" |
	"UNKNOWN_ERROR"

export interface RemoteProfile {
	name?: string
	username?: string
	phone?: string
	email?: string
	avatar?: string
}

export interface RespWhoamiLogin {
	state_event: RemoteStateEvent
	state_ts: number
	state_reason?: string
	state_info?: Record<string, unknown>
	id: string
	name: string
	profile?: RemoteProfile
	space_room: string
	relogin_flow_ids?: string[]
}
