// PortfolioTracker PT — app.js (estado, importação, posições, dashboard, backup, UI)
// ══════════════════════════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ══════════════════════════════════════════════════════════════════════════════
window.PT={
  transactions:[],positions:[],broker:'DEGIRO',pending:null,
  quotes:{},posFilter:{type:'all',broker:'all',period:'all',from:'',to:'',view:'pos'},
  divFilter:{period:'ytd',broker:'all',from:'',to:'',view:'list'},
  cashFilter:{period:'all',broker:'all',from:'',to:''},
  degiro:{txnParsed:null,accParsed:null},
  txnType:'BUY'
};
document.getElementById('btn-confirm').addEventListener('click',confirmImport);
document.getElementById('btn-cancel').addEventListener('click',cancelImport);


// ── MANUAL TRANSACTION ────────────────────────────────────────────────────────
function setTxnType(type){
  window.PT.txnType=type;
  ['buy','sell','div'].forEach(t=>{const btn=document.getElementById('ttab-'+t);btn.className='type-tab';});
  document.getElementById('ttab-'+type.toLowerCase()).className='type-tab active-'+type.toLowerCase();
  document.getElementById('wht-field').style.display=type==='DIV'?'block':'none';
  updateTxnPreview();
}
function updateTxnPreview(){
  const qty=parseFloat(document.getElementById('txn-qty').value)||0;
  const price=parseFloat(document.getElementById('txn-price').value)||0;
  const comm=parseFloat(document.getElementById('txn-comm').value)||0;
  const total=qty*price;
  const p=document.getElementById('txn-preview');
  if(qty>0&&price>0){p.textContent=`Total: €${fmt(total,2)} ${comm>0?`| Comissão: €${comm.toFixed(2)}`:''}`;} else {p.textContent='';}
}
['txn-qty','txn-price','txn-comm'].forEach(id=>document.getElementById(id).addEventListener('input',updateTxnPreview));

function addManualTxn(){
  const date=document.getElementById('txn-date').value;
  const ticker=(document.getElementById('txn-ticker').value||'').toUpperCase().trim();
  const product=document.getElementById('txn-product').value.trim()||ticker;
  const isin=(document.getElementById('txn-isin').value||'').trim().toUpperCase();
  const qty=parseFloat(document.getElementById('txn-qty').value)||0;
  const price=parseFloat(document.getElementById('txn-price').value)||0;
  const comm=parseFloat(document.getElementById('txn-comm').value)||0;
  const wht=parseFloat(document.getElementById('txn-wht').value)||0;
  const broker=document.getElementById('txn-broker-sel').value;
  const assetType=document.getElementById('txn-asset-type').value;
  const type=window.PT.txnType;
  if(!date){notify('Indica a data');return;}
  if(!ticker){notify('Indica o ticker');return;}
  if(qty<=0&&type!=='DIV'){notify('Indica a quantidade');return;}
  if(price<=0){notify('Indica o preço');return;}
  const txn={date:nd(date),ticker,product,isin,type,qty:qty||1,price,total:qty*price||price,currency:'EUR',broker,assetType,commission:comm,autofx:0,totalCost:comm,wht};
  window.PT.transactions.push(txn);
  window.PT.transactions.sort((a,b)=>new Date(a.date)-new Date(b.date));
  computePositions();updateFilters();
  closeModal('modal-txn');
  notify(`✓ ${type==='BUY'?'Compra':type==='SELL'?'Venda':'Dividendo'} de ${ticker} adicionada`);
  // Reset form
  document.getElementById('txn-qty').value='';document.getElementById('txn-price').value='';document.getElementById('txn-comm').value='0';document.getElementById('txn-wht').value='0';document.getElementById('txn-isin').value='';document.getElementById('txn-preview').textContent='';
}

// Set today's date on modal open
document.getElementById('modal-txn').addEventListener('click',function(e){if(e.target===this){closeModal('modal-txn');}});
function openModal(id){
  document.getElementById(id).classList.add('open');
  if(id==='modal-txn'&&!document.getElementById('txn-date').value){document.getElementById('txn-date').value=new Date().toISOString().split('T')[0];}
}


// ── DEGIRO DUAL UPLOAD ────────────────────────────────────────────────────────
function handleDEGIROFile(type,input){
  const file=input.files[0];if(!file)return;const reader=new FileReader();
  reader.onload=ev=>{try{if(type==='txn'){window.PT.degiro.txnParsed=parseDEGIRO_TXN(ev.target.result);const n=window.PT.degiro.txnParsed.length,b=window.PT.degiro.txnParsed.filter(t=>t.type==='BUY').length,s=window.PT.degiro.txnParsed.filter(t=>t.type==='SELL').length;document.getElementById('degiro-txn-status').textContent=`✓ ${n} transações (${b}↑ ${s}↓)`;document.getElementById('degiro-txn-status').className='upload-status ok';}else{window.PT.degiro.accParsed=parseDEGIRO_ACC(ev.target.result);const divs=window.PT.degiro.accParsed.filter(t=>t.type==='DIV').length,fees=window.PT.degiro.accParsed.filter(t=>t.type==='FEE').length,wht=window.PT.degiro.accParsed.filter(t=>t.type==='DIV').reduce((s,t)=>s+(t.wht||0),0);document.getElementById('degiro-acc-status').textContent=`✓ ${divs} dividendos, ${fees} taxas (WHT €${wht.toFixed(2)})`;document.getElementById('degiro-acc-status').className='upload-status ok';}const hasTxn=window.PT.degiro.txnParsed!==null,hasAcc=window.PT.degiro.accParsed!==null;document.getElementById('degiro-import-btn').disabled=!hasTxn&&!hasAcc;}catch(err){notify('Erro: '+err.message);}};
  reader.readAsText(file,'UTF-8');
}
function confirmDEGIROImport(){
  const combined=[];
  if(window.PT.degiro.txnParsed)combined.push(...window.PT.degiro.txnParsed);
  if(window.PT.degiro.accParsed)combined.push(...window.PT.degiro.accParsed);
  if(!combined.length){notify('Nada para importar');return;}

  // Construir log para o sumário
  const log=[];
  if(window.PT.degiro.txnParsed){
    const b=window.PT.degiro.txnParsed.filter(t=>t.type==='BUY').length;
    const s=window.PT.degiro.txnParsed.filter(t=>t.type==='SELL').length;
    log.push(`[Transações] ${b} compras | ${s} vendas`);
    log.push(...(parseDEGIRO_TXN.lastLog||[]));
  }
  if(window.PT.degiro.accParsed){
    const divs=window.PT.degiro.accParsed.filter(t=>t.type==='DIV').length;
    const fees=window.PT.degiro.accParsed.filter(t=>t.type==='FEE').length;
    const wht=window.PT.degiro.accParsed.filter(t=>t.type==='DIV').reduce((s,t)=>s+(t.wht||0),0);
    log.push(`[Extrato] ${divs} dividendos | ${fees} taxas conectividade | WHT €${wht.toFixed(2)}`);
    log.push(...(parseDEGIRO_ACC.lastLog||[]));
  }

  // Guardar callback de confirmação para depois do modal
  window.PT.pendingDEGIRO=true;
  window.PT.pending=combined;

  // Mostrar sumário — reutiliza o mesmo popup
  // Ao confirmar no modal chama confirmImport() que usa window.PT.pending
  // Mas antes de confirmar também tem de limpar o estado DEGIRO
  showPreview('DEGIRO (Transações + Extrato)',combined,'DEGIRO',log);

  // Override do botão confirmar para também limpar estado DEGIRO
  document.getElementById('sum-confirm-btn').onclick=()=>{
    closeModal('modal-summary');
    // Limpar estado DEGIRO
    window.PT.degiro={txnParsed:null,accParsed:null};
    ['degiro-txn-status','degiro-acc-status'].forEach(id=>{
      document.getElementById(id).textContent='—';
      document.getElementById(id).className='upload-status';
    });
    document.getElementById('degiro-import-btn').disabled=true;
    document.getElementById('degiro-txn-file').value='';
    document.getElementById('degiro-acc-file').value='';
    confirmImport();
  };
}

