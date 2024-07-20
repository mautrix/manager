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

export interface RespWhoamiLogin {
	state_event: RemoteStateEvent
	state_ts: number
	id: string
	name: string
	space_room: string
}
