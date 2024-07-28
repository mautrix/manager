import React, { useCallback } from "react"
import type { BridgeMeta } from "../api/bridgelist"
import type { MatrixClient } from "../api/matrixclient"

interface BridgeEntryProps {
	matrixClient: MatrixClient
	server: string
	meta: BridgeMeta
	switchBridge: (server: string) => void
}

const BridgeListEntry = ({ matrixClient, server, meta, switchBridge }: BridgeEntryProps) => {
	const onClick = useCallback(() => switchBridge(server), [server, switchBridge])
	if (!meta.whoami) {
		if (meta.error) {
			return <div title={meta.error.message}>{server} ❌</div>
		}
		return <div>Loading {server}...</div>
	}
	return <button onClick={onClick}>
		<img alt="" src={matrixClient.getMediaURL(meta.whoami.network.network_icon)} height={24}/>
		{server}
	</button>
}

export default BridgeListEntry