// ── FILE HANDLING ─────────────────────────────────────────────────────────────
function handleDrop(e){e.preventDefault();e.currentTarget.classList.remove('dragover');const f=e.dataTransfer.files[0];if(f)processFile(f);}
function handleFile(input){if(input.files[0])processFile(input.files[0]);}
function processFile(file){
  const ext=file.name.split('.').pop().toLowerCase(),broker=window.PT.broker;
  if(ext==='xlsx'||ext==='xls'){
    notify('A processar XLSX...');const reader=new FileReader();
    reader.onload=ev=>{try{if(typeof XLSX==='undefined'){notify('SheetJS não carregou');return;}const wb=XLSX.read(ev.target.result,{type:'array',cellDates:true});const isXTB=wb.SheetNames.some(s=>s.includes('Closed Positions')||s.includes('Cash Operations'));const isETORO=wb.SheetNames.some(s=>s.includes('fechadas')||s.toLowerCase().includes('dividend')||s.includes('tividade'));let result;if(broker==='XTB'||isXTB)result=parseXTB_XLSX(wb);else if(broker==='ETORO'||isETORO)result=parseETORO_XLSX(wb);else{notify('Formato não reconhecido — seleciona a corretora');return;}showPreview(file.name,result.transactions,isXTB?'XTB':'eToro',result.log);}catch(err){notify('Erro: '+err.message);console.error(err);}};reader.readAsArrayBuffer(file);
  }else{
    const reader=new FileReader();reader.onload=ev=>{const text=ev.target.result;if(broker==='IBKR'||text.includes('Histórico de transações')){const r=parseIBKR_PT(text);showPreview(file.name,r.transactions,'IBKR',r.log);return;}const rows=text.trim().split('\n').map(parseCSVLine);if(rows.length<2){notify('Ficheiro vazio');return;}const headers=rows[0].map(h=>h.toLowerCase().trim().replace(/^"|"$/g,''));const parsed=[];rows.slice(1).forEach(row=>{try{let t=null;if(broker==='FREEDOM24')t=parseFREEDOM24(headers,row);else t=parseManualCSV(headers,row);if(t&&t.qty>0)parsed.push(t);}catch(e){}});showPreview(file.name,parsed,broker,[`${parsed.length} transações lidas`]);};reader.readAsText(file,'UTF-8');
  }
}
function showPreview(filename,transactions,brokerLabel,log){
  window.PT.pending=transactions;

  // Calcular estatísticas
  const types={BUY:0,SELL:0,DIV:0,FEE:0};
  transactions.forEach(t=>types[t.type]=(types[t.type]||0)+1);
  const buyVol=transactions.filter(t=>t.type==='BUY').reduce((s,t)=>s+t.total,0);
  const divTotal=transactions.filter(t=>t.type==='DIV').reduce((s,t)=>s+t.total,0);
  const whtTotal=transactions.filter(t=>t.type==='DIV').reduce((s,t)=>s+(t.wht||0),0);
  const commTotal=transactions.reduce((s,t)=>s+(t.totalCost||0),0);

  // Período coberto
  const dates=transactions.map(t=>t.date).filter(Boolean).sort();
  const periodText=dates.length>0
    ? (dates[0]===dates[dates.length-1]
      ? dates[0]
      : `${dates[0]} → ${dates[dates.length-1]}`)
    : 'Período desconhecido';

  // Tickers únicos
  const tickers=[...new Set(transactions.filter(t=>t.type!=='FEE'&&t.type!=='CASH').map(t=>t.ticker))];
  const tagMap={'Ação':'tag-acao','ETF':'tag-etf','Cripto':'tag-cripto','CFD':'tag-cfd'};

  // Preencher modal
  document.getElementById('summary-title').textContent=`📋 ${brokerLabel} — ${filename}`;
  document.getElementById('summary-period-text').textContent=`Período: ${periodText} · ${transactions.length} operações totais`;
  document.getElementById('sum-buys').textContent=types.BUY||0;
  document.getElementById('sum-sells').textContent=types.SELL||0;
  document.getElementById('sum-divs').textContent=types.DIV||0;
  document.getElementById('sum-fees').textContent=types.FEE||0;
  document.getElementById('sum-buy-vol').textContent='€'+fmt(buyVol,2);
  document.getElementById('sum-div-total').textContent='€'+fmt(divTotal,2);
  document.getElementById('sum-wht-total').textContent=whtTotal>0?'-€'+fmt(whtTotal,2):'€0';

  // Tickers com badge de tipo
  document.getElementById('sum-tickers').innerHTML=tickers.slice(0,30).map(tk=>{
    const p=transactions.find(t=>t.ticker===tk&&t.type!=='FEE'&&t.type!=='CASH');
    const cls=tagMap[p?.assetType||'Ação']||'tag-acao';
    return`<span class="tag ${cls}" style="font-size:11px;">${tk}</span>`;
  }).join('')+(tickers.length>30?`<span style="font-size:11px;color:var(--color-text-secondary);">+${tickers.length-30} mais</span>`:'');

  // Avisos
  const warnings=[];
  if(types.BUY===0&&types.SELL===0&&types.DIV===0) warnings.push('⚠️ Nenhuma transação detetada — verifica o formato do ficheiro');
  if(commTotal>0) warnings.push(`ℹ️ Comissões/custos totais: €${fmt(commTotal,2)}`);
  const wDiv=document.getElementById('sum-warnings');
  if(warnings.length>0){wDiv.style.display='block';wDiv.innerHTML=warnings.map(w=>`<div class="alert alert-warn" style="margin-bottom:6px;padding:8px 11px;">${w}</div>`).join('');}
  else wDiv.style.display='none';

  // Log
  document.getElementById('sum-log').textContent=(log||[]).join('\n');

  // Desativa botão se nada para importar
  document.getElementById('sum-confirm-btn').disabled=transactions.length===0;

  openModal('modal-summary');
}
function cancelImport(){document.getElementById('import-preview').style.display='none';window.PT.pending=null;}
function confirmImport(){
  const pending=window.PT.pending;if(!pending||!pending.length){notify('Nada para importar');return;}
  // Re-importação: o ficheiro novo substitui as transações dessa corretora no período que cobre (evita duplicados de versões antigas do parser)
  const brokers=[...new Set(pending.map(t=>t.broker))];const dates=pending.map(t=>t.date).sort();const d0=dates[0],d1=dates[dates.length-1];
  const pTypes=[...new Set(pending.map(t=>t.type))];
  const kept=window.PT.transactions.filter(t=>!(brokers.includes(t.broker)&&t.broker!=='Manual'&&pTypes.includes(t.type)&&t.date>=d0&&t.date<=d1));
  const removed=window.PT.transactions.length-kept.length;
  const key=t=>`${t.broker}|${t.date}|${t.isin||t.ticker}|${t.type}|${Number(t.qty).toFixed(4)}|${Number(t.total||0).toFixed(2)}|${t._ref||''}`;const existing=new Set(kept.map(key));const newT=pending.filter(t=>!existing.has(key(t)));
  if(removed)console.log(`[Import] ${removed} transações antigas de ${brokers.join(',')} (${d0} a ${d1}) substituídas`);
  window.PT.transactions=[...kept,...newT].sort((a,b)=>new Date(a.date)-new Date(b.date));window.PT.pending=null;computePositions();updateFilters();
  const types={BUY:0,SELL:0,DIV:0,FEE:0};newT.forEach(t=>types[t.type]=(types[t.type]||0)+1);
  notify(`✓ ${newT.length} importadas (${types.BUY}↑ ${types.SELL}↓ ${types.DIV} div) · ${window.PT.transactions.length} total`);
  setTimeout(()=>switchTab('posicoes',document.querySelectorAll('.nav-btn')[1]),800);
}

