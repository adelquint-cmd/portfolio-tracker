// PortfolioTracker PT — cotacoes.js (Yahoo via proxy, aliases, câmbios)
// ── COTAÇÕES ──────────────────────────────────────────────────────────────────
function yahooSym(ticker2,assetType){const es={'SXR8':'.DE','EMIM':'.L','IWDA':'.L','VWCE':'.DE','QDV5':'.DE','IS0E':'.DE','2B78':'.DE','IUSP':'.AS','H4Z7':'.DE','IUSQ':'.DE','IBAB':'.BR','XESC':'.DE','GOAI':'.DE','ESIT':'.DE','WTEM':'.DE','EPRU':'.AS','SHL':'.DE','STLAM':'.MI','RYAAY':'.L'};if(es[ticker2])return ticker2+es[ticker2];if(assetType==='Cripto')return ticker2+'-EUR';return ticker2;}
// Proxy CORS — só allorigins que já funciona na tua rede
// query1 e query2 do Yahoo são intercambiáveis — alternamos para distribuir carga


// Mapa de aliases — ticker app → símbolo Yahoo Finance correto
const TICKER_ALIASES={
  'DOC1':'DOC','STLAM':'STLA','RYAAY':'RYA.L',
  'H4Z7':'H4Z7.DE','IUSQ':'IUSQ.DE','IBAB':'IBAB.BR',
  'SXR8':'SXR8.DE','EMIM':'EMIM.L','IWDA':'IWDA.L','VWCE':'VWCE.DE',
  'QDV5':'QDV5.DE','IS0E':'IS0E.DE','2B78':'2B78.DE','WTEM':'WTEM.DE',
  'GOAI':'GOAI.DE','XESC':'XESC.DE','ESIT':'ESIT.DE','EPRU':'EPRU.AS',
  'BCP':'BCP.LS','EDP':'EDP.LS','GALP':'GALP.LS','NOS':'NOS.LS',
  'NOVO-B':'NOVO-B.CO','NOVOB':'NOVO-B.CO',
  'BSX.US':'BSX','BRK.B':'BRK-B','MDT.US':'MDT','CVX.US':'CVX',
  'DASH.US':'DASH','CYBR.L':'CYBR','ARKI.L':'ARKI',
  'SMSN.L':'005930.KS',
  'ADS.de':'ADS.DE','ALV.de':'ALV.DE','MUV2.de':'MUV2.DE',
  'VOW3.de':'VOW3.DE','BAYN.de':'BAYN.DE','BMW.de':'BMW.DE',
  'MC.PA':'MC.PA','RMS.PA':'RMS.PA','AIR':'AIR.PA',
  'SAP.de':'SAP.DE','HOLN.ZU':'HOLN.SW','LONN.ZU':'LONN.SW',
  'SGSN.CHF':'SGSN.SW','ZURN.CHF':'ZURN.SW',
  'WKL.NV':'WKL.AS','INGA.NV':'ING.AS','DSM.NV':'DSM.AS',
  'SOF.BR':'SOFB.BR','WDP.BR':'WDP.BR','ARGX.BR':'ARGX.BR',
  'NIBEB.ST':'NIBE-B.ST','CAST.ST':'CAST-B.ST',
  'GAW.GBX':'GAW.L','RKT.L':'RKT.L','HLMA.GBX':'HLMA.L','WIZZ.GBX':'WIZZ.L',
  'HSBA.l':'HSBA.L',
  'NDA.DE':'NDA.HE','FORTUM':'FORTUM.HE','KNEBV':'KNEBV.HE',
  'ENC.MC':'ENC.MC','ANA':'ANA.MC','IDR.MC':'IDR.MC',
  'LOG.MC':'LOG.MC','AENA.MC':'AENA.MC','REP.MC':'REP.MC',
  'PHM.MC':'PHM.MC','ENG':'ENG.MC','CPR':'CPR.MI','ENI':'ENI.MI',
  'TEN':'TEN.MI','FNC':'FBK.MI','FNC.MI':'FBK.MI','ITX':'ITX.MC',
  '01211.HK':'1211.HK','01211':'1211.HK',
  'EL.PA':'EL.PA','SAN.PA':'SAN.PA','ERF.PA':'ERF.PA',
  'TELFY':'TEF','NKLAQ':'NKLA',
};

