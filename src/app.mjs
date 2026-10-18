import { createPublicClient, createWalletClient, custom, http, fallback, defineChain, formatEther, isHash } from 'viem'
import { mainnet } from 'viem/chains'
import { publicActionsL1, publicActionsL2, walletActionsL1, getWithdrawals } from 'viem/op-stack'

const dbk = defineChain({
  id: 20240603, name: 'DBK Chain', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.dbkchain.io'] } },
  sourceId: 1,
  contracts: {
    portal: { 1: { address: '0x63CA00232F471bE2A3Bf3C4e95Bc1d2B3EA5DB92' } },
    l2OutputOracle: { 1: { address: '0x0341bb689CB8a4c16c61307F4BdA254E1bFD525e' } },
  },
})
const DEFAULT_TX = '0xa649c6a83266bfd63324b7d375144412206acce65f06905f49e1104d2fa54f70'
const l1 = createPublicClient({ chain: mainnet, transport: fallback([
  http('https://ethereum-rpc.publicnode.com'), http('https://eth.drpc.org'), http('https://cloudflare-eth.com')]) }).extend(publicActionsL1())
const l2 = createPublicClient({ chain: dbk, transport: http() }).extend(publicActionsL2())

const $ = (id) => document.getElementById(id)
const short = (a) => a.slice(0, 6) + '…' + a.slice(-4)
const log = (msg, cls = '') => { const p = document.createElement('p'); p.className = cls; p.innerHTML = msg; $('log').prepend(p) }
const STATUS = {
  'waiting-to-prove': ['⏳ À espera do Ethereum (ainda não dá para provar). Volta daqui a 1–2 h.', 'warn'],
  'ready-to-prove': ['🟡 Pronto para PROVAR (passo 1 de 2).', 'warn'],
  'waiting-to-finalize': ['⏳ Provado. Agora espera 7 dias até poder FINALIZAR.', 'warn'],
  'ready-to-finalize': ['🟢 Pronto para FINALIZAR (passo 2 de 2).', 'ok'],
  'finalized': ['✅ Concluído. O ETH já foi para a tua carteira no Ethereum.', 'ok'],
}
let state = { receipt: null, w: null, status: null, account: null, wallet: null }

function provider() {
  return (window.phantom && window.phantom.ethereum) || window.ethereum || null
}

async function check() {
  const hash = $('tx').value.trim()
  if (!isHash(hash)) { log('Hash da transação inválido.', 'err'); return }
  history.replaceState(null, '', '?tx=' + hash)
  $('status').textContent = 'A verificar…'; $('status').className = ''
  try {
    const receipt = await l2.getTransactionReceipt({ hash })
    const [w] = getWithdrawals(receipt)
    if (!w) throw new Error('Esta transação não tem levantamento DBK → Ethereum.')
    const status = await l1.getWithdrawalStatus({ receipt, targetChain: dbk })
    state = { ...state, receipt, w, status }
    $('amount').textContent = formatEther(w.value) + ' ETH'
    $('to').innerHTML = `<a href="https://etherscan.io/address/${w.target}" target="_blank" rel="noopener">${short(w.target)}</a>`
    const [txt, cls] = STATUS[status] || [status, '']
    $('status').textContent = txt; $('status').className = cls
    if (status === 'waiting-to-finalize') {
      const t = await l1.getTimeToFinalize({ withdrawalHash: w.withdrawalHash, targetChain: dbk })
      const d = new Date(Date.now() + t.seconds * 1000)
      $('status').textContent += ` Disponível a ${d.toLocaleString('pt-PT')}.`
    }
    render()
  } catch (e) { $('status').textContent = 'Erro: ' + (e.shortMessage || e.message); $('status').className = 'err' }
}

function render() {
  const s = state.status
  $('connect').hidden = !!state.account
  $('acct').textContent = state.account ? 'Carteira: ' + short(state.account) : ''
  $('prove').hidden = !(state.account && s === 'ready-to-prove')
  $('finalize').hidden = !(state.account && s === 'ready-to-finalize')
  if (state.account && state.w && state.account.toLowerCase() !== state.w.target.toLowerCase())
    $('acct').innerHTML += ' <span class="warn">(não é a carteira de destino; o ETH vai sempre para ' + short(state.w.target) + ', mas pagas tu o gás)</span>'
}

async function connect() {
  const eth = provider()
  if (!eth) { log('Nenhuma carteira encontrada. Abre esta página dentro do browser da Phantom (ou Rabby/MetaMask).', 'err'); return }
  try {
    const [account] = await eth.request({ method: 'eth_requestAccounts' })
    const chainId = await eth.request({ method: 'eth_chainId' })
    if (parseInt(chainId, 16) !== 1) await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] })
    state.account = account
    state.wallet = createWalletClient({ account, chain: mainnet, transport: custom(eth) }).extend(walletActionsL1())
    const bal = await l1.getBalance({ address: account })
    const gp = await l1.getGasPrice()
    const need = (state.status === 'ready-to-finalize' ? 130000n : 300000n) * gp * 2n
    log(`Saldo no Ethereum: ${Number(formatEther(bal)).toFixed(5)} ETH · gás estimado do próximo passo ≈ ${Number(formatEther(need / 2n)).toFixed(6)} ETH`)
    if (bal < need) log('⚠️ Precisas de um pouco de ETH na rede Ethereum (não DBK) nesta carteira para pagar o gás.', 'warn')
    render()
  } catch (e) { log('Erro ao ligar: ' + (e.shortMessage || e.message), 'err') }
}

async function waitAndRefresh(hash) {
  log(`Transação enviada: <a href="https://etherscan.io/tx/${hash}" target="_blank" rel="noopener">${short(hash)}</a>. A aguardar confirmação…`)
  const r = await l1.waitForTransactionReceipt({ hash })
  log(r.status === 'success' ? '✅ Confirmada.' : '❌ Falhou on-chain.', r.status === 'success' ? 'ok' : 'err')
  await check()
}

async function prove() {
  try {
    $('prove').disabled = true
    log('A construir a prova (dados públicos da DBK Chain)…')
    const output = await l1.getL2Output({ l2BlockNumber: state.receipt.blockNumber, targetChain: dbk })
    const args = await l2.buildProveWithdrawal({ output, withdrawal: state.w, account: state.account })
    const hash = await state.wallet.proveWithdrawal({ ...args, account: state.account, targetChain: dbk })
    await waitAndRefresh(hash)
  } catch (e) { log('Erro: ' + (e.shortMessage || e.message), 'err') } finally { $('prove').disabled = false }
}

async function finalize() {
  try {
    $('finalize').disabled = true
    const hash = await state.wallet.finalizeWithdrawal({ withdrawal: state.w, account: state.account, targetChain: dbk })
    await waitAndRefresh(hash)
  } catch (e) { log('Erro: ' + (e.shortMessage || e.message), 'err') } finally { $('finalize').disabled = false }
}

window.addEventListener('DOMContentLoaded', () => {
  const q = new URLSearchParams(location.search).get('tx')
  $('tx').value = q && isHash(q) ? q : DEFAULT_TX
  $('check').onclick = check; $('connect').onclick = connect; $('prove').onclick = prove; $('finalize').onclick = finalize
  check()
})