// ── POSITIONS (por ISIN+broker) ───────────────────────────────────────────────
function computePositions(){
  const map={};
  [...window.PT.transactions].filter(t=>t.type!=='FEE'&&t.type!=='CASH').sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(txn=>{
    const isinKey=txn.isin&&txn.isin.length>5?txn.isin:txn.ticker;const k=`${isinKey}|${txn.broker}`;
    if(!map[k])map[k]={ticker:txn.ticker,product:txn.product,isin:txn.isin||'',broker:txn.broker,assetType:txn.assetType,qty:0,lots:[],totalCommissions:0};
    const p=map[k];
    if((txn.product||'').length>(p.product||'').length)p.product=txn.product;
    if(txn.isin&&txn.isin.length>5)p.isin=txn.isin;
    if(txn.type==='BUY'){p.qty+=txn.qty;p.lots.push({qty:txn.qty,price:txn.price,date:txn.date,remaining:txn.qty});p.totalCommissions+=(txn.totalCost||0);}
    else if(txn.type==='SELL'){let s=txn.qty;for(const l of p.lots){if(s<=0)break;const c=Math.min(l.remaining,s);l.remaining-=c;s-=c;}p.qty=Math.max(0,p.qty-txn.qty);}
  });
  window.PT.positions=Object.values(map).filter(p=>p.qty>0.00001).map(p=>{
    const al=p.lots.filter(l=>l.remaining>0.00001);const tv=al.reduce((s,l)=>s+l.remaining*l.price,0),tq=al.reduce((s,l)=>s+l.remaining,0);
    return{...p,avgPrice:tq>0?tv/tq:0};
  }).sort((a,b)=>b.qty*b.avgPrice-a.qty*a.avgPrice);
  updateBrokerFilterBtns();renderDashboard();updateQuotesCoverage();
}
function updateBrokerFilterBtns(){const f=window.PT.posFilter;renderFilterBar('pos-filters',f,()=>filterPos(f.type,f.broker,null));}


// ── DASHBOARD ─────────────────────────────────────────────────────────────────
const bC={DEGIRO:'#FF6600',eToro:'#00C853',XTB:'#E30613',IBKR:'#003087',Freedom24:'#0057B8',Manual:'#888'};
function updateQuotesCoverage(){
  const pos=window.PT.positions,q=window.PT.quotes;
  if(!pos.length){document.getElementById('quotes-ok-count').textContent='0/0';document.getElementById('quotes-last-time').textContent='sem posições';setQuotesDonut(0,'#e0e0e0');return;}
  const tickers=[...new Set(pos.map(p=>p.ticker))];
  const ok=tickers.filter(t=>q[t]).length;
  const pct=Math.round((ok/tickers.length)*100);
  const color=pct===100?'var(--accent)':pct>=70?'#F5A623':pct>=30?'var(--amber)':'var(--red)';
  document.getElementById('quotes-ok-count').textContent=`${ok}/${tickers.length}`;
  document.getElementById('quotes-ok-count').style.color=color;
  document.getElementById('quotes-last-time').textContent=pct===0?'clica para atualizar':`às ${window.PT.quotesTime||'—'}`;
  const card=document.getElementById('kpi-quotes-card');
  card.style.background=pct===100?'var(--accent-light)':pct>=70?'#FFF8EC':pct>=30?'var(--amber-light)':'var(--red-light)';
  setQuotesDonut(pct,color);
}
function setQuotesDonut(pct,color){
  const c=2*Math.PI*16,dash=(pct/100)*c;
  const arc=document.getElementById('quotes-donut-arc');
  if(arc){arc.setAttribute('stroke-dasharray',`${dash.toFixed(2)} ${(c-dash).toFixed(2)}`);arc.setAttribute('stroke',color);}
  const txt=document.getElementById('quotes-donut-pct');
  if(txt){txt.textContent=pct+'%';txt.setAttribute('fill',pct>0?color:'var(--color-text-secondary)');}
}

