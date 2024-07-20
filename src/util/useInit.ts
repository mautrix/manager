import { useState } from "react"

const useInit = (callback: () => void) => {
	const [initialized, setInitialized] = useState(false)
	if (!initialized) {
		callback()
		setInitialized(true)
	}
}

export default useInit
