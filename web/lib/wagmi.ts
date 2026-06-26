import { http, createConfig } from "wagmi";
import { foundry, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// foundry = anvil local (chainId 31337) for dev; sepolia for the live demo.
// drpc serves eth_getLogs (which we need to find a wallet's plants) — many free RPCs don't.
export const config = createConfig({
  chains: [foundry, sepolia],
  connectors: [injected()],
  transports: {
    [foundry.id]: http("http://127.0.0.1:8545"),
    // Harden the read RPC: extra retries + longer timeout so a cold/flaky first call
    // doesn't make the app look empty. drpc serves eth_getLogs (needed to find plants).
    [sepolia.id]: http("https://sepolia.drpc.org", {
      retryCount: 5,
      retryDelay: 600,
      timeout: 20_000,
      batch: true,
    }),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