function renderDashboard(){
  const pos=window.PT.positions,txns=window.PT.transactions,q=window.PT.quotes;
  const costTotal=pos.reduce((s,p)=>s+(isFinite(p.qty*p.avgPrice)?p.qty*p.avgPrice:0),0);
  let marketTotal=0;pos.forEach(p=>{const qt=q[p.ticker];const val=qt&&isFinite(qt.priceEUR)&&qt.priceEUR>0?p.qty*qt.priceEUR:p.qty*p.avgPrice;marketTotal+=isFinite(val)?val:0;});
  const pl=marketTotal-costTotal,plPct=costTotal>0?(pl/costTotal)*100:0,hasQ=Object.keys(q).length>0;
  const year=new Date().getFullYear();
  const divYear=txns.filter(t=>t.type==='DIV'&&new Date(t.date).getFullYear()===year).reduce((s,t)=>s+t.total,0);
  document.getElementById('kpi-total').textContent='€'+fmt(marketTotal);
  document.getElementById('kpi-total-sub').textContent=hasQ?'valor de mercado':'custo — clica ↻ Cotações';
  document.getElementById('kpi-cost').textContent='€'+fmt(costTotal);
  document.getElementById('kpi-cost-sub').textContent=pos.length+' posições';
  document.getElementById('kpi-pl').textContent=(pl>=0?'+':'')+fmt(pl);
  document.getElementById('kpi-pl').className='kpi-value '+(pl>=0?'pos-big':'neg-big');
  document.getElementById('kpi-pl-pct').textContent=(plPct>=0?'+':'')+plPct.toFixed(1)+'%';
  document.getElementById('kpi-pl-pct').className='kpi-sub '+(plPct>=0?'pos':'neg');
  document.getElementById('kpi-div').textContent='€'+fmt(divYear);
  document.getElementById('kpi-pos').textContent=pos.length;
  document.getElementById('kpi-pos-sub').textContent=[...new Set(pos.map(p=>p.broker))].length+' corretoras';
  const bt={};pos.forEach(p=>{const val=q[p.ticker]?p.qty*q[p.ticker].priceEUR:p.qty*p.avgPrice;bt[p.broker]=(bt[p.broker]||0)+val;});
  const tot2=marketTotal||costTotal||1;
  const bl=document.getElementById('broker-list');
  if(!Object.keys(bt).length){bl.innerHTML='<div class="empty-state" style="padding:16px;"><div class="empty-text">Importa ficheiros para começar</div></div>';}
  else bl.innerHTML=Object.entries(bt).sort((a,b)=>b[1]-a[1]).map(([b,v])=>{const pct=((v/tot2)*100).toFixed(1);const nPos=pos.filter(p=>p.broker===b).length;return`<div class="broker-row" onclick="goToBroker('${b}')"><div class="b-icon" style="background:${bC[b]||'#888'}">${b.substring(0,2).toUpperCase()}</div><div class="b-info"><div class="b-name">${b}</div><div class="b-sub">${nPos} posições</div></div><div class="b-val"><div class="b-eur">€${fmt(v)}</div><div class="b-pct">${pct}%</div></div></div>`;}).join('');
  const tt={'Ação':0,'ETF':0,'Cripto':0,'CFD':0};pos.forEach(p=>{const val=q[p.ticker]?p.qty*q[p.ticker].priceEUR:p.qty*p.avgPrice;tt[p.assetType]=(tt[p.assetType]||0)+val;});
  const ttF=Object.fromEntries(Object.entries(tt).filter(([,v])=>v>0));
  drawDonut(ttF,tot2);
  const colors={'Ação':'#185FA5','ETF':'#1D9E75','Cripto':'#BA7517','CFD':'#888780'};
  document.getElementById('alloc-bars').innerHTML=Object.entries(ttF).sort((a,b)=>b[1]-a[1]).map(([k,v])=>{const pct=((v/tot2)*100);return`<div class="bar-item"><div class="bar-header"><span class="bar-label">${k}</span><span class="bar-pct">${pct.toFixed(1)}%</span></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${colors[k]||'#888'}"></div></div></div>`;}).join('')||'<div class="empty-text" style="font-size:12px;">Sem dados</div>';
  document.getElementById('top-positions').innerHTML=pos.slice(0,6).map(p=>{const val=q[p.ticker]?p.qty*q[p.ticker].priceEUR:p.qty*p.avgPrice;const pct=((val/tot2)*100).toFixed(1);return`<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:0.5px solid var(--color-border-tertiary);"><div><div style="font-size:12px;font-weight:500;">${p.ticker}</div><div style="font-size:10px;color:var(--color-text-secondary);">${p.broker}</div></div><div style="text-align:right;"><div style="font-size:12px;font-weight:500;">€${fmt(val)}</div><div style="font-size:10px;color:var(--color-text-secondary);">${pct}%</div></div></div>`;}).join('')||'<div class="empty-text" style="font-size:12px;">Sem dados</div>';
  const recentDivs=txns.filter(t=>t.type==='DIV').sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
  document.getElementById('recent-divs').innerHTML=recentDivs.map(d=>`<div class="div-row"><div><div class="div-ticker">${d.ticker}</div><div class="div-broker">${d.broker} · ${d.date}</div></div><div style="text-align:right;"><div class="div-amt">+€${Number(d.total).toFixed(2)}</div>${d.wht>0?`<div class="div-wht">ret. €${Number(d.wht).toFixed(2)}</div>`:''}</div></div>`).join('')||'<div class="empty-text" style="font-size:12px;">Sem dividendos ainda</div>';
}
function drawDonut(data,total){const cv=document.getElementById('donut'),ctx=cv.getContext('2d');ctx.clearRect(0,0,110,110);const colors={'Ação':'#185FA5','ETF':'#1D9E75','Cripto':'#BA7517','CFD':'#888780'};const ent=Object.entries(data).filter(([,v])=>v>0);if(!ent.length){ctx.strokeStyle='var(--color-border-tertiary)';ctx.lineWidth=18;ctx.beginPath();ctx.arc(55,55,38,0,Math.PI*2);ctx.stroke();document.getElementById('donut-legend').innerHTML='<div style="font-size:12px;color:var(--color-text-secondary);">Sem dados</div>';return;}let s=-Math.PI/2;ctx.lineWidth=18;ent.forEach(([k,v])=>{const sw=(v/total)*Math.PI*2;ctx.strokeStyle=colors[k]||'#888';ctx.beginPath();ctx.arc(55,55,38,s,s+sw);ctx.stroke();s+=sw;});document.getElementById('donut-legend').innerHTML=ent.map(([k,v])=>`<div class="legend-row"><div class="legend-left"><div class="legend-dot" style="background:${colors[k]}"></div>${k}</div><div class="legend-right">${((v/total)*100).toFixed(0)}%</div></div>`).join('');}
function goToBroker(b){window.PT.posFilter.broker=b;switchTab('posicoes');}

