# 🌱 On-Chain Garden

**🌐 Idioma:** [English](README.md) · Español

Un **NFT dinámico 100% on-chain**: una planta que crece cuando la regás y se marchita si la descuidás. Tanto la **imagen (SVG)** como la **metadata** las genera el propio contrato — **sin IPFS, sin servidor externo, nada off-chain**. Además, cada planta nace con un look único (colores, flor, maceta) derivado de su propia semilla.

> Proyecto de portfolio fullstack: contrato Solidity (Foundry) + frontend Next.js (wagmi/viem).

---

## Demo en vivo

- 🌐 **App:** https://onchain-garden.vercel.app — conectá en Sepolia para mintear y ver una planta renderizada en vivo
- 📜 **Contrato (verificado):** [`0x26F9…46f8` en Sepolia Etherscan](https://sepolia.etherscan.io/address/0x26f9c68548904b99b18163ad12900cc88f5e46f8#code)

Deployado en **Ethereum Sepolia**. Para mintear la tuya, conectá MetaMask en Sepolia y conseguí ETH de prueba gratis en una [faucet](https://cloud.google.com/application/web3/faucet). Como el arte y la metadata son 100% on-chain, la app renderiza cada planta directo desde `tokenURI` — sin marketplace.

---

## Qué lo hace interesante

- **Arte 100% on-chain.** `tokenURI` arma un SVG y un JSON al vuelo y los devuelve como `data:` URIs en base64. El NFT sobrevive mientras exista la blockchain — sin links de IPFS rotos.
- **Realmente dinámico.** La imagen refleja el estado en vivo en cada lectura: etapa de crecimiento (semilla → brote → planta → flor) y si está sedienta. Nada cacheado.
- **Única por planta.** Una `seed` fijada al mintear alimenta 6 rasgos cosméticos independientes → **29.160 combinaciones** (tono de hoja, cielo, color de flor, color de maceta, cantidad de pétalos 4/5/6, forma de maceta).

---

## Cómo funciona

El estado guardado por planta es mínimo — todo lo visual se *deriva*, no se guarda:

```solidity
struct Plant {
    uint64 waterCount;  // riegos totales    -> etapa de crecimiento
    uint64 lastWatered; // último timestamp  -> estado "sedienta"
    uint64 seed;        // fijada al mintear  -> look único
}
```

- `water()` incrementa `waterCount` y refresca `lastWatered` (solo el dueño).
- `stageOf()` / `isThirsty()` son **`view`s computadas desde ese estado** — así el arte siempre refleja el *ahora* (la sed depende del tiempo actual).
- `tokenURI()` ensambla el SVG + JSON desde el estado en vivo y la semilla.

---

## Arquitectura

```
src/OnChainGarden.sol     El protocolo completo: ERC-721 + SVG/metadata on-chain + rasgos
script/Deploy.s.sol       Script de deploy (anvil / testnet)
test/OnChainGarden.t.sol  Suite de tests Foundry (unit + fuzz), 100% coverage
web/                      Frontend Next.js (App Router)
  lib/wagmi.ts            Chains, connectors, transports
  lib/contract.ts         Address + ABI (tipado con `as const`)
  app/providers.tsx       WagmiProvider + React Query
  app/page.tsx            UI: conectar, mintear, regar, renderizar el jardín
```

El frontend no guarda estado propio: **escribe al contrato, espera y lo vuelve a leer**. La blockchain es la única fuente de verdad.

---

## Decisiones de diseño

**¿Por qué SVG on-chain en vez de IPFS?**
Un NFT dinámico tiene que cambiar su imagen cuando cambia el estado. Con IPFS habría que re-pinear un archivo nuevo en cada cambio (y confiar en que siga pineado). Generar el SVG en el contrato hace que el arte sea una función pura del estado on-chain — dinámico *y* permanente, sin dependencia off-chain.

**¿Por qué encontrar "mis plantas" vía eventos en vez de un mapping on-chain / `ERC721Enumerable`?**
Enumerar acá es una **necesidad de la UI**, no de la lógica del contrato. El storage on-chain es el recurso más caro del EVM; los eventos (logs) son ~10× más baratos de escribir y **gratis de leer off-chain**. Mantener un `address => uint256[]` (o `ERC721Enumerable`) gravaría *cada* mint y transfer para siempre, solo para facilitarle la vida a un lector off-chain que es gratis — mal negocio. Por eso el contrato emite un evento `Planted` y el frontend lo lee vía RPC (`getContractEvents`).
El trade-off honesto: un contrato no puede leer sus propios logs, así que si la enumeración hiciera falta *dentro* de la lógica del contrato (ej. staking que itera los NFTs de un usuario), una estructura on-chain sería lo correcto. Acá no. Además, así lo hace la industria a escala — los indexers (The Graph, etc.) trackean ownership desde el evento estándar `Transfer` en vez de pagar por enumeración on-chain.

**¿Por qué rasgos pseudo-aleatorios en vez de Chainlink VRF?**
VRF es para aleatoriedad *adversarial y con valor económico* (ganadores de lotería, drops de rasgos raros que valen plata). El color de una planta no tiene valor económico — no hay nada que ganar manipulándolo — así que el flujo async, la suscripción y el costo en LINK de VRF serían over-engineering. Una `seed` con `keccak256` fijada al mintear es la herramienta correcta. Saber *cuándo no* usar VRF es parte del punto.

**Storage packing.** `waterCount + lastWatered + seed` son tres `uint64` = 192 bits, así que comparten un solo slot de storage → sin `SSTORE` extra por la semilla.

---

## Seguridad

- **No maneja fondos** (no es `payable`, nunca mueve ETH) → sin superficie de reentrancy, nada que drenar.
- **Control de acceso**: solo el dueño puede `water` una planta (`NotYourPlant`).
- `_safeMint` (chequeo de receptor seguro) y `_requireOwned` en `tokenURI`.
- Aritmética chequeada de Solidity 0.8; sin loops sobre data controlada por el usuario.

---

## Tests

La suite cubre happy paths **y el "intentá romperlo"** (control de acceso, reverts, estado basado en tiempo), más un fuzz test sobre los umbrales de crecimiento y un barrido de branches sobre cada variante de arte.

```
src/OnChainGarden.sol   100% líneas · 100% statements · 100% branches · 100% funcs
```

---

## Gas

Números reales del deploy en Sepolia:

| Operación | Gas |
|-----------|-----|
| Deploy | 2.861.266 |
| `mint` | ~114.900 |
| `water` | ~30.750 |
| `tokenURI` (lectura) | 0 — es una `view`, se lee off-chain |

El SVG on-chain (lleno de strings) hace que el deploy sea la parte cara; mintear y regar son baratos. En una L2 como Arbitrum el mismo gas cuesta centavos — que es exactamente donde el arte on-chain tiene sentido.

---

## Stack

Solidity 0.8.24 · Foundry · OpenZeppelin (ERC-721, Base64, Strings) · Next.js · wagmi · viem · TypeScript · Tailwind CSS
