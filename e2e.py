import json, threading, http.server, functools, time
from playwright.sync_api import sync_playwright
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8765), functools.partial(http.server.SimpleHTTPRequestHandler, directory='docs'))
threading.Thread(target=srv.serve_forever, daemon=True).start()
MOCK = """
window.__sent = [];
window.ethereum = { isMock:true, request: async ({method, params}) => {
  const A='0x3D25EB40e6e41800e4A3863921D119cDBafee0c7';
  if (method==='eth_requestAccounts'||method==='eth_accounts') return [A];
  if (method==='eth_chainId') return '0x1';
  if (method==='wallet_switchEthereumChain') return null;
  if (method==='eth_sendTransaction') { window.__sent.push(params[0]); throw Object.assign(new Error('mock: user rejected'), {code:4001}); }
  const r = await fetch('https://ethereum-rpc.publicnode.com',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  const j = await r.json(); if (j.error) throw Object.assign(new Error(j.error.message), j.error); return j.result;
}};
"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    ctx0=b.new_page(); ce=[]; ctx0.on('console', lambda m: ce.append(m.text)); ctx0.goto('http://127.0.0.1:8765/'); time.sleep(6); print('NO-BYPASS status:', ctx0.inner_text('#status')); print('NO-BYPASS console:', ce)
    pg = b.new_page(bypass_csp=True, viewport={'width':390,'height':844}, is_mobile=True, device_scale_factor=2)
    errs=[]; pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.add_init_script(MOCK)
    pg.goto('http://127.0.0.1:8765/')
    pg.wait_for_function("document.getElementById('status').textContent.length>3 && !document.getElementById('status').textContent.startsWith('A verificar')", timeout=30000)
    print('STATUS:', pg.inner_text('#status'), '|', pg.inner_text('#amount'))
    pg.click('#connect'); pg.wait_for_selector('#prove:not([hidden])', timeout=20000)
    time.sleep(1); print('ACCT:', pg.inner_text('#acct'))
    pg.screenshot(path='/workspace/dbk-withdraw/shot1.png', full_page=True)
    pg.click('#prove')
    pg.wait_for_function("window.__sent.length>0", timeout=60000)
    sent = pg.evaluate("window.__sent"); time.sleep(1)
    print('LOG:', pg.inner_text('#log'))
    json.dump(sent, open('sent.json','w'))
    pg.screenshot(path='/workspace/dbk-withdraw/shot2.png', full_page=True)
    print('CONSOLE:', errs[:10])
    b.close()