async function fetchQuote(ticker2,timeoutMs=10000){
  const fx=window.PT.fxEURUSD||1.09;
  const fxGBP=window.PT.fxEURGBP||0.856;
  const fxCHF=window.PT.fxEURCHF||0.946;
  const fxSEK=window.PT.fxEURSEK||11.5;
  const fxNOK=window.PT.fxEURNOK||11.8;
  const fxDKK=window.PT.fxEURDKK||7.46;
  const fxHKD=window.PT.fxEURHKD||8.5;
  const yahooUrl=`https://query1.finance.yahoo.com/v8/finance/chart/${ticker2}?interval=1d&range=1d`;
  const proxy=`https://portfolio-proxy-yc3o.onrender.com/?url=${encodeURIComponent(yahooUrl)}`;
  try{
    const resp=await fetch(proxy,{signal:AbortSignal.timeout(timeoutMs)});
    if(!resp.ok)return null;
    const text=await resp.text();
    if(!text||text.length<10)return null;
    const data=JSON.parse(text);
    const result=data?.chart?.result?.[0];if(!result)return null;
    const meta=result.meta;const price=meta.regularMarketPrice;
    const prev=meta.previousClose||meta.chartPreviousClose||price;
    if(!price||price<=0)return null;
    const currency=meta.currency||'USD';
    let priceEUR=price;
    if(currency==='USD')priceEUR=price/fx;
    else if(currency==='GBp')priceEUR=price/100/fxGBP;
    else if(currency==='GBP')priceEUR=price/fxGBP;
    else if(currency==='CHF')priceEUR=price/fxCHF;
    else if(currency==='DKK')priceEUR=price/fxDKK;
    else if(currency==='SEK')priceEUR=price/fxSEK;
    else if(currency==='NOK')priceEUR=price/fxNOK;
    else if(currency==='HKD')priceEUR=price/fxHKD;
    return{price,prev,priceEUR,change:price-prev,changePct:prev>0?((price-prev)/prev)*100:0,currency};
  }catch(e){return null;}
}


async function refreshQuotes(){
  const pos=window.PT.positions;if(!pos.length){notify('Sem posições');return;}
  const btn=document.getElementById('btn-quotes');
  btn.innerHTML='<span class="spinner"></span> A carregar...';
  btn.disabled=true;
  const results={ok:[],fail:[],alias:[]};

  // EUR/USD live
  // Taxas de câmbio dinâmicas
  // 1º pedido com 60s: o proxy no Render (gratuito) adormece e demora ~20-30s a acordar
  btn.innerHTML='<span class="spinner"></span> A acordar o proxy...';
  try{const fxQ=await fetchQuote('EURUSD=X',60000);if(fxQ&&fxQ.price>0)window.PT.fxEURUSD=fxQ.price;else console.warn('[Cotações] proxy não respondeu ao EURUSD');}catch(e){}
  if(!window.PT.fxEURUSD)window.PT.fxEURUSD=1.09;
  // Buscar outras taxas em paralelo
  try{
    const [gbp,chf,sek,nok,dkk,hkd]=await Promise.all([
      fetchQuote('EURGBP=X'),fetchQuote('EURCHF=X'),fetchQuote('EURSEK=X'),
      fetchQuote('EURNOK=X'),fetchQuote('EURDKK=X'),fetchQuote('EURHKD=X')
    ]);
    if(gbp?.price>0)window.PT.fxEURGBP=gbp.price;
    if(chf?.price>0)window.PT.fxEURCHF=chf.price;
    if(sek?.price>0)window.PT.fxEURSEK=sek.price;
    if(nok?.price>0)window.PT.fxEURNOK=nok.price;
    if(dkk?.price>0)window.PT.fxEURDKK=dkk.price;
    if(hkd?.price>0)window.PT.fxEURHKD=hkd.price;
  }catch(e){}

  const CACHE_MS=15*60*1000;
  const tickers=[...new Set(pos.map(p=>p.ticker))];

  // Cache vs expirados
  const toFetch=[];
  for(const t of tickers){
    const ex=window.PT.quotes[t];
    if(ex&&ex.fetchedAt&&(Date.now()-ex.fetchedAt)<CACHE_MS){
      results.ok.push({ticker:t,sym:t,price:ex.priceEUR,currency:ex.currency,changePct:ex.changePct||0,cached:true});
    } else toFetch.push(t);
  }

  if(!toFetch.length){
    btn.innerHTML='↻ Cotações';btn.disabled=false;
    renderDashboard();updateQuotesCoverage();filterPos(window.PT.posFilter.type,window.PT.posFilter.broker,null);
    showQuotesPopup(results,tickers.length);return;
  }

  // Em HTTPS vai tudo em paralelo direto ao Yahoo — rápido
  // Em file:// vai em lotes menores para não sobrecarregar o proxy
  const isHttps=location.protocol==='https:'||location.hostname==='localhost';
  const BATCH=isHttps?toFetch.length:8;
  let done=0;
  btn.innerHTML=`<span class="spinner"></span> 0/${toFetch.length}`;
  for(let i=0;i<toFetch.length;i+=BATCH){
    const batch=toFetch.slice(i,i+BATCH);
    await Promise.all(batch.map(async ticker2=>{
      const p=pos.find(p2=>p2.ticker===ticker2);
      const sym=TICKER_ALIASES[ticker2]||yahooSym(ticker2,p?.assetType||'Ação');
      let q=await fetchQuote(sym);
      if(!q&&sym.includes('.')){q=await fetchQuote(sym.split('.')[0]);if(q)results.alias.push({ticker:ticker2,tried:sym,usedAlias:sym.split('.')[0]});}
      if(!q&&TICKER_ALIASES[ticker2]&&TICKER_ALIASES[ticker2]!==sym){q=await fetchQuote(TICKER_ALIASES[ticker2]);if(q)results.alias.push({ticker:ticker2,tried:sym,usedAlias:TICKER_ALIASES[ticker2]});}
      if(q&&isFinite(q.priceEUR)&&q.priceEUR>0){
        window.PT.quotes[ticker2]={...q,fetchedAt:Date.now()};
        results.ok.push({ticker:ticker2,sym,price:q.priceEUR,currency:q.currency,changePct:q.changePct||0,cached:false});
      } else {
        results.fail.push({ticker:ticker2,sym});
      }
      done++;
      btn.innerHTML=`<span class="spinner"></span> ${done}/${toFetch.length}`;
    }));
    if(i+BATCH<toFetch.length) await new Promise(r=>setTimeout(r,300));
  }

  window.PT.quotesTime=new Date().toLocaleTimeString('pt-PT');
  btn.innerHTML='↻ Cotações';btn.disabled=false;
  renderDashboard();updateQuotesCoverage();filterPos(window.PT.posFilter.type,window.PT.posFilter.broker,null);
  showQuotesPopup(results,tickers.length);
}


