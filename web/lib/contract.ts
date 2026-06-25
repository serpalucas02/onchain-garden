// Deployed on Ethereum Sepolia.
export const GARDEN_ADDRESS = "0x26F9C68548904B99B18163AD12900CC88f5e46f8" as const;

// Block the contract was deployed at — we scan Planted events from here (not from 0).
export const START_BLOCK = BigInt(11137514);

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
    name: "previewArt",
    stateMutability: "pure",
    inputs: [
      { name: "seed_", type: "uint64" },
      { name: "stage_", type: "uint8" },
      { name: "thirsty_", type: "bool" },
    ],
    outputs: [{ type: "string" }],
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
