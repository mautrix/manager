export interface RespResolveIdentifier {
	id: string
	name?: string
	avatar_url?: string
	identifiers?: string[]
	mxid?: string
	dm_room_mxid?: string
}

export type RespStartChat = RespResolveIdentifier & {
	dm_room_mxid: string
}

export interface RespGetContactList {
	contacts: RespResolveIdentifier[]
}
