// Local anvil: first deploy from account #0 is always this deterministic address.
// (Swap it for the testnet address when we deploy the live demo.)
export const GARDEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const;

// Block to start scanning Planted events from (0 for anvil; set the deploy block on a testnet).
export const START_BLOCK = BigInt(0);

// Just the bits of the ABI the frontend actually uses.
export const gardenAbi = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "water",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "stageOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "isThirsty",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "event",
    name: "Planted",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "Watered",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "waterCount", type: "uint64", indexed: false },
    ],
  },
  { type: "error", name: "NotYourPlant", inputs: [] },
] as const;