// ── POSIÇÕES ──────────────────────────────────────────────────────────────────
function filterPos(type,broker,btn){
  const f=window.PT.posFilter;f.type=type;f.broker=broker;
  if(btn){btn.parentElement.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}
  renderFilterBar('pos-filters',f,()=>filterPos(f.type,f.broker,null));
  const rows=posRows(),lot=f.view==='lot';
  const tagMap={'Ação':'tag-acao','ETF':'tag-etf','Cripto':'tag-cripto','CFD':'tag-cfd'},body=document.getElementById('pos-body');
  let tCost=0,tMkt=0,hasMkt=false;
  rows.forEach(x=>{tCost+=x.cost;if(x.val!==null){tMkt+=x.val;hasMkt=true;}else tMkt+=x.cost;});
  const tPl=tMkt-tCost,tPlPct=tCost>0?(tPl/tCost)*100:0;
  document.getElementById('pt-cost').textContent='€'+fmt(tCost);
  document.getElementById('pt-mkt').textContent=hasMkt?'€'+fmt(tMkt):'€'+fmt(tCost)+' *';
  document.getElementById('pt-pl').textContent=(hasMkt?(tPl>=0?'+':'')+fmt(tPl):'—');
  document.getElementById('pt-pl').style.color=tPl>=0?'var(--accent-dark)':'var(--red)';
  document.getElementById('pt-plpct').textContent=hasMkt?(tPlPct>=0?'+':'')+tPlPct.toFixed(1)+'%':'—';
  document.getElementById('pt-plpct').style.color=tPlPct>=0?'var(--accent-dark)':'var(--red)';
  document.getElementById('pt-n').textContent=lot?`${rows.length} lote${rows.length!==1?'s':''}`:`${rows.length} posiç${rows.length!==1?'ões':'ão'}`;
  document.getElementById('pos-head').innerHTML=lot
    ?'<tr><th>Produto</th><th>Tipo</th><th>Corretora</th><th>Data compra</th><th class="num">Dias</th><th class="num">Qtd</th><th class="num">Custo/un €</th><th class="num">Custo total €</th><th class="num">Cotação €</th><th class="num">Valor atual €</th><th class="num">P&amp;L €</th><th class="num">P&amp;L %</th></tr>'
    :'<tr><th>Produto</th><th>Tipo</th><th>Corretora</th><th>1ª compra</th><th class="num">Lotes</th><th class="num">Qtd</th><th class="num">Custo méd €</th><th class="num">Custo total €</th><th class="num">Cotação €</th><th class="num">Valor atual €</th><th class="num">P&amp;L €</th><th class="num">P&amp;L %</th></tr>';
  if(!rows.length){body.innerHTML='<tr><td colspan="12"><div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">Sem posições neste filtro</div></div></td></tr>';document.getElementById('pos-count').textContent='';return;}
  const n2=v=>v.toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});
  body.innerHTML=rows.map(x=>{
    const plPct=x.pl!==null&&x.cost>=1?x.pl/x.cost*100:null,qs=x.qty%1===0?x.qty.toLocaleString('pt-PT'):x.qty.toFixed(4);
    return`<tr><td><strong style="font-size:12px;">${x.ticker}</strong><br><span style="font-size:11px;color:var(--color-text-secondary);">${(x.product||'').substring(0,30)}</span>${x.isin?`<br><span class="isin-chip">${x.isin}</span>`:''}</td><td><span class="tag ${tagMap[x.assetType]||'tag-acao'}">${x.assetType}</span></td><td style="font-size:12px;">${x.broker}</td><td style="font-size:12px;">${x.date}</td><td class="num">${lot?x.days:x.nLots}</td><td class="num">${qs}</td><td class="num">${x.avg.toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:4})}</td><td class="num">${fmt(x.cost)}</td><td class="num">${x.mkt?n2(x.mkt):'<span style="color:var(--color-text-secondary);font-size:11px;">—</span>'}</td><td class="num">${x.val!==null?'€'+fmt(x.val):'—'}</td><td class="num">${x.pl!==null?`<span style="color:${x.pl>=0?'var(--accent-dark)':'var(--red)'};font-weight:500;">${x.pl>=0?'+':''}${fmt(x.pl)}</span>`:'—'}</td><td class="num">${plPct!==null?`<span style="font-size:11px;color:${plPct>=0?'var(--accent-dark)':'var(--red)'}">${plPct>=0?'+':''}${plPct.toFixed(1)}%</span>`:'—'}</td></tr>`;
  }).join('');
  document.getElementById('pos-count').textContent='';
}

function updateFilters(){
  const txns=window.PT.transactions.filter(t=>t.type!=='FEE'&&t.type!=='CASH');const brokers=[...new Set(txns.map(t=>t.broker))];
  document.getElementById('txn-broker').innerHTML='<option value="all">Todas as corretoras</option>'+brokers.map(b=>`<option value="${b}">${b}</option>`).join('');
  const years=[...new Set(txns.map(t=>new Date(t.date).getFullYear()))].sort((a,b)=>b-a);
  document.getElementById('txn-year').innerHTML='<option value="all">Todos os anos</option>'+years.map(y=>`<option value="${y}">${y}</option>`).join('');
  document.getElementById('cost-broker').innerHTML='<option value="all">Todas</option>'+brokers.map(b=>`<option value="${b}">${b}</option>`).join('');
  document.getElementById('cost-year').innerHTML='<option value="all">Todos os anos</option>'+years.map(y=>`<option value="${y}">${y}</option>`).join('');
}

function renderTransactions(){
  const bf=document.getElementById('txn-broker').value,tf=document.getElementById('txn-type').value,yf=document.getElementById('txn-year').value;
  let txns=[...window.PT.transactions].filter(t=>t.type!=='FEE'&&t.type!=='CASH').sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(bf!=='all')txns=txns.filter(t=>t.broker===bf);if(tf!=='all')txns=txns.filter(t=>t.type===tf);if(yf!=='all')txns=txns.filter(t=>new Date(t.date).getFullYear()==yf);
  const body=document.getElementById('txn-body');if(!txns.length){body.innerHTML='<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Sem transações</div></div></td></tr>';return;}
  const tL={BUY:'Compra',SELL:'Venda',DIV:'Dividendo'},tB={BUY:'badge-green',SELL:'badge-red',DIV:'badge-blue'};
  body.innerHTML=txns.slice(0,500).map((t,i)=>`<tr><td style="font-size:12px;">${t.date}</td><td><strong style="font-size:12px;">${t.ticker}</strong><br><span style="font-size:11px;color:var(--color-text-secondary);">${(t.product||'').substring(0,28)}</span></td><td><span class="badge ${tB[t.type]||'badge-blue'}">${tL[t.type]||t.type}</span></td><td style="font-size:12px;">${t.broker}</td><td class="num">${Number(t.qty)%1===0?Number(t.qty):Number(t.qty).toFixed(4)}</td><td class="num">${Number(t.price).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:4})}</td><td class="num"><strong>${Number(t.total).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></td><td class="num">${(t.totalCost||0)>0?'<span class="cost-pill">-€'+Number(t.totalCost).toFixed(2)+'</span>':'—'}</td><td><button onclick="deleteTxn(${window.PT.transactions.indexOf(t)})" style="font-size:10px;padding:2px 6px;background:var(--red-light);color:var(--red);border:none;border-radius:3px;cursor:pointer;">✕</button></td></tr>`).join('');
  document.getElementById('txn-count').textContent=`${txns.length} transações`;
}

