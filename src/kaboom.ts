
import { KaboomCoreCtx, KaboomCtx, KaboomOpt, KaboomNetworkCtx } from "./types"

import kaboomBrowser from "./kaboomBrowser"
import kaboomServer from "./kaboomServer"

// only exports one kaboom() which contains all the state
export default (gopt: KaboomOpt = {}): KaboomCoreCtx | KaboomNetworkCtx => {
	if (gopt.headless) {
		return kaboomServer(gopt)
	} else {
		return kaboomBrowser(gopt)
	}
}
