"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  usePublicClient,
  useWriteContract,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import { BaseError, UserRejectedRequestError } from "viem";
import { GARDEN_ADDRESS, START_BLOCK, gardenAbi } from "@/lib/contract";

const EXPECTED_CHAIN = sepolia; // live demo target. Use `foundry` for local anvil dev.
const ZERO = "0x0000000000000000000000000000000000000000";

type Plant = {
  tokenId: bigint;
  image: string;
  name: string;
  stage: string;
  waterings: string;
  status: string;
};

function attr(json: { attributes?: { trait_type: string; value: unknown }[] }, trait: string) {
  return String(json.attributes?.find((a) => a.trait_type === trait)?.value ?? "");
}

export default function Home() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const galleryClient = usePublicClient({ chainId: EXPECTED_CHAIN.id });
  const { writeContractAsync } = useWriteContract();

  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<bigint | null>(null);
  const [minting, setMinting] = useState(false);
  const [gallery, setGallery] = useState<string[]>([]);

  const deployed = (GARDEN_ADDRESS as string) !== ZERO;
  const wrongNetwork = isConnected && chainId !== EXPECTED_CHAIN.id;

  // Find the plants this wallet planted (via the Planted event) and load their on-chain art.
  const loadPlants = useCallback(async () => {
    if (!publicClient || !address || !deployed) {
      setPlants([]);
      return;
    }
    setLoading(true);
    try {
      const logs = await publicClient.getContractEvents({
        address: GARDEN_ADDRESS,
        abi: gardenAbi,
        eventName: "Planted",
        args: { owner: address },
        fromBlock: START_BLOCK,
        toBlock: "latest",
      });

      const ids = [...new Set(logs.map((l) => (l.args.tokenId as bigint).toString()))].map(BigInt);

      const found: Plant[] = [];
      for (const id of ids) {
        // It could have been transferred away, so confirm ownership before showing it.
        let owner: string;
        try {
          owner = (await publicClient.readContract({
            address: GARDEN_ADDRESS,
            abi: gardenAbi,
            functionName: "ownerOf",
            args: [id],
          })) as string;
        } catch {
          continue;
        }
        if (owner.toLowerCase() !== address.toLowerCase()) continue;

        const uri = (await publicClient.readContract({
          address: GARDEN_ADDRESS,
          abi: gardenAbi,
          functionName: "tokenURI",
          args: [id],
        })) as string;

        const json = JSON.parse(atob(uri.split(",")[1]));
        found.push({
          tokenId: id,
          image: json.image,
          name: json.name,
          stage: attr(json, "Stage"),
          waterings: attr(json, "Waterings"),
          status: attr(json, "Status"),
        });
      }
      setPlants(found.sort((a, b) => Number(a.tokenId - b.tokenId)));
    } finally {
      setLoading(false);
    }
  }, [publicClient, address, deployed]);

  useEffect(() => {
    loadPlants();
  }, [loadPlants]);

  // Landing showcase: render a few example blooms straight from the contract (no wallet needed).
  useEffect(() => {
    if (!galleryClient) return;
    const seeds = [BigInt("0x100000002"), BigInt("0x010203020300"), BigInt("0x020004040504")];
    Promise.all(
      seeds.map(
        (seed) =>
          galleryClient.readContract({
            address: GARDEN_ADDRESS,
            abi: gardenAbi,
            functionName: "previewArt",
            args: [seed, 3, false],
          }) as Promise<string>
      )
    )
      .then((svgs) => setGallery(svgs.map((svg) => `data:image/svg+xml;base64,${btoa(svg)}`)))
      .catch(() => {});
  }, [galleryClient]);

  async function mint() {
    setMinting(true);
    try {
      const hash = await writeContractAsync({ address: GARDEN_ADDRESS, abi: gardenAbi, functionName: "mint" });
      await publicClient!.waitForTransactionReceipt({ hash });
      await loadPlants();
    } catch (err) {
      // Ignore wallet rejections (the user clicked "Reject"); only log real failures.
      if (!(err instanceof BaseError && err.walk((e) => e instanceof UserRejectedRequestError))) {
        console.error(err);
      }
    } finally {
      setMinting(false);
    }
  }

  async function water(id: bigint) {
    setBusyId(id);
    try {
      const hash = await writeContractAsync({
        address: GARDEN_ADDRESS,
        abi: gardenAbi,
        functionName: "water",
        args: [id],
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      await loadPlants();
    } catch (err) {
      // Ignore wallet rejections (the user clicked "Reject"); only log real failures.
      if (!(err instanceof BaseError && err.walk((e) => e instanceof UserRejectedRequestError))) {
        console.error(err);
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-gradient-to-b from-emerald-50 to-lime-100 text-emerald-950">
      {/* top bar */}
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-xl font-bold">🌱 On-Chain Garden</span>
        {isConnected ? (
          <button
            onClick={() => disconnect()}
            className="rounded-full bg-emerald-900 px-4 py-2 text-sm font-medium text-emerald-50 hover:bg-emerald-800"
          >
            {address?.slice(0, 6)}…{address?.slice(-4)} · Disconnect
          </button>
        ) : (
          <button
            onClick={() => connect({ connector: connectors[0] })}
            className="rounded-full bg-emerald-900 px-4 py-2 text-sm font-medium text-emerald-50 hover:bg-emerald-800"
          >
            Connect wallet
          </button>
        )}
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight">Grow a plant, fully on-chain</h1>
          <p className="mx-auto mt-3 max-w-xl text-emerald-800">
            Each plant&apos;s image and metadata live entirely in the smart contract. Water it to make it grow — neglect
            it and it wilts.
          </p>
        </div>

        {!deployed && (
          <Banner>⚠️ Contract not deployed yet — set <code>GARDEN_ADDRESS</code> in <code>lib/contract.ts</code>.</Banner>
        )}

        {!isConnected && (
          <div className="mb-10">
            {gallery.length > 0 && (
              <>
                <p className="mb-4 text-center text-sm font-medium uppercase tracking-wider text-emerald-700">
                  Every plant is one of a kind
                </p>
                <div className="mb-8 flex flex-wrap justify-center gap-4">
                  {gallery.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={src} alt={`Example plant ${i + 1}`} className="w-40 rounded-2xl bg-white p-2 shadow-sm" />
                  ))}
                </div>
              </>
            )}
            <p className="text-center text-emerald-800">Connect your wallet to start your garden.</p>
          </div>
        )}

        {wrongNetwork && (
          <Banner>
            Wrong network.{" "}
            <button onClick={() => switchChain({ chainId: EXPECTED_CHAIN.id })} className="font-semibold underline">
              Switch to {EXPECTED_CHAIN.name}
            </button>
          </Banner>
        )}

        {isConnected && !wrongNetwork && deployed && (
          <>
            <div className="mb-8 flex justify-center">
              <button
                onClick={mint}
                disabled={minting}
                className="rounded-full bg-emerald-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {minting ? "Planting…" : "🌱 Plant a seed"}
              </button>
            </div>

            {loading && <p className="text-center text-emerald-700">Loading your garden…</p>}

            {!loading && plants.length === 0 && (
              <p className="text-center text-emerald-700">No plants yet — plant your first seed!</p>
            )}

            <div className="flex flex-wrap justify-center gap-6">
              {plants.map((p) => (
                <div key={p.tokenId.toString()} className="w-full sm:w-72 rounded-2xl bg-white p-4 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image} alt={p.name} className="aspect-square w-full rounded-xl" />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-semibold">{p.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.status === "Thirsty" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-emerald-700">
                    {p.stage} · {p.waterings} waterings
                  </p>
                  <button
                    onClick={() => water(p.tokenId)}
                    disabled={busyId === p.tokenId}
                    className="mt-3 w-full rounded-lg bg-sky-500 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
                  >
                    {busyId === p.tokenId ? "Watering…" : "💧 Water"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mb-6 max-w-xl rounded-lg bg-amber-100 px-4 py-3 text-center text-sm text-amber-900">
      {children}
    </div>
  );
}
