import React, { useCallback, useEffect, useMemo, useState } from "react"
import type { MatrixClient } from "../api/matrixclient"
import { BridgeList, BridgeMap } from "../api/bridgelist"
import BridgeListEntry from "./BridgeListEntry"
import BridgeStatusView from "./BridgeStatusView"
import "./MainView.css"

interface MainScreenProps {
	matrixClient: MatrixClient
	logout: () => void
}

export interface LoginInProgress {
	cancel: () => void
}

const MainView = ({ matrixClient, logout }: MainScreenProps) => {
	const bridgeList = useMemo(() => new BridgeList(matrixClient), [matrixClient])
	const [bridges, setBridges] = useState<BridgeMap>({})
	const [viewingBridge, setViewingBridge] = useState("")
	useEffect(() => {
		bridgeList.listen(setBridges)
		bridgeList.initialLoad()
		return () => bridgeList.stopListen(setBridges)
	}, [bridgeList])

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

	return <main className="main-view">
		<div className="logged-in-as">
			<span>Logged in as <code>{matrixClient.userID}</code></span>
			<button onClick={logout}>Logout</button>
		</div>
		<div className="bridge-list">
			{Object.values(bridges).map(bridge => <BridgeListEntry
				key={bridge.server}
				matrixClient={matrixClient}
				meta={bridge}
				switchBridge={setViewingBridge}
				active={viewingBridge === bridge.server}
				showBotMXID={bridgeList.hasMultiple(bridge.whoami?.network.beeper_bridge_type)}
			/>)}
			<form className="new-bridge" onSubmit={addBridge}>
				<input id="addbridge-server" type="text" placeholder="Bridge URL" name="server"/>
				<div className="checkbox-wrapper">
					<label htmlFor="addbridge-external">External </label>
					<input id="addbridge-external" type="checkbox" name="external"/>
				</div>
				<button type="submit">Add bridge</button>
			</form>
		</div>
		{Object.values(bridges).map(bridge =>
			<BridgeStatusView
				key={bridge.server}
				hidden={viewingBridge !== bridge.server}
				bridge={bridge}
			/>)}
	</main>
}

export default MainView
