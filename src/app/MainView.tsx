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
	const [loginInProgress, setLoginInProgress] = useState<LoginInProgress | null>(null)
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
			loginInProgress.cancel()
			setLoginInProgress(null)
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

	return <main className="main-view">
		<div className="logged-in-as">
			<span>Logged in as <code>{matrixClient.userID}</code></span>
			<button onClick={logout}>Logout</button>
		</div>
		<div className="bridge-list">
			{Object.entries(bridges).map(([server, bridge]) => <BridgeListEntry
				key={server}
				matrixClient={matrixClient}
				server={server}
				meta={bridge}
				switchBridge={switchBridge}
				active={viewingBridge === server}
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
		{viewingBridge && <BridgeStatusView
			bridge={bridges[viewingBridge]}
			setLoginInProgress={setLoginInProgress}
		/>}
	</main>
}

export default MainView
