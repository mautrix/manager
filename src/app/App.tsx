import React, { useState, useMemo, useCallback } from "react"
import type { RespLogin } from "../types/matrix"
import MatrixLogin from "./MatrixLogin"
import MainView from "./MainView"
import { MatrixClient } from "../api/matrix"
import { APIError } from "../api/error"
import useInit from "../util/useInit"
import TypedLocalStorage from "./localstorage"

export interface Credentials {
	user_id: string
	access_token: string
}

function useCredentials() {
	const [credentials, setCredentials] = useState(() => TypedLocalStorage.credentials)
	const setCredentialsProxy = useCallback((newCredentials: Credentials | null) => {
		TypedLocalStorage.credentials = newCredentials
		setCredentials(newCredentials)
	}, [setCredentials])
	return [credentials, setCredentialsProxy] as const
}

function useHomeserverURL() {
	const [homeserverURL, setHomeserverURL] = useState(() => TypedLocalStorage.homeserverURL)
	const setHomeserverURLProxy = useCallback((url: string) => {
		TypedLocalStorage.homeserverURL = url
		setHomeserverURL(url)
	}, [setHomeserverURL])
	return [homeserverURL, setHomeserverURLProxy] as const
}

const App = () => {
	const [error, setError] = useState("")
	const [homeserverURL, setHomeserverURL] = useHomeserverURL()
	const [credentials, setCredentials] = useCredentials()
	const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
	const matrixClient = useMemo(() => new MatrixClient(
		homeserverURL, credentials?.user_id, credentials?.access_token,
	), [credentials, homeserverURL])
	const onLoggedIn = useCallback((resp: RespLogin) => {
		setCredentials({
			user_id: resp.user_id,
			access_token: resp.access_token,
		})
		if (resp.well_known?.["m.homeserver"]?.base_url) {
			setHomeserverURL(resp.well_known["m.homeserver"].base_url)
		}
		setIsLoggedIn(true)
	}, [setCredentials, setHomeserverURL])
	const logout = useCallback(() => {
		matrixClient.logout().then(
			() => {
				setCredentials(null)
				setIsLoggedIn(false)
			},
			err => setError(`Failed to logout: ${err}`),
		)
	}, [matrixClient, setCredentials])

	useInit(() => {
		const loc = new URL(window.location.href)
		const loginToken = loc.searchParams.get("loginToken")
		if (loginToken) {
			loc.searchParams.delete("loginToken")
			window.history.replaceState({}, "", loc.toString())
			matrixClient.login({
				type: "m.login.token",
				token: loginToken,
			}).then(
				onLoggedIn,
				err => setError(`Failed to login with token: ${err}`),
			)
		} else if (matrixClient.token) {
			matrixClient.whoami().then(
				() => setIsLoggedIn(true),
				err => {
					if (err instanceof APIError && err.errcode === "M_UNKNOWN_TOKEN") {
						setIsLoggedIn(false)
						setCredentials(null)
					} else {
						setError(`Failed to check token: ${err}`)
					}
				},
			)
		} else {
			setIsLoggedIn(false)
		}
	})

	if (error) {
		return <div>{error} 3:</div>
	} else if (isLoggedIn === null) {
		return <div>spinner</div>
	} else if (!isLoggedIn) {
		return <MatrixLogin
			homeserverURL={homeserverURL}
			setHomeserverURL={setHomeserverURL}
			matrixClient={matrixClient}
			onLoggedIn={onLoggedIn}
		/>
	} else {
		return <MainView matrixClient={matrixClient} logout={logout}/>
	}
}

export default App
