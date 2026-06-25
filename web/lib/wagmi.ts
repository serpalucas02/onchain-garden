import { http, createConfig } from "wagmi";
import { foundry, arbitrumSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// foundry = anvil local (chainId 31337) for dev; arbitrumSepolia for the live demo.
export const config = createConfig({
  chains: [foundry, arbitrumSepolia],
  connectors: [injected()],
  transports: {
    [foundry.id]: http("http://127.0.0.1:8545"),
    [arbitrumSepolia.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