function deleteTxn(idx){if(!confirm('Apagar esta transação?'))return;window.PT.transactions.splice(idx,1);computePositions();updateFilters();renderTransactions();notify('Transação apagada');}



// ══════════════════════════════════════════════════════════════════════════════
// FILTROS (período + corretora) e CSV — usados em Posições e Dividendos
// ══════════════════════════════════════════════════════════════════════════════
const PERIODS=[['ytd','Ano atual'],['prev','Ano anterior'],['all','Tudo'],['manual','Manual']];
function periodRange(f){
  const y=new Date().getFullYear();
  if(f.period==='ytd')return[`${y}-01-01`,`${y}-12-31`];
  if(f.period==='prev')return[`${y-1}-01-01`,`${y-1}-12-31`];
  if(f.period==='manual')return[f.from||'0000-01-01',f.to||'9999-12-31'];
  return['0000-01-01','9999-12-31'];
}
function inPeriod(date,f){const[a,b]=periodRange(f);return date>=a&&date<=b;}
function periodLabel(f){const[a,b]=periodRange(f);return f.period==='all'?'tudo':f.period==='manual'?`${f.from||'início'}_${f.to||'hoje'}`:a.substring(0,4);}
// Desenha a barra de filtros num contentor; st = objeto de estado; onChange = função de render
function renderFilterBar(containerId,st,onChange){
  const el=document.getElementById(containerId);if(!el)return;
  const brokers=[...new Set(window.PT.transactions.map(t=>t.broker))].sort();
  el.innerHTML=`<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
    ${PERIODS.map(([k,l])=>`<button class="filter-btn${st.period===k?' active':''}" data-p="${k}">${l}</button>`).join('')}
    <span class="fb-manual" style="display:${st.period==='manual'?'inline-flex':'none'};gap:4px;align-items:center;">
      <input type="date" class="fb-from" value="${st.from||''}" style="font-size:12px;padding:3px 6px;"> a
      <input type="date" class="fb-to" value="${st.to||''}" style="font-size:12px;padding:3px 6px;"></span>
    <select class="fb-broker" style="font-size:12px;"><option value="all">Todas as corretoras</option>${brokers.map(b=>`<option value="${b}"${st.broker===b?' selected':''}>${b}</option>`).join('')}</select>
  </div>`;
  el.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{st.period=b.dataset.p;renderFilterBar(containerId,st,onChange);onChange();});
  el.querySelector('.fb-from').onchange=e=>{st.from=e.target.value;onChange();};
  el.querySelector('.fb-to').onchange=e=>{st.to=e.target.value;onChange();};
  el.querySelector('.fb-broker').onchange=e=>{st.broker=e.target.value;onChange();};
}
// CSV para Excel PT: separador ";" e vírgula decimal, com BOM
function toCSV(header,rows){
  const cell=v=>{if(typeof v==='number')return isFinite(v)?String(Math.round(v*1e6)/1e6).replace('.',','):'';const s=String(v??'');return /[;"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
  return '﻿'+[header,...rows].map(r=>r.map(cell).join(';')).join('\r\n');
}

// ── POSIÇÕES: lotes abertos ──────────────────────────────────────────────────
function openLots(){
  const out=[];
  window.PT.positions.forEach(p=>p.lots.filter(l=>l.remaining>0.00001).forEach(l=>out.push({
    ticker:p.ticker,product:p.product,isin:p.isin,broker:p.broker,assetType:p.assetType,date:l.date,qty:l.remaining,price:l.price})));
  return out;
}
function posView(v,btn){window.PT.posFilter.view=v;if(btn){btn.parentElement.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}filterPos(window.PT.posFilter.type,window.PT.posFilter.broker,null);}
function posRows(){
  const f=window.PT.posFilter,q=window.PT.quotes,today=new Date();
  let lots=openLots().filter(l=>(f.type==='all'||l.assetType===f.type)&&(f.broker==='all'||l.broker===f.broker)&&inPeriod(l.date,f));
  const mk=l=>{const qt=q[l.ticker];return qt&&isFinite(qt.priceEUR)&&qt.priceEUR>0?qt.priceEUR:null;};
  if(f.view==='lot'){
    return lots.sort((a,b)=>a.ticker.localeCompare(b.ticker)||a.date.localeCompare(b.date)).map(l=>{
      const cost=l.qty*l.price,m=mk(l),val=m?l.qty*m:null;
      return{...l,cost,avg:l.price,mkt:m,val,pl:val!==null?val-cost:null,days:Math.floor((today-new Date(l.date))/86400000),nLots:1};});
  }
  const g={};
  lots.forEach(l=>{const k=(l.isin||l.ticker)+'|'+l.broker;if(!g[k])g[k]={...l,qty:0,cost:0,first:l.date,last:l.date,nLots:0};
    const x=g[k];x.qty+=l.qty;x.cost+=l.qty*l.price;x.nLots++;if(l.date<x.first)x.first=l.date;if(l.date>x.last)x.last=l.date;});
  return Object.values(g).map(x=>{const m=mk(x),val=m?x.qty*m:null;return{...x,date:x.first,avg:x.cost/x.qty,mkt:m,val,pl:val!==null?val-x.cost:null};})
    .sort((a,b)=>b.cost-a.cost);
}
function exportPosCSV(){
  const f=window.PT.posFilter,rows=posRows();if(!rows.length){notify('Sem posições para exportar');return;}
  const lot=f.view==='lot';
  const h=['Ticker','Produto','ISIN','Tipo','Corretora',lot?'Data compra':'1ª compra',...(lot?['Dias']:['Última compra','Nº lotes']),'Quantidade',lot?'Custo/un €':'Custo médio €','Custo total €','Cotação €','Valor atual €','P&L €','P&L %'];
  const r=rows.map(x=>[x.ticker,x.product,x.isin,x.assetType,x.broker,x.date,...(lot?[x.days]:[x.last,x.nLots]),x.qty,x.avg,x.cost,x.mkt??'',x.val??'',x.pl??'',x.pl!==null&&x.cost>=1?x.pl/x.cost*100:'']);
  download(toCSV(h,r),`posicoes_${lot?'lotes':'ativos'}_${periodLabel(f)}${f.broker!=='all'?'_'+f.broker:''}.csv`,'text/csv;charset=utf-8;');
}

// ── DIVIDENDOS ───────────────────────────────────────────────────────────────
function divRows(){
  const f=window.PT.divFilter;
  return window.PT.transactions.filter(t=>t.type==='DIV'&&(f.broker==='all'||t.broker===f.broker)&&inPeriod(t.date,f))
    .map(t=>({date:t.date,ticker:t.ticker,product:t.product,isin:t.isin||'',broker:t.broker,gross:Number(t.total)||0,wht:Number(t.wht)||0,refund:!!t.refund}))
    .sort((a,b)=>b.date.localeCompare(a.date));
}
function divView(v,btn){window.PT.divFilter.view=v;if(btn){btn.parentElement.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}renderDividends();}
function divGroup(rows){
  const g={};rows.forEach(r=>{const k=r.ticker+'|'+r.broker;if(!g[k])g[k]={ticker:r.ticker,product:r.product,isin:r.isin,broker:r.broker,gross:0,wht:0,n:0,last:r.date};
    const x=g[k];x.gross+=r.gross;x.wht+=r.wht;if(!r.refund)x.n++;if(r.date>x.last)x.last=r.date;});
  return Object.values(g).sort((a,b)=>b.gross-a.gross);
}
function renderDividends(){
  const f=window.PT.divFilter;renderFilterBar('div-filters',f,renderDividends);
  const rows=divRows(),tG=rows.reduce((s,r)=>s+r.gross,0),tW=rows.reduce((s,r)=>s+r.wht,0);
  document.getElementById('dv-gross').textContent='€'+fmt(tG,2);
  document.getElementById('dv-wht').textContent='€'+fmt(tW,2);
  document.getElementById('dv-net').textContent='€'+fmt(tG-tW,2);
  document.getElementById('dv-pct').textContent=tG>0?(tW/tG*100).toFixed(1)+'%':'—';
  document.getElementById('dv-n').textContent=`${rows.filter(r=>!r.refund).length} pagamentos`;
  const head=document.getElementById('div-head'),body=document.getElementById('div-body');
  const e2=v=>'€'+Number(v).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});
  const whtCell=w=>w<0?`<span class="pos">+${e2(-w)} estorno</span>`:w>0?`<span class="neg">-${e2(w)}</span>`:'—';
  if(!rows.length){head.innerHTML='';body.innerHTML='<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">💶</div><div class="empty-title">Sem dividendos neste período</div></div></td></tr>';return;}
  if(f.view==='asset'){
    head.innerHTML='<tr><th>Ativo</th><th>Corretora</th><th class="num">Pagamentos</th><th>Último</th><th class="num">Bruto €</th><th class="num">Retenção €</th><th class="num">Líquido €</th></tr>';
    body.innerHTML=divGroup(rows).map(x=>`<tr><td><strong style="font-size:12px;">${x.ticker}</strong><br><span style="font-size:11px;color:var(--color-text-secondary);">${(x.product||'').substring(0,30)}</span></td><td style="font-size:12px;">${x.broker}</td><td class="num">${x.n}</td><td style="font-size:12px;">${x.last}</td><td class="num">${e2(x.gross)}</td><td class="num">${whtCell(x.wht)}</td><td class="num">${e2(x.gross-x.wht)}</td></tr>`).join('');
  }else{
    head.innerHTML='<tr><th>Data</th><th>Ativo</th><th>Corretora</th><th class="num">Bruto €</th><th class="num">Retenção €</th><th class="num">%</th><th class="num">Líquido €</th></tr>';
    body.innerHTML=rows.map(r=>`<tr><td style="font-size:12px;">${r.date}</td><td><strong style="font-size:12px;">${r.ticker}</strong>${r.refund?' <span style="font-size:11px;color:var(--color-text-secondary);">acerto retenção</span>':''}<br><span style="font-size:11px;color:var(--color-text-secondary);">${(r.product||'').substring(0,30)}</span></td><td style="font-size:12px;">${r.broker}</td><td class="num">${r.gross?e2(r.gross):'—'}</td><td class="num">${whtCell(r.wht)}</td><td class="num" style="font-size:11px;">${r.gross>0&&r.wht>0?(r.wht/r.gross*100).toFixed(0)+'%':''}</td><td class="num">${e2(r.gross-r.wht)}</td></tr>`).join('');
  }
}
function exportDivCSV(){
  const f=window.PT.divFilter,rows=divRows();if(!rows.length){notify('Sem dividendos para exportar');return;}
  let h,r;
  if(f.view==='asset'){h=['Ticker','Produto','ISIN','Corretora','Pagamentos','Último','Bruto €','Retenção €','Líquido €'];r=divGroup(rows).map(x=>[x.ticker,x.product,x.isin,x.broker,x.n,x.last,x.gross,x.wht,x.gross-x.wht]);}
  else{h=['Data','Ticker','Produto','ISIN','Corretora','Bruto €','Retenção €','Líquido €','Nota'];r=rows.map(x=>[x.date,x.ticker,x.product,x.isin,x.broker,x.gross,x.wht,x.gross-x.wht,x.refund?'acerto retenção':'']);}
  download(toCSV(h,r),`dividendos_${f.view==='asset'?'por_ativo':'lista'}_${periodLabel(f)}${f.broker!=='all'?'_'+f.broker:''}.csv`,'text/csv;charset=utf-8;');
}