function forceRefreshAll(){
  // Limpa timestamps de cache para forçar atualização de tudo
  Object.keys(window.PT.quotes).forEach(t=>{if(window.PT.quotes[t])window.PT.quotes[t].fetchedAt=0;});
  closeModal('modal-quotes-result');
  refreshQuotes();
}

function showQuotesPopup(results,total){
  let modal=document.getElementById('modal-quotes-result');
  if(!modal){
    modal=document.createElement('div');modal.id='modal-quotes-result';modal.className='modal-overlay';
    modal.innerHTML=`<div class="modal" style="width:min(580px,100%);"><div class="modal-title">↻ Resultado das Cotações</div><div id="qr-body"></div><div class="modal-footer"><button class="btn" onclick="forceRefreshAll()" title="Ignora cache e atualiza tudo">↻ Forçar tudo</button><button class="btn btn-primary" onclick="closeModal('modal-quotes-result')">Fechar</button></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',function(e){if(e.target===this)closeModal('modal-quotes-result');});
  }
  const ok=results.ok.length,fail=results.fail.length,alias=results.alias.length;
  const cached=results.ok.filter(r=>r.cached).length;
  const fresh=ok-cached;
  let html=`
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:14px;">
    <div style="background:var(--accent-light);border-radius:var(--radius-sm);padding:10px;text-align:center;">
      <div style="font-size:22px;font-weight:300;color:var(--accent-dark);">${fresh}</div>
      <div style="font-size:10px;color:var(--accent-dark);text-transform:uppercase;letter-spacing:0.05em;">Atualizadas</div>
    </div>
    <div style="background:var(--color-background-secondary);border-radius:var(--radius-sm);padding:10px;text-align:center;">
      <div style="font-size:22px;font-weight:300;color:var(--color-text-secondary);">${cached}</div>
      <div style="font-size:10px;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.05em;">Em cache</div>
    </div>
    <div style="background:var(--amber-light);border-radius:var(--radius-sm);padding:10px;text-align:center;">
      <div style="font-size:22px;font-weight:300;color:var(--amber);">${alias}</div>
      <div style="font-size:10px;color:var(--amber);text-transform:uppercase;letter-spacing:0.05em;">Via alias</div>
    </div>
    <div style="background:${fail>0?'var(--red-light)':'var(--color-background-secondary)'};border-radius:var(--radius-sm);padding:10px;text-align:center;">
      <div style="font-size:22px;font-weight:300;color:${fail>0?'var(--red)':'var(--color-text-secondary)'};">${fail}</div>
      <div style="font-size:10px;color:${fail>0?'var(--red)':'var(--color-text-secondary)'};text-transform:uppercase;letter-spacing:0.05em;">Falharam</div>
    </div>
  </div>
  <div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:10px;">EUR/USD: <strong>${(window.PT.fxEURUSD||1.09).toFixed(4)}</strong> · ${cached>0?`${cached} em cache (&lt;15min) · `:''}Atualizado às ${window.PT.quotesTime}</div>
  <div style="max-height:300px;overflow-y:auto;border:0.5px solid var(--color-border-tertiary);border-radius:var(--radius-sm);">
  <table style="width:100%;border-collapse:collapse;font-size:12px;">
  <thead><tr style="background:var(--color-background-secondary);position:sticky;top:0;">
    <th style="padding:7px 10px;text-align:left;font-size:10px;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.04em;">Ticker</th>
    <th style="padding:7px 10px;text-align:left;font-size:10px;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.04em;">Yahoo</th>
    <th style="padding:7px 10px;text-align:right;font-size:10px;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.04em;">Cotação €</th>
    <th style="padding:7px 10px;text-align:right;font-size:10px;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.04em;">Var%</th>
    <th style="padding:7px 10px;text-align:center;font-size:10px;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.04em;">Estado</th>
  </tr></thead><tbody>`;
  results.ok.forEach(r=>{
    const isAlias=results.alias.find(a=>a.ticker===r.ticker);
    const badge=r.cached
      ?'<span style="font-size:10px;background:var(--color-background-secondary);color:var(--color-text-secondary);padding:2px 6px;border-radius:3px;">cache</span>'
      :isAlias
        ?'<span style="font-size:10px;background:var(--amber-light);color:var(--amber);padding:2px 6px;border-radius:3px;">alias</span>'
        :'<span style="font-size:10px;background:var(--accent-light);color:var(--accent-dark);padding:2px 6px;border-radius:3px;">✓ ok</span>';
    html+=`<tr style="border-top:0.5px solid var(--color-border-tertiary);">
      <td style="padding:7px 10px;font-weight:500;${r.cached?'color:var(--color-text-secondary);':''}">${r.ticker}</td>
      <td style="padding:7px 10px;font-family:monospace;font-size:11px;color:var(--color-text-secondary);">${isAlias?isAlias.usedAlias:r.sym}</td>
      <td style="padding:7px 10px;text-align:right;">€${r.price.toFixed(2)}</td>
      <td style="padding:7px 10px;text-align:right;color:${r.changePct>=0?'var(--accent-dark)':'var(--red)'};">${r.cached?'—':((r.changePct>=0?'+':'')+r.changePct.toFixed(2)+'%')}</td>
      <td style="padding:7px 10px;text-align:center;">${badge}</td>
    </tr>`;
  });
  results.fail.forEach(r=>{
    html+=`<tr style="border-top:0.5px solid var(--color-border-tertiary);">
      <td style="padding:7px 10px;font-weight:500;color:var(--red);">${r.ticker}</td>
      <td style="padding:7px 10px;font-family:monospace;font-size:11px;color:var(--color-text-secondary);">${r.sym}</td>
      <td style="padding:7px 10px;text-align:right;color:var(--color-text-secondary);">—</td>
      <td style="padding:7px 10px;text-align:right;">—</td>
      <td style="padding:7px 10px;text-align:center;"><span style="font-size:10px;background:var(--red-light);color:var(--red);padding:2px 6px;border-radius:3px;border:0.5px solid var(--red);">✗ falhou</span></td>
    </tr>`;
  });
  html+=`</tbody></table></div>`;
  if(results.fail.length>0){
    html+=`<div class="alert alert-warn" style="margin-top:10px;font-size:12px;">
      ⚠️ ${results.fail.length} ticker${results.fail.length>1?'s':''} sem cotação — o valor mostrado é o custo de aquisição.<br>
      <span style="font-size:11px;">Verifica o símbolo no <a href="https://finance.yahoo.com" target="_blank" style="color:var(--amber);">Yahoo Finance</a> e usa "+ Transação" para corrigir o ticker se necessário.</span>
    </div>`;
  }
  document.getElementById('qr-body').innerHTML=html;
  openModal('modal-quotes-result');
}


