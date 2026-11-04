// PortfolioTracker PT — fiscal.js (custos, mais-valias, dividendos, CSV fiscal)
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
  const sells=txns.filter(t=>t.type==='SELL'&&new Date(t.date).getFullYear()===year);
  const divs=txns.filter(t=>t.type==='DIV'&&new Date(t.date).getFullYear()===year);

  // FIFO por lote — gera 1 linha por lote de compra usado em cada venda
  let mvAcoes=0,mvCripto=0;
  const mvRows=[];

  // Deduplicar vendas — usa ID XTB quando disponível, senão ticker+broker+data+qty
  const sellsDedup=[];
  const seenSells=new Set();
  sells.forEach(sell=>{
    const key=sell._xtbId?`xtb_${sell._xtbId}`:`${sell.ticker}|${sell.broker}|${sell.date}|${sell.qty}|${sell.total}`;
    if(!seenSells.has(key)){
      seenSells.add(key);
      sellsDedup.push(sell);
    }
  });

  sellsDedup.forEach(sell=>{
    // Encontrar todas as compras anteriores do mesmo ticker+broker (FIFO)
    const buys=txns.filter(t=>
      t.type==='BUY'&&
      t.ticker===sell.ticker&&
      t.broker===sell.broker&&
      new Date(t.date)<=new Date(sell.date)
    ).sort((a,b)=>new Date(a.date)-new Date(b.date));

    if(!buys.length){
      // Sem compras registadas — 1 linha com dados da venda
      const gain=sell.total||sell.qty*sell.price;
      mvRows.push({ticker:sell.ticker,product:sell.product,assetType:sell.assetType,
        buyDate:'?',sellDate:sell.date,qty:sell.qty,
        costEUR:0,proceedsEUR:sell.total||sell.qty*sell.price,gain,exempt:false});
      if(sell.assetType==='Cripto')mvCripto+=gain;else mvAcoes+=gain;
      return;
    }

    // FIFO: distribuir a venda pelos lotes de compra por ordem cronológica
    let qtyLeft=sell.qty;
    const proceedsEURTotal=sell.total>0?sell.total:sell.qty*sell.price;
    const pricePerShare=proceedsEURTotal/sell.qty; // EUR por ação na venda

    buys.forEach(buy=>{
      if(qtyLeft<=0)return;
      const qtyUsed=Math.min(qtyLeft,buy.qty);
      qtyLeft-=qtyUsed;
      // Custo por ação deste lote de compra
      const costPerShare=buy.total>0?buy.total/buy.qty:buy.price;
      const costEUR=qtyUsed*costPerShare;
      const proceedsEUR=qtyUsed*pricePerShare;
      const gain=proceedsEUR-costEUR;
      const days=(new Date(sell.date)-new Date(buy.date))/86400000;
      const exempt=sell.assetType==='Cripto'&&days>=365;
      if(!exempt){if(sell.assetType==='Cripto')mvCripto+=gain;else mvAcoes+=gain;}
      mvRows.push({ticker:sell.ticker,product:sell.product,assetType:sell.assetType,
        buyDate:buy.date,sellDate:sell.date,qty:qtyUsed,
        costEUR,proceedsEUR,gain,exempt});
    });
  });

  const tax=Math.max(0,(mvAcoes+mvCripto)*0.28);
  const divTotal=divs.reduce((s,t)=>s+t.total,0);
  const whtTotal=divs.reduce((s,t)=>s+(t.wht||0),0);
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
      <td>${d.ticker}</td><td>${d.date}</td><td>${d.broker}</td>
      <td class="num">€${Number(d.total).toFixed(2)}</td>
      <td class="num neg">${d.wht?'-€'+Number(d.wht).toFixed(2):'—'}</td>
      <td class="num">€${(Number(d.total)-Number(d.wht||0)).toFixed(2)}</td>
    </tr>`).join('')
    :`<tr><td colspan="6"><div class="empty-state"><div class="empty-title">Sem dividendos em ${year}</div></div></td></tr>`;
}

function exportFiscalCSV(){const year=document.getElementById('fiscal-year').value;const sells=window.PT.transactions.filter(t=>t.type==='SELL'&&new Date(t.date).getFullYear()==year);if(!sells.length){notify('Sem vendas em '+year);return;}download('"Produto","ISIN","Data Venda","Quantidade","Preço EUR","Total EUR","Comissão EUR","Corretora","Tipo"\n'+sells.map(s=>`"${s.product}","${s.isin||''}",${s.date},${s.qty},${Number(s.price).toFixed(4)},${Number(s.total).toFixed(2)},${Number(s.totalCost||0).toFixed(2)},${s.broker},${s.assetType}`).join('\n'),`fiscal_irs_${year}.csv`,'text/csv;charset=utf-8;');}

