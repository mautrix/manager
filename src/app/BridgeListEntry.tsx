import React, { useCallback } from "react"
import type { BridgeMeta } from "../api/bridgelist"
import type { MatrixClient } from "../api/matrixclient"

interface BridgeEntryProps {
	matrixClient: MatrixClient
	meta: BridgeMeta
	switchBridge: (server: string) => void
	active: boolean
	showBotMXID: boolean
}

const BridgeListEntry = (
	{ matrixClient, meta, switchBridge, active, showBotMXID }: BridgeEntryProps,
) => {
	const onClick = useCallback(() => switchBridge(meta.server), [meta.server, switchBridge])
	const className = "bridge-list-entry" + (active ? " active" : "")
	if (!meta.whoami) {
		if (meta.error) {
			return <div className={className} title={meta.error.message}>{meta.server} ❌</div>
		}
		return <div className={className}>Loading {meta.server}...</div>
	}
	return <button className={className} onClick={onClick} title={meta.server}>
		<img alt="" src={matrixClient.getMediaURL(meta.whoami.network.network_icon)}/>
		<div className="bridge-list-name">
			<span className="name">{meta.whoami.network.displayname}</span>
			{showBotMXID && <small className="bridge-bot-id">{meta.whoami.bridge_bot}</small>}
		</div>
	</button>
}

export default BridgeListEntry
