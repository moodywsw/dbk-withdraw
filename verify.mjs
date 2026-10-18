import fs from 'fs'
import { decodeFunctionData, createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { parseAbi } from 'viem'
const portalAbi = parseAbi(['function proveWithdrawalTransaction((uint256 nonce,address sender,address target,uint256 value,uint256 gasLimit,bytes data) _tx,uint256 _l2OutputIndex,(bytes32 version,bytes32 stateRoot,bytes32 messagePasserStorageRoot,bytes32 latestBlockhash) _outputRootProof,bytes[] _withdrawalProof)','function finalizeWithdrawalTransaction((uint256 nonce,address sender,address target,uint256 value,uint256 gasLimit,bytes data) _tx)'])
const [tx] = JSON.parse(fs.readFileSync('sent.json'))
console.log('to', tx.to, 'value', tx.value ?? '0', 'from', tx.from, 'gas', tx.gas)
const d = decodeFunctionData({ abi: portalAbi, data: tx.data })
console.log(d.functionName, JSON.stringify(d.args[0], (k,v)=>typeof v==='bigint'?v.toString():v), 'outputIndex', d.args[1].toString(), 'proofNodes', d.args[3].length)
const c = createPublicClient({ chain: mainnet, transport: http('https://ethereum-rpc.publicnode.com') })
const r = await c.call({ account: tx.from, to: tx.to, data: tx.data }).then(()=> 'eth_call SUCCESS (would not revert)').catch(e=>'REVERT '+e.shortMessage)
console.log(r)
