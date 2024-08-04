import React, { MouseEvent, useCallback, useState } from "react"
import type { BridgeMeta } from "../api/bridgelist"
import type { LoginClient } from "../api/loginclient"
import type { RespWhoamiLogin } from "../types/whoami"
import type { MatrixClient } from "../api/matrixclient"
import BridgeLoginView from "./BridgeLoginView"
import "./BridgeStatusView.css"

interface BridgeViewProps {
	bridge: BridgeMeta
	setLoginInProgress: (inProgress: boolean) => void
}

interface UserLoginViewProps {
	login: RespWhoamiLogin
	mxClient: MatrixClient
	doLogout: (evt: MouseEvent<HTMLButtonElement>) => void
}

const UserLoginView = ({ login, mxClient, doLogout }: UserLoginViewProps) => {
	const [expandDetails, setExpandDetails] = useState(false)
	const stateEvtClass = login.state_event.toLowerCase().replace("_", "-") || "unset"
	return <div className={`user-login-entry state-${stateEvtClass}`}>
		<div className="header">
			<div className="profile" onClick={() => setExpandDetails(!expandDetails)}>
				{login.profile?.avatar &&
					<img src={mxClient.getMediaURL(login.profile.avatar)} alt=""/>}
				<span className="login-name">{login.name || <code>{login.id}</code>}</span>
			</div>
			<div className="controls">
				<span className={`login-state state-${stateEvtClass}`}>
					{login.state_event || "NO STATE"}
				</span>
				{login.state_event === "BAD_CREDENTIALS" &&
					<button className="relogin" data-login-id={login.id}>Relogin</button>}
				<button className="logout" data-login-id={login.id} onClick={doLogout}>Logout</button>
			</div>
		</div>
		<pre className={`details ${expandDetails ? "" : "hidden"}`}>
			{JSON.stringify(login, null, 2)}
		</pre>
	</div>
}

const BridgeStatusView = ({ bridge, setLoginInProgress }: BridgeViewProps) => {
	const mxClient = bridge.client.matrixClient
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
		bridge.client.logout(loginID).then(() => setTimeout(bridge.refresh, 500))
	}, [bridge])

	if (!bridge.whoami) {
		return <div>BridgeView spinner</div>
	}

	return <div className="bridge-view">
		{bridge.whoami.logins.map(login =>
			<UserLoginView key={login.id} login={login} mxClient={mxClient} doLogout={doLogout}/>,
		)}
		{login ? <BridgeLoginView
			key={login.loginID}
			client={login}
			onLoginCancel={onLoginCancel}
			onLoginComplete={onLoginComplete}
		/> : <div className="new-login">
			New login:
			{bridge.whoami.login_flows.map(flow =>
				<button
					key={flow.id}
					title={flow.description}
					data-flow-id={flow.id}
					onClick={startLogin}
				>
					{flow.name}
				</button>)}
		</div>}
	</div>
}

export default BridgeStatusView
