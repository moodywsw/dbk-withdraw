import { createPublicClient, http, defineChain, formatEther } from 'viem'
import { mainnet } from 'viem/chains'
import { publicActionsL1, publicActionsL2, getWithdrawals } from 'viem/op-stack'
export const dbk = defineChain({
  id: 20240603, name: 'DBK Chain', nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},
  rpcUrls:{default:{http:['https://rpc.mainnet.dbkchain.io']}},
  blockExplorers:{default:{name:'DBK Scan',url:'https://scan.dbkchain.io'}},
  sourceId: 1,
  contracts:{
    portal:{1:{address:'0x63CA00232F471bE2A3Bf3C4e95Bc1d2B3EA5DB92'}},
    l2OutputOracle:{1:{address:'0x0341bb689CB8a4c16c61307F4BdA254E1bFD525e'}},
    l1StandardBridge:{1:{address:'0x28f1b9F457CB51E0af56dff1d11CD6CEdFfD1977'}},
    multicall3:{address:'0xcA11bde05977b3631167028862bE2a173976CA11'}
  }
})
export function clients(l1Rpc='https://ethereum-rpc.publicnode.com'){
  const l1 = createPublicClient({chain:mainnet, transport:http(l1Rpc)}).extend(publicActionsL1())
  const l2 = createPublicClient({chain:dbk, transport:http()}).extend(publicActionsL2())
  return {l1,l2}
}
export async function inspect(hash, l1Rpc){
  const {l1,l2}=clients(l1Rpc)
  const receipt = await l2.getTransactionReceipt({hash})
  const [w] = getWithdrawals(receipt)
  if(!w) throw new Error('No withdrawal in this transaction')
  const status = await l1.getWithdrawalStatus({receipt, targetChain:dbk})
  return {l1,l2,receipt,w,status}
}
export { formatEther }
