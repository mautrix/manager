import React, { useCallback, useState } from "react"
import type { MatrixClient } from "../api/matrix"
import BridgeListEntry from "./BridgeListEntry"
import BridgeStatusView from "./BridgeStatusView"
import useBridgeList from "./bridgelist"

interface MainScreenProps {
	matrixClient: MatrixClient
	logout: () => void,
}

const MainView = ({ matrixClient, logout }: MainScreenProps) => {
	const { bridges } = useBridgeList(matrixClient)
	const [viewingBridge, setViewingBridge] = useState("")
	const [loginInProgress, setLoginInProgress] = useState<boolean>(false)

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
