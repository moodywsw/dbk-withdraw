import { inspect, dbk, formatEther } from './core.mjs'
const H='0xa649c6a83266bfd63324b7d375144412206acce65f06905f49e1104d2fa54f70'
const {l1,l2,receipt,w,status}=await inspect(H)
console.log('withdrawal', {...w, value: formatEther(w.value)+' ETH', nonce:w.nonce.toString(), gasLimit:w.gasLimit.toString()})
console.log('status', status)
const output = await l1.getL2Output({l2BlockNumber: receipt.blockNumber, targetChain: dbk})
console.log('output', output.outputIndex, output.l2BlockNumber)
const args = await l2.buildProveWithdrawal({output, withdrawal: w, account: w.target})
console.log('proof nodes', args.withdrawalProof.length, 'l2OutputIndex', args.l2OutputIndex)
// read-only simulation from the user's address
const gas = await l1.estimateProveWithdrawalGas({...args, account: w.target, targetChain: dbk}).catch(e=>'ESTIMATE ERR '+e.shortMessage)
console.log('prove gas estimate', gas)
