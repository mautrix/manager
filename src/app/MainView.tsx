import React, { useCallback, useEffect, useMemo, useState } from "react"
import type { MatrixClient } from "../api/matrix"
import { BridgeList, BridgeMap } from "./bridgelist"
import BridgeListEntry from "./BridgeListEntry"
import BridgeStatusView from "./BridgeStatusView"

interface MainScreenProps {
	matrixClient: MatrixClient
	logout: () => void,
}

const MainView = ({ matrixClient, logout }: MainScreenProps) => {
	const bridgeList = useMemo(() => new BridgeList(matrixClient), [matrixClient])
	const [bridges, setBridges] = useState<BridgeMap>({})
	const [viewingBridge, setViewingBridge] = useState("")
	const [loginInProgress, setLoginInProgress] = useState<boolean>(false)
	useEffect(() => {
		bridgeList.listen(setBridges)
		bridgeList.initialLoad()
		return () => bridgeList.stopListen(setBridges)
	}, [bridgeList])

	const switchBridge = useCallback((server: string) => {
		if (loginInProgress) {
			const cancel = window.confirm("Cancel login?")
			if (!cancel) {
				return
			}
		}
		setViewingBridge(server)
	}, [loginInProgress])
	return <div>
		Logged in as {matrixClient.userID}
		<br/>
		{Object.entries(bridges).map(([server, bridge]) => <BridgeListEntry
			key={server}
			matrixClient={matrixClient}
			server={server}
			meta={bridge}
			switchBridge={switchBridge}
		/>)}
		<br/>
		{viewingBridge && <BridgeStatusView
			bridge={bridges[viewingBridge]}
			setLoginInProgress={setLoginInProgress}
		/>}
		<br/>
		<button onClick={logout}>Logout</button>
	</div>
}

export default MainView
