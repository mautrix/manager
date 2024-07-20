import React, { MouseEvent, useCallback, useState } from "react"
import type { BridgeMeta } from "./bridgelist"
import type { LoginClient } from "../api/login"
import LoginView from "./LoginView"

interface BridgeViewProps {
	bridge: BridgeMeta
	setLoginInProgress: (inProgress: boolean) => void
}

const BridgeView = ({ bridge, setLoginInProgress }: BridgeViewProps) => {
	const [login, setLogin] = useState<LoginClient | null>(null)

	const onLoginComplete = useCallback(() => {
		setTimeout(bridge.refresh, 500)
		setLogin(null)
		setLoginInProgress(false)
	}, [setLoginInProgress, bridge])
	const onLoginCancel = useCallback(() => {
		setLogin(null)
		setLoginInProgress(false)
	}, [setLoginInProgress])

	const startLogin = useCallback((evt: MouseEvent<HTMLButtonElement>) => {
		// TODO catch errors?
		bridge.client.startLogin(
			evt.currentTarget.getAttribute("data-flow-id")!,
			bridge.refresh,
		).then(setLogin)
	}, [setLogin, bridge])
	const doLogout = useCallback((evt: MouseEvent<HTMLButtonElement>) => {
		const loginID = evt.currentTarget.getAttribute("data-login-id")!
		bridge.client.logout(loginID).then(() => setTimeout(() => bridge.refresh(), 500))
	}, [bridge])

	if (!bridge.whoami) {
		return <div>BridgeView spinner</div>
	}

	return <div>
		Network: {bridge.whoami.network.displayname}
		<br/>
		New login:
		<ul>
			{bridge.whoami.login_flows.map(flow =>
				<button
					key={flow.id}
					title={flow.description}
					data-flow-id={flow.id}
					onClick={startLogin}
				>
					{flow.name}
				</button>)}
		</ul>
		Logins:
		<ul>
			{bridge.whoami.logins.map(login => <li key={login.id}>
				{login.name} - {login.state_event}
				<button data-login-id={login.id} onClick={doLogout}>Logout</button>
			</li>)}
		</ul>
		{login && <LoginView
			key={login.loginID}
			client={login}
			onLoginCancel={onLoginCancel}
			onLoginComplete={onLoginComplete}
		/>}
	</div>
}

export default BridgeView
