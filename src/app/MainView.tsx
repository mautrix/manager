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
	const addBridge = useCallback((evt: React.FormEvent) => {
		evt.preventDefault()
		const form = evt.currentTarget as HTMLFormElement
		const data = Array.from(form.elements).reduce((acc, elem) => {
			if (elem instanceof HTMLInputElement) {
				if (elem.type === "checkbox") {
					acc[elem.name] = elem.checked
					elem.checked = false
				} else {
					acc[elem.name] = elem.value
					elem.value = ""
				}
			}
			return acc
		}, {} as Record<string, string | boolean>)
		if (!data.server || typeof data.server !== "string" || typeof data.external !== "boolean") {
			return
		}
		bridgeList.checkAndAdd(data.server, data.external)
			.catch(err => {
				alert(`Failed to add bridge: ${err}`)
			})
	}, [bridgeList])

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
		<form onSubmit={addBridge}>
			<label htmlFor="addbridge-server">Add bridge: </label>
			<input id="addbridge-server" type="text" placeholder="Bridge URL" name="server" />
			<label htmlFor="addbridge-external">External: </label>
			<input id="addbridge-external" type="checkbox" name="external" />
			<button type="submit">Add bridge</button>
		</form>
		<br/>
		<button onClick={logout}>Logout</button>
	</div>
}

export default MainView
