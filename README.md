# dbk-withdraw

Static page to prove and finalize a DBK Chain → Ethereum withdrawal on the official OptimismPortal
(0x63CA00232F471bE2A3Bf3C4e95Bc1d2B3EA5DB92). No server, no keys, no token approvals: it reads public RPCs
and asks your wallet to sign `proveWithdrawalTransaction` / `finalizeWithdrawalTransaction` (0 ETH value).

Built with viem (bundled, no CDN): `npx esbuild src/app.mjs --bundle --minify --format=iife --target=es2020 --outfile=docs/app.js`
