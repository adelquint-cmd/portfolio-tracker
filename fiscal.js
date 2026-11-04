// PortfolioTracker PT — fiscal.js (custos, mais-valias, dividendos, CSV fiscal)
// FIFO global por ticker+corretora: percorre todas as transações por ordem cronológica,
// consome os lotes e devolve 1 linha por (venda × lote usado). Custo inclui comissão de compra
// proporcional; realização é líquida da comissão de venda.
function fifoRealized(txns){
  const key=t=>`${t.isin&&t.isin.length>5?t.isin:t.ticker}|${t.broker}`;
  const ord={BUY:0,SELL:1};
  const list=txns.filter(t=>t.type==='BUY'||t.type==='SELL')
    .map((t,i)=>({t,i})).sort((a,b)=>a.t.date.localeCompare(b.t.date)||ord[a.t.type]-ord[b.t.type]||a.i-b.i).map(x=>x.t);
  const lots={},rows=[],warn=[];
  list.forEach(t=>{
    const k=key(t);if(!lots[k])lots[k]=[];
    if(t.type==='BUY'){
      const cost=(t.total>0?t.total:t.qty*t.price)+(t.totalCost||0);
      lots[k].push({date:t.date,qty:t.qty,left:t.qty,cps:cost/t.qty});
      return;
    }
    const net=(t.total>0?t.total:t.qty*t.price)-(t.totalCost||0),pps=net/t.qty;
    let left=t.qty;
    for(const l of lots[k]){
      if(left<=1e-9)break;if(l.left<=1e-9)continue;
      const q=Math.min(l.left,left);l.left-=q;left-=q;
      const days=(new Date(t.date)-new Date(l.date))/86400000;
      rows.push({ticker:t.ticker,product:t.product,isin:t.isin||'',broker:t.broker,assetType:t.assetType,
        buyDate:l.date,sellDate:t.date,qty:q,costEUR:q*l.cps,proceedsEUR:q*pps,gain:q*(pps-l.cps),days,
        exempt:t.assetType==='Cripto'&&days>=365});
    }
    if(left>1e-6){
      warn.push(`${t.ticker} (${t.broker}) ${t.date}: vendidas ${t.qty}, faltam compras para ${+left.toFixed(4)}`);
      rows.push({ticker:t.ticker,product:t.product,isin:t.isin||'',broker:t.broker,assetType:t.assetType,
        buyDate:'?',sellDate:t.date,qty:left,costEUR:0,proceedsEUR:left*pps,gain:left*pps,days:0,exempt:false,missing:true});
    }
  });
  return{rows,warn};
}

function renderCustos(){
  const yf=document.getElementById('cost-year').value,bf=document.getElementById('cost-broker').value;
  let txns=window.PT.transactions.filter(t=>(t.totalCost||0)>0||(t.wht||0)>0);
  if(yf!=='all')txns=txns.filter(t=>new Date(t.date).getFullYear()==yf);if(bf!=='all')txns=txns.filter(t=>t.broker===bf);
  const tc=txns.filter(t=>t.type!=='FEE').reduce((s,t)=>s+(t.commission||0),0),tconn=txns.filter(t=>t.type==='FEE').reduce((s,t)=>s+(t.commission||0),0),tw=window.PT.transactions.filter(t=>t.type==='DIV').reduce((s,t)=>s+(t.wht||0),0);
  document.getElementById('c-comissoes').textContent='€'+tc.toFixed(2);document.getElementById('c-conn').textContent='€'+tconn.toFixed(2);document.getElementById('c-wht').textContent='€'+tw.toFixed(2);document.getElementById('c-total').textContent='€'+(tc+tconn+tw).toFixed(2);
  const rows=[];txns.sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(t=>{if((t.totalCost||0)>0)rows.push({date:t.date,product:t.product,broker:t.broker,type:t.type==='FEE'?'Conectividade':'Comissão',amount:t.totalCost});if((t.wht||0)>0)rows.push({date:t.date,product:t.product,broker:t.broker,type:'Ret. fonte',amount:t.wht});});
  const costBadge={'Comissão':'badge-red','Conectividade':'badge-amber','Ret. fonte':'badge-blue','AutoFX':'badge-amber'};
  document.getElementById('cost-body').innerHTML=rows.length?rows.map(c=>`<tr><td style="font-size:12px;">${c.date}</td><td style="font-size:12px;">${(c.product||'').substring(0,28)}</td><td style="font-size:12px;">${c.broker}</td><td><span class="badge ${costBadge[c.type]||'badge-amber'}">${c.type}</span></td><td class="num neg">-€${Number(c.amount).toFixed(2)}</td></tr>`).join(''):'<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">💸</div><div class="empty-title">Sem custos</div></div></td></tr>';
}

