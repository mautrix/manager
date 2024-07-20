import React, { useCallback, useState } from "react"
import type { MatrixClient } from "../api/matrix"
import BridgeEntry from "./BridgeEntry"
import BridgeView from "./BridgeView"
import useBridgeList from "./bridgelist"

interface MainScreenProps {
	matrixClient: MatrixClient
	logout: () => void,
}

const MainScreen = ({ matrixClient, logout }: MainScreenProps) => {
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
		{Object.entries(bridges).map(([server, bridge]) => <BridgeEntry
			key={server}
			matrixClient={matrixClient}
			server={server}
			meta={bridge}
			switchBridge={switchBridge}
		/>)}
		<br/>
		{viewingBridge && <BridgeView
			bridge={bridges[viewingBridge]}
			setLoginInProgress={setLoginInProgress}
		/>}
		<br/>
		<button onClick={logout}>Logout</button>
	</div>
}

export default MainScreen