// ── ENTRADAS DE CAPITAL ──────────────────────────────────────────────────────
function cashRows(){
  const f=window.PT.cashFilter;
  return window.PT.transactions.filter(t=>t.type==='CASH'&&(f.broker==='all'||t.broker===f.broker)&&inPeriod(t.date,f)).sort((a,b)=>b.date.localeCompare(a.date));
}
function renderCapital(){
  const f=window.PT.cashFilter;renderFilterBar('cash-filters',f,renderCapital);
  const rows=cashRows(),dep=rows.filter(r=>r.total>0).reduce((s,r)=>s+r.total,0),wd=rows.filter(r=>r.total<0).reduce((s,r)=>s+r.total,0);
  const e2=v=>'€'+Number(v).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});
  document.getElementById('cp-dep').textContent=e2(dep);document.getElementById('cp-wd').textContent=e2(-wd);
  document.getElementById('cp-net').textContent=e2(dep+wd);document.getElementById('cp-n').textContent=`${rows.length} movimento${rows.length!==1?'s':''}`;
  const g={};rows.forEach(r=>{if(!g[r.broker])g[r.broker]={broker:r.broker,dep:0,wd:0,n:0,first:r.date,last:r.date};const x=g[r.broker];
    if(r.total>0)x.dep+=r.total;else x.wd+=r.total;x.n++;if(r.date<x.first)x.first=r.date;if(r.date>x.last)x.last=r.date;});
  const gb=Object.values(g).sort((a,b)=>(b.dep+b.wd)-(a.dep+a.wd));
  document.getElementById('cash-broker-body').innerHTML=gb.length?gb.map(x=>`<tr><td><strong style="font-size:12px;">${x.broker}</strong></td><td class="num">${x.n}</td><td style="font-size:12px;">${x.first}</td><td style="font-size:12px;">${x.last}</td><td class="num pos">${e2(x.dep)}</td><td class="num neg">${x.wd?'-'+e2(-x.wd):'—'}</td><td class="num"><strong>${e2(x.dep+x.wd)}</strong></td></tr>`).join('')
    :'<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🏦</div><div class="empty-title">Sem movimentos neste período</div><div style="font-size:12px;color:var(--color-text-secondary);">Reimporta os extratos (XTB, DEGIRO Account, IBKR) para carregar depósitos e levantamentos</div></div></td></tr>';
  document.getElementById('cash-body').innerHTML=rows.map(r=>`<tr><td style="font-size:12px;">${r.date}</td><td style="font-size:12px;">${r.broker}</td><td style="font-size:12px;">${(r.product||'').substring(0,50)}</td><td class="num ${r.total>=0?'pos':'neg'}">${r.total>=0?'+':'-'}${e2(Math.abs(r.total))}</td></tr>`).join('');
}
function exportCashCSV(){
  const f=window.PT.cashFilter,rows=cashRows();if(!rows.length){notify('Sem movimentos para exportar');return;}
  download(toCSV(['Data','Corretora','Tipo','Valor €','Descrição'],[...rows].reverse().map(r=>[r.date,r.broker,r.total>=0?'Depósito':'Levantamento',r.total,r.product])),
    `entradas_capital_${periodLabel(f)}${f.broker!=='all'?'_'+f.broker:''}.csv`,'text/csv;charset=utf-8;');
}