function renderFiscal(){
  const year=parseInt(document.getElementById('fiscal-year').value);
  const txns=window.PT.transactions;
  const divs=txns.filter(t=>t.type==='DIV'&&new Date(t.date).getFullYear()===year);

  // FIFO global (todas as vendas e compras, por ordem cronológica) — mostra só as vendas do ano
  const fifo=fifoRealized(txns);
  fifo.warn.forEach(w=>console.warn('[FIFO]',w));
  const mvRows=fifo.rows.filter(r=>new Date(r.sellDate).getFullYear()===year);
  let mvAcoes=0,mvCripto=0;
  mvRows.forEach(r=>{if(r.exempt)return;if(r.assetType==='Cripto')mvCripto+=r.gain;else mvAcoes+=r.gain;});

  const tax=Math.max(0,(mvAcoes+mvCripto)*0.28);
  const divTotal=divs.reduce((s,t)=>s+t.total,0);
  const whtTotal=divs.reduce((s,t)=>s+(t.wht||0),0); // estornos têm wht negativo
  document.getElementById('f-mv-ac').textContent='€'+mvAcoes.toFixed(2);
  document.getElementById('f-mv-cr').textContent='€'+mvCripto.toFixed(2);
  document.getElementById('f-tax').textContent='€'+tax.toFixed(2);
  document.getElementById('f-div').textContent='€'+divTotal.toFixed(2);
  document.getElementById('f-wht').textContent='€'+whtTotal.toFixed(2);

  const tagMap={'Ação':'tag-acao','ETF':'tag-etf','Cripto':'tag-cripto','CFD':'tag-cfd'};
  document.getElementById('fiscal-mv-body').innerHTML=mvRows.length
    ?mvRows.map(r=>`<tr>
      <td><strong>${r.ticker}</strong><br><span style="font-size:11px;color:var(--color-text-secondary);">${(r.product||'').substring(0,25)}</span></td>
      <td><span class="tag ${tagMap[r.assetType]||'tag-acao'}">${r.assetType}</span></td>
      <td style="font-size:12px;">${r.buyDate}</td>
      <td style="font-size:12px;">${r.sellDate}</td>
      <td class="num">${Number(r.qty).toFixed(r.qty%1===0?0:3)}</td>
      <td class="num">€${r.costEUR.toFixed(2)}</td>
      <td class="num">€${r.proceedsEUR.toFixed(2)}</td>
      <td class="num ${r.gain>=0?'pos':'neg'}">${r.gain>=0?'+':''}€${r.gain.toFixed(2)}</td>
      <td>${r.exempt?'<span class="badge badge-green">Isento ≥365d</span>':'<span class="badge badge-amber">Tributável</span>'}</td>
    </tr>`).join('')
    :`<tr><td colspan="9"><div class="empty-state"><div class="empty-title">Sem vendas em ${year}</div></div></td></tr>`;

  document.getElementById('fiscal-div-body').innerHTML=divs.length
    ?divs.map(d=>`<tr>
      <td>${d.ticker}${d.refund?' <span style="font-size:11px;color:var(--color-text-secondary);">estorno</span>':''}</td><td>${d.date}</td><td>${d.broker}</td>
      <td class="num">€${Number(d.total).toFixed(2)}</td>
      <td class="num ${d.wht<0?'pos':'neg'}">${d.wht>0?'-€'+Number(d.wht).toFixed(2):d.wht<0?'+€'+(-d.wht).toFixed(2)+' estorno':'—'}</td>
      <td class="num">€${(Number(d.total)-Number(d.wht||0)).toFixed(2)}</td>
    </tr>`).join('')
    :`<tr><td colspan="6"><div class="empty-state"><div class="empty-title">Sem dividendos em ${year}</div></div></td></tr>`;
}

function exportFiscalCSV(){const year=document.getElementById('fiscal-year').value;const sells=window.PT.transactions.filter(t=>t.type==='SELL'&&new Date(t.date).getFullYear()==year);if(!sells.length){notify('Sem vendas em '+year);return;}download('"Produto","ISIN","Data Venda","Quantidade","Preço EUR","Total EUR","Comissão EUR","Corretora","Tipo"\n'+sells.map(s=>`"${s.product}","${s.isin||''}",${s.date},${s.qty},${Number(s.price).toFixed(4)},${Number(s.total).toFixed(2)},${Number(s.totalCost||0).toFixed(2)},${s.broker},${s.assetType}`).join('\n'),`fiscal_irs_${year}.csv`,'text/csv;charset=utf-8;');}

