import { useCallback, useReducer } from "react"
import { RespWhoami } from "../types/whoami"
import { ProvisioningClient } from "../api/client"
import TypedLocalStorage from "./localstorage"
import type { MatrixClient } from "../api/matrix"
import useInit from "../util/useInit"
import type { RespMautrixWellKnown } from "../types/matrix"

export class BridgeMeta {
	constructor(
		public server: string,
		public refreshing: boolean,
		public client: ProvisioningClient,
		public updateState: (bridge: BridgeMeta) => void,
		public whoami?: RespWhoami,
		public error?: Error,
	) {}

	clone = ({ whoami, error, refreshing }: {
		whoami?: RespWhoami | null,
		error?: Error | null,
		refreshing?: boolean,
	}): BridgeMeta => {
		return new BridgeMeta(
			this.server,
			refreshing ?? this.refreshing,
			this.client,
			this.updateState,
			whoami !== undefined ? (whoami ?? undefined) : this.whoami,
			error !== undefined ? (error ?? undefined) : this.error,
		)
	}

	refresh = () => {
		if (!this.refreshing) {
			this.updateState(this.clone({ refreshing: true }))
		}
		this.refreshAndClone().then(this.updateState)
	}

	private async refreshAndClone(): Promise<BridgeMeta> {
		try {
			const whoami = await this.client.whoami()
			return this.clone({ whoami, refreshing: false })
		} catch (err) {
			let error: Error
			if (!(err instanceof Error)) {
				error = new Error(`${err}`)
			} else {
				error = err
			}
			return this.clone({ error, refreshing: false })
		}
	}
}

export type BridgeList = Record<string, BridgeMeta>

type SetBridges = {
	add?: BridgeList
	overwrite?: BridgeList
	delete?: string[]
}

function reduceBridges(bridges: BridgeList, bridgeChanges: SetBridges): BridgeList {
	const newBridges = { ...bridges, ...bridgeChanges.overwrite }
	if (bridgeChanges.add) {
		for (const [server, bridge] of Object.entries(bridgeChanges.add)) {
			if (!Object.prototype.hasOwnProperty.call(newBridges, server)) {
				newBridges[server] = bridge
				bridge.refresh()
			}
		}
	}
	if (bridgeChanges.delete) {
		for (const server of bridgeChanges.delete) {
			delete newBridges[server]
		}
	}
	TypedLocalStorage.bridges = Object.fromEntries(
		Object.entries(newBridges).map(([server, bridge]) => [server, bridge.whoami ?? null]),
	)
	return newBridges
}

export default function useBridgeList(matrixClient: MatrixClient) {
	const [bridges, setBridges] = useReducer(reduceBridges, {})
	const setBridge = useCallback((bridge: BridgeMeta) => {
		setBridges({
			overwrite: {
				[bridge.server]: bridge,
			},
		})
	}, [])
	const newBridgeMeta = useCallback((
		server: string, whoami?: RespWhoami | null, refreshing = false,
	) => {
		return new BridgeMeta(
			server,
			refreshing,
			new ProvisioningClient(server, matrixClient.userID!, matrixClient.token!),
			setBridge,
			whoami ?? undefined,
		)
	}, [matrixClient, setBridge])
	const deleteBridges = useCallback((...bridges: string[]) => {
		setBridges({ delete: bridges })
	}, [])
	const addBridges = useCallback((...newBridgeList: string[]) => {
		const newBridgeMap: BridgeList = Object.fromEntries(newBridgeList.map(server =>
			[server, newBridgeMeta(server,null, true)]))
		setBridges({ add: newBridgeMap })
	}, [newBridgeMeta])
	useInit(() => {
		const initialBridges = Object.fromEntries(Object.entries(TypedLocalStorage.bridges)
			.map(([server, whoami]) => [server, newBridgeMeta(server, whoami, true)]))
		setBridges({ add: initialBridges })

		const match = /@.*:(.*)/.exec(matrixClient.userID!)
		if (!match) {
			return
		}
		fetch(`https://${match[1]}/.well-known/matrix/mautrix`)
			.then(resp => resp.json())
			.then((resp: RespMautrixWellKnown) => {
				const bridges = resp?.["fi.mau.bridges"]?.filter?.(br => typeof br === "string")
				if (bridges) {
					addBridges(...bridges)
				}
			})
			.catch(err => console.error("Failed to fetch bridge list from .well-known:", err))
	})

	return {
		bridges, setBridges, addBridges, deleteBridges,
	} as const
}