// ── BACKUP/RESTORE ────────────────────────────────────────────────────────────
function closeModal(id){document.getElementById(id).classList.remove('open');}
function updatePwStrength(pw){const segs=['ps1','ps2','ps3','ps4'].map(id=>document.getElementById(id));const score=pw.length>=12?4:pw.length>=8?3:pw.length>=5?2:pw.length>0?1:0;const cols=['#e0e0e0','#E24B4A','#BA7517','#1D9E75','#0F6E56'];segs.forEach((s,i)=>s.style.background=i<score?cols[score]:'#e0e0e0');}
async function doBackup(){const noenc=document.getElementById('backup-noenc').checked,pw=document.getElementById('backup-pw').value;const data=JSON.stringify({transactions:window.PT.transactions,exportedAt:new Date().toISOString(),version:'2.0'});if(noenc){download(data,'portfolio_backup.json','application/json');}else{if(!pw||pw.length<6){notify('Password mínimo 6 caracteres');return;}try{const enc=await encryptData(data,pw);download(JSON.stringify(enc),'portfolio_backup.ptbak','application/json');}catch(e){notify('Erro: '+e.message);return;}}closeModal('modal-backup');notify('✓ Backup descarregado');}
function handleRestoreFile(input){const file=input.files[0];if(!file)return;const reader=new FileReader();reader.onload=ev=>{try{const p=JSON.parse(ev.target.result);window.PT.restoreData=p;const isEnc=p.iv!==undefined;window.PT.restoreEncrypted=isEnc;document.getElementById('restore-pw-row').style.display=isEnc?'block':'none';document.getElementById('restore-status').textContent=isEnc?'🔒 Encriptado — insere a password':'📄 JSON simples — pronto para restaurar';document.getElementById('restore-btn').disabled=false;}catch(e){document.getElementById('restore-status').textContent='Erro ao ler ficheiro';}};reader.readAsText(file);}
async function doRestore(){if(!window.PT.restoreData)return;try{let data;if(window.PT.restoreEncrypted){const pw=document.getElementById('restore-pw').value;if(!pw){notify('Introduz a password');return;}data=JSON.parse(await decryptData(window.PT.restoreData,pw));}else{data=window.PT.restoreData;}window.PT.transactions=data.transactions||[];computePositions();updateFilters();closeModal('modal-restore');notify(`✓ Restaurado: ${window.PT.transactions.length} entradas`);}catch(e){notify('Erro — password incorreta?');}}
function clearAll(){if(!confirm('Apagar todos os dados? Esta ação não pode ser desfeita.'))return;window.PT.transactions=[];window.PT.positions=[];window.PT.quotes={};window.PT.degiro={txnParsed:null,accParsed:null};computePositions();updateFilters();notify('✓ Dados apagados');}
async function encryptData(data,pw){const enc=new TextEncoder();const km=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveKey']);const salt=crypto.getRandomValues(new Uint8Array(16));const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['encrypt']);const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(data));return{iv:Array.from(iv),salt:Array.from(salt),data:Array.from(new Uint8Array(encrypted))};}
async function decryptData(obj,pw){const enc=new TextEncoder();const km=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveKey']);const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:new Uint8Array(obj.salt),iterations:100000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['decrypt']);const dec=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(obj.iv)},key,new Uint8Array(obj.data));return new TextDecoder().decode(dec);}
function download(c,f,t){const b=new Blob([c],{type:t});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=f;a.click();URL.revokeObjectURL(u);}
function notify(msg){const n=document.getElementById('notif');n.textContent=msg;n.classList.add('show');setTimeout(()=>n.classList.remove('show'),3500);}
function selectBroker(el){document.querySelectorAll('.broker-card').forEach(c=>c.classList.remove('selected'));el.classList.add('selected');window.PT.broker=el.dataset.broker;const isDEGIRO=el.dataset.broker==='DEGIRO';document.getElementById('degiro-uploads').classList.toggle('visible',isDEGIRO);document.getElementById('drop-zone').style.display=isDEGIRO?'none':'block';document.getElementById('import-preview').style.display='none';}
function switchTab(name,btn){document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));document.getElementById('tab-'+name).classList.add('active');
  btn=[...document.querySelectorAll('.nav-btn')].find(b=>(b.getAttribute('onclick')||'').includes(`'${name}'`))||btn;if(btn)btn.classList.add('active');
  if(name==='dashboard')renderDashboard();if(name==='posicoes')filterPos(window.PT.posFilter.type,window.PT.posFilter.broker,null);if(name==='dividendos')renderDividends();if(name==='capital')renderCapital();if(name==='transacoes')renderTransactions();if(name==='custos')renderCustos();if(name==='fiscal')renderFiscal();}
function switchFiscalTab(tab,btn){document.querySelectorAll('.ftab').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');document.getElementById('fiscal-mv').style.display=tab==='mv'?'block':'none';document.getElementById('fiscal-div').style.display=tab==='div'?'block':'none';document.getElementById('fiscal-anexoj').style.display=tab==='anexoj'?'block':'none';}

// Close modals on overlay click
['modal-backup','modal-restore','modal-summary','modal-txn'].forEach(id=>document.getElementById(id).addEventListener('click',function(e){if(e.target===this)closeModal(id);}));

renderDashboard();
