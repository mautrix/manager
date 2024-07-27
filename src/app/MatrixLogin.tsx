import React, { useCallback, useEffect, useRef, useState } from "react"
import type { RespClientWellKnown, RespLogin } from "../types/matrix"
import type { MatrixClient } from "../api/matrix"

interface LoginScreenProps {
	homeserverURL: string
	setHomeserverURL: (url: string) => void
	matrixClient: MatrixClient
	onLoggedIn: (resp: RespLogin) => void
}

const LoginScreen = ({
	homeserverURL, setHomeserverURL, matrixClient, onLoggedIn,
}: LoginScreenProps) => {
	const [username, setUsername] = useState("")
	const [password, setPassword] = useState("")
	const [error, setError] = useState("")
	const [loginFlows, setLoginFlows] = useState<Set<string> | null>(null)
	const forceResolveImmediate = useRef(true)

	const login = useCallback((evt: React.FormEvent) => {
		evt.preventDefault()
		matrixClient.login({
			type: "m.login.password",
			identifier: {
				type: "m.id.user",
				user: username,
			},
			password,
		}).then(
			onLoggedIn,
			err => setError(err.toString()),
		)
	}, [username, password, onLoggedIn, matrixClient])
	const loginSSO = useCallback(() => {
		window.mautrixAPI.openInBrowser(matrixClient.ssoRedirectURL)
			.catch(err => window.alert(`Failed to open SSO URL in browser: ${err}`))
	}, [matrixClient])

	const resolveHomeserver = useCallback(() => {
		if (homeserverURL.startsWith("https://") || homeserverURL.startsWith("http://")) {
			matrixClient.getLoginFlows().then(
				resp => {
					setLoginFlows(new Set(resp.flows.map(flow => flow.type)))
					setError("")
				},
				err => {
					setLoginFlows(null)
					setError(`Failed to get login flows: ${err}`)
				},
			)
		} else if (homeserverURL) {
			fetch(`https://${homeserverURL}/.well-known/matrix/client`)
				.then(resp => resp.json())
				.then((resp: RespClientWellKnown) => {
					const baseURL = resp?.["m.homeserver"]?.base_url
					if (baseURL) {
						forceResolveImmediate.current = true
						setHomeserverURL(baseURL)
					} else {
						setLoginFlows(null)
						setError("Couldn't find homeserver URL in well-known")
					}
				})
				.catch(err => {
					setLoginFlows(null)
					setError(`Failed to resolve homeserver URL: ${err}`)
				})
		}
	}, [homeserverURL, matrixClient, setHomeserverURL])

	useEffect(() => {
		if (forceResolveImmediate.current) {
			forceResolveImmediate.current = false
			resolveHomeserver()
			return
		}
		const timeout = setTimeout(resolveHomeserver, 1000)
		return () => {
			clearTimeout(timeout)
		}
	}, [homeserverURL, resolveHomeserver, forceResolveImmediate])

	return (
		<div>
			Login
			<input
				type="text"
				id="homeserver-url"
				value={homeserverURL}
				onChange={evt => {
					setHomeserverURL(evt.target.value)
					setLoginFlows(null)
				}}
			/>
			{loginFlows?.has("m.login.password") && <form onSubmit={login}>
				<input
					type="text"
					id="username"
					value={username}
					onChange={evt => setUsername(evt.target.value)}
				/>
				<input
					type="password"
					id="password"
					value={password}
					onChange={evt => setPassword(evt.target.value)}
				/>
				<button type="submit">Login</button>
			</form>}
			{loginFlows?.has("m.login.sso") && <>
				<button onClick={loginSSO}>SSO login</button>
			</>}
			{error && <>
				error :( {error}
			</>}
		</div>
	)
}

export default LoginScreen
