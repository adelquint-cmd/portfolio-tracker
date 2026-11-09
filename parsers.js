// PortfolioTracker PT — parsers.js (utils + parsers das corretoras)
// Movimento de capital (depósito +, levantamento −) — tipo CASH, não entra em posições nem no fiscal
function cashTxn(date,amount,broker,note,ref){return{date,ticker:'CASH',product:note||(amount>=0?'Depósito':'Levantamento'),isin:'',type:'CASH',qty:0,price:0,total:amount,currency:'EUR',broker,assetType:'',commission:0,autofx:0,totalCost:0,wht:0,_ref:ref||''};}
// ── UTILS ─────────────────────────────────────────────────────────────────────
function pn(s){if(s===null||s===undefined||s==='')return 0;s=String(s).trim().replace(/^"|"$/g,'').replace(/\s/g,'');if(!s||s==='-')return 0;if(/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(s))return parseFloat(s.replace(/\./g,'').replace(',','.'))||0;if(/^-?\d+(,\d*)?$/.test(s))return parseFloat(s.replace(',','.'))||0;if(/^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(s))return parseFloat(s.replace(/,/g,''))||0;return parseFloat(String(s).replace(',','.'))||0;}
function nd(d){if(!d)return new Date().toISOString().split('T')[0];if(d instanceof Date){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');return`${y}-${m}-${dd}`;}d=String(d).trim();let m=d.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);if(m)return`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;m=d.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);if(m)return`${m[1]}-${m[2]}-${m[3]}`;return d.substring(0,10);}
function fmt(n,dec=0){return Number(n).toLocaleString('pt-PT',{minimumFractionDigits:dec,maximumFractionDigits:dec||2});}
const CRYPTOS=new Set(['BTC','ETH','XRP','SOL','ADA','DOT','AVAX','MATIC','LINK','LTC','DOGE','BNB','USDT','USDC','SHIB','UNI','ATOM','XLM','ALGO','TRX','MIOTA']);
const ETF_KW=['ETF','UCITS','ISHARES','VANGUARD','XTRACKERS','AMUNDI','LYXOR','INVESCO','SPDR','WISDOMTREE','STOXX','NAREIT','EPRA'];
function ga(name,isin,tipoAtivo){
  if(tipoAtivo){const t=tipoAtivo.toLowerCase();if(t.includes('cripto')||t.includes('crypto'))return 'Cripto';if(t.includes('cfd'))return 'CFD';if(t.includes('etf'))return 'ETF';}
  const n=(name||'').toUpperCase();const first=n.split(/[\s\/]/)[0];
  if(CRYPTOS.has(first))return 'Cripto';if(ETF_KW.some(kw=>n.includes(kw)))return 'ETF';if((isin||'').startsWith('IE'))return 'ETF';return 'Ação';
}
const ISIN_T={'IE00BKM4GZ66':'EMIM','IE00B4L5Y983':'IWDA','IE00B5BMR087':'SXR8','IE00B6R52036':'IS0E','IE00BYZK4776':'2B78','IE00BZCQB185':'QDV5','IE00BK5BQT80':'VWCE','IE00B1FZSF77':'IUSP','US0079031078':'AMD','US02079K3059':'GOOGL','US4581401001':'INTC','US2538681030':'DLR','US6819361006':'OHI','US42250P1030':'DOC','US0152711091':'ARE','US45781V1017':'IIPR','US22948Q1013':'CTO','US69380Q1076':'PACS','DE000SHL1006':'SHL','US1462805086':'SILA','US02083X1037':'PINE','US9256521090':'VICI','US36828Q1013':'GTY'};
function tk(isin,name){if(isin&&ISIN_T[isin])return ISIN_T[isin];const m=String(name||'').match(/\(([A-Z0-9\.]{1,6})\)$/);if(m)return m[1].replace(/\.(US|UK|DE|FR|NL|IT|PT)$/i,'');const skip=new Set(['ISHARES','VANGUARD','XTRACKERS','AMUNDI','THE','INC','CORP','AG','PLC','SA','NV','ETF','UCITS','USD','EUR','ACC','DIST','CORE','CLASS','REIT','BOND','FUND','LTD','GLOBAL','FTSE','MSCI','STOXX','PROPERTIES','REALTY','TRUST','HEALTHCARE','REAL','ESTATE','INCOME','GROWTH','EQUITY','EQUITIES','INVESTORS']);for(const w of(name||'').toUpperCase().split(/[\s\-\/]+/)){if(w.length>=2&&w.length<=6&&!skip.has(w)&&/^[A-Z0-9]+$/.test(w))return w;}return(name||'UNKN').substring(0,8).toUpperCase().replace(/[^A-Z0-9]/g,'');}
function cleanTk(t){return String(t||'').replace(/\.(US|UK|DE|FR|NL|IT|PT)$/i,'').toUpperCase();}
function parseCSVLine(l){const r=[];let c='',q=false;for(let i=0;i<l.length;i++){const ch=l[i];if(ch==='"'){q=!q;}else if(ch===','&&!q){r.push(c.trim());c='';}else{c+=ch;}}r.push(c.trim());return r;}


// ── PARSERS ───────────────────────────────────────────────────────────────────
function parseDEGIRO_TXN(text){
  // Transactions.csv — colunas fixas: 0 Data,2 Produto,3 ISIN,6 Qtd,7 Preço,9 Valor local,11 Valor EUR,13 Autofx,14 Custos,15 Total EUR,16 ID Ordem
  const txns=[],log=[];
  const rows=text.replace(/^﻿/,'').trim().split(/\r?\n/).map(parseCSVLine).slice(1).filter(r=>r.length>=16&&(r[3]||r[2]));
  const orders={},noId=[];
  rows.forEach(r=>{
    const q=pn(r[6]);if(!q)return;
    const o={date:nd(r[0]),product:r[2],isin:r[3],qty:q,eur:pn(r[11]),autofx:pn(r[13]),costs:pn(r[14]),id:(r[16]||'').trim()};
    if(!o.id){noId.push(o);return;}
    const k=o.id+'|'+o.date;
    if(!orders[k])orders[k]={...o,qty:0,eur:0,autofx:0,costs:0};
    const g=orders[k];g.qty+=o.qty;g.eur+=o.eur;g.autofx+=o.autofx;g.costs+=o.costs;
  });
  Object.values(orders).forEach(g=>{
    const qty=Math.abs(g.qty),total=Math.abs(g.eur),fee=Math.abs(g.costs)+Math.abs(g.autofx);
    txns.push({date:g.date,ticker:tk(g.isin,g.product),product:g.product,isin:g.isin,type:g.qty<0?'SELL':'BUY',qty,price:total/qty,total,
      currency:'EUR',broker:'DEGIRO',assetType:ga(g.product,g.isin),commission:Math.abs(g.costs),autofx:Math.abs(g.autofx),totalCost:fee,wht:0});
  });
  // Linhas sem ID de ordem = eventos corporativos. Split: +N e −M no mesmo dia/ISIN com o mesmo valor → rácio N/M nos lotes anteriores
  const byKey={};noId.forEach(o=>{const k=o.isin+'|'+o.date;(byKey[k]=byKey[k]||[]).push(o);});
  Object.values(byKey).forEach(list=>{
    const plus=list.find(o=>o.qty>0),minus=list.find(o=>o.qty<0);
    if(list.length===2&&plus&&minus&&Math.abs(plus.eur+minus.eur)<0.05){
      const ratio=plus.qty/Math.abs(minus.qty);
      txns.filter(t=>t.isin===plus.isin&&t.date<plus.date).forEach(t=>{t.qty*=ratio;t.price/=ratio;});
      log.push(`[INFO] Split ${plus.product} ${plus.date}: ${Math.abs(minus.qty)} → ${plus.qty} (×${ratio}) aplicado às compras anteriores`);
    }else list.forEach(o=>log.push(`[AVISO] Linha sem ID de ordem ignorada: ${o.product} ${o.date} qtd ${o.qty}`));
  });
  txns.sort((a,b)=>a.date.localeCompare(b.date));
  parseDEGIRO_TXN.lastLog=log;
  return txns;
}

function parseDEGIRO_ACC(text){
  // Account.csv — 0 Data,2 Data Valor,3 Produto,4 ISIN,5 Descrição,6 Taxa câmbio,7 Moeda,8 Valor
  const txns=[],log=[];
  const rows=text.replace(/^﻿/,'').trim().split(/\r?\n/).map(parseCSVLine).slice(1);
  const parseD=s=>nd(s);
  // Câmbios: cada conversão automática USD→EUR tem a taxa na linha "Levantamento de divisa" (USD por 1 EUR)
  const fx=rows.filter(r=>r[5]==='Levantamento de divisa'&&r[7]==='USD'&&pn(r[6])>0).map(r=>({date:parseD(r[0]),rate:pn(r[6])})).sort((a,b)=>a.date.localeCompare(b.date));
  const rateFor=d=>{const f=fx.find(x=>x.date>=d);if(f)return f.rate;return fx.length?fx[fx.length-1].rate:1.1;};
  // Dividendos: agrupar pelo evento (ISIN + Data Valor) para que correções/reclassificações posteriores
  // se anulem com o original. A data registada é a "Data" da primeira linha (dinheiro recebido).
  const ev={},capRet={},isDiv=d=>d==='Dividendo'||d==='QIE Distribution Capital Gain',isTax=d=>d==='Imposto sobre dividendo'||d==='QIE Distribution Capital Gain Tax';
  let reclass=0;
  rows.forEach(r=>{
    const desc=(r[5]||'').trim();if(!desc)return;
    const date=parseD(r[0]),cur=r[7]||'EUR',val=pn(r[8]);
    if(isDiv(desc)||isTax(desc)){
      const k=(r[4]||r[3])+'|'+parseD(r[2]);
      if(!ev[k])ev[k]={product:r[3],isin:r[4],date,cur,div:0,tax:0,rows:0};
      const e=ev[k];if(date<e.date)e.date=date;e.rows++;
      if(isDiv(desc)){e.div+=val;if(val<0)reclass++;}else e.tax+=val;
    }else if(desc==='flatex Deposit'||desc==='Depósito'||desc==='flatex Withdrawal'||desc==='Levantamento'){
      // Só estas linhas são dinheiro a entrar/sair. "Depósitos/Levantamentos na sua Conta Caixa" e "Cash Sweep Transfer" são movimentos internos.
      txns.push(cashTxn(date,cur==='EUR'?val:val/rateFor(date),'DEGIRO',desc,(r[1]||'')+'|'+desc));
    }else if(desc==='Capital Return'){
      const y=date.substring(0,4);capRet[y]=(capRet[y]||0)+val/(cur==='EUR'?1:rateFor(date));
    }else if(/Custo de Conectividade|Taxa de Conectividade/.test(desc)){
      txns.push({date,ticker:'DEGIRO',product:desc.substring(0,60),isin:'',type:'FEE',qty:0,price:0,total:0,currency:'EUR',broker:'DEGIRO',assetType:'Ação',commission:Math.abs(val),autofx:0,totalCost:Math.abs(val),wht:0});
    }
  });
  Object.values(ev).forEach(e=>{
    if(e.div<=0.005){if(Math.abs(e.div)>0.005||Math.abs(e.tax)>0.005)log.push(`[AVISO] Evento ${e.product} ${e.date}: dividendo líquido ${e.div.toFixed(2)} ${e.cur}, retenção ${e.tax.toFixed(2)} — ignorado`);return;}
    const rate=e.cur==='EUR'?1:rateFor(e.date),gross=e.div/rate,wht=Math.max(0,-e.tax)/rate;
    txns.push({date:e.date,ticker:tk(e.isin,e.product),product:e.product,isin:e.isin,type:'DIV',qty:1,price:gross,total:gross,currency:'EUR',broker:'DEGIRO',
      assetType:ga(e.product,e.isin),commission:0,autofx:0,totalCost:0,wht,fx:rate});
  });
  if(reclass)log.push(`[INFO] ${reclass} estornos/reclassificações de dividendos acertados no evento original`);
  {const cs=txns.filter(t=>t.type==='CASH');if(cs.length)log.push(`[INFO] ${cs.length} movimentos de capital (líquido €${cs.reduce((a,t)=>a+t.total,0).toFixed(2)})`);}
  Object.entries(capRet).sort().forEach(([y,v])=>log.push(`[INFO] Capital Return ${y}: €${v.toFixed(2)} (devolução de capital — não conta como dividendo)`));
  parseDEGIRO_ACC.lastLog=log;
  return txns;
}

function parseETORO_XLSX(wb){
  const txns=[],log=[];
  const sn=wb.SheetNames.find(s=>s.includes('fechadas')||s.toLowerCase().includes('closed'));
  if(sn){
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:'',raw:false});
    if(rows.length>1){
      const hdr=rows[0].map(h=>String(h).trim().toLowerCase());
      const g=(row,...ns)=>{for(const n of ns){const i=hdr.indexOf(n);if(i>=0&&row[i]!==undefined&&row[i]!=='')return row[i];}return '';};
      rows.slice(1).forEach(row=>{
        const action=String(g(row,'ação','action'));if(!action)return;
        const isin=String(g(row,'isin')||'');const ticker2=tk(isin,action);
        const units=parseFloat(g(row,'unidades','units'))||0;if(units===0)return;
        const openRate=parseFloat(g(row,'taxa de abertura','open rate'))||0;
        const closeRate=parseFloat(g(row,'taxa de fechamento','close rate'))||0;
        const openDateRaw=g(row,'data de abertura','open date');const closeDateRaw=g(row,'data de fecho','close date');
        const openFx=parseFloat(g(row,'taxa de câmbio na abertura (usd)'))||1;const closeFx=parseFloat(g(row,'taxa de câmbio no fechamento (usd)'))||1;
        const spread=parseFloat(g(row,"comissões de 'spread' (usd)"))||0;
        const tipo=String(g(row,'tipo','type')||'').toLowerCase();const assetType=tipo.includes('cripto')||tipo.includes('crypto')?'Cripto':ga(action,isin);
        const buyEUR=openFx>0?openRate/openFx:openRate;const sellEUR=closeFx>0?closeRate/closeFx:closeRate;const spreadEUR=openFx>0?Math.abs(spread)/openFx:Math.abs(spread);
        if(openRate>0)txns.push({date:nd(openDateRaw),ticker:ticker2,product:action,isin,type:'BUY',qty:units,price:buyEUR,total:units*buyEUR,currency:'EUR',broker:'eToro',assetType,commission:spreadEUR,autofx:0,totalCost:spreadEUR,wht:0});
        if(closeRate>0)txns.push({date:nd(closeDateRaw),ticker:ticker2,product:action,isin,type:'SELL',qty:units,price:sellEUR,total:units*sellEUR,currency:'EUR',broker:'eToro',assetType,commission:0,autofx:0,totalCost:0,wht:0});
      });
      log.push(`[OK] Posições fechadas: ${rows.length-1} registos`);
    }
  }
  // Posições abertas (Atividade da conta)
  const actSn=wb.SheetNames.find(s=>s.includes('tividade')||s.toLowerCase().includes('activity'));
  const closedSn=wb.SheetNames.find(s=>s.includes('fechadas')||s.toLowerCase().includes('closed'));
  if(actSn&&closedSn){
    const actRows=XLSX.utils.sheet_to_json(wb.Sheets[actSn],{header:1,defval:'',raw:false});
    const closedRows=XLSX.utils.sheet_to_json(wb.Sheets[closedSn],{header:1,defval:'',raw:false});
    if(actRows.length>1&&closedRows.length>1){
      const actHdr=actRows[0].map(h=>String(h).trim().toLowerCase());
      const clHdr=closedRows[0].map(h=>String(h).trim().toLowerCase());
      const ga2=(row,...ns)=>{for(const n of ns){const i=actHdr.indexOf(n);if(i>=0&&row[i]!==undefined&&row[i]!=='')return row[i];}return '';};
      const closedIdIdx=clHdr.indexOf('id da posição');
      const closedIds=new Set(closedRows.slice(1).map(r=>String(r[closedIdIdx]||'').trim()));
      const tipoIdx=actHdr.indexOf('tipo');const idIdx=actHdr.indexOf('id da posição');
      const openRows=actRows.slice(1).filter(r=>{const tipo=String(r[tipoIdx]||'').trim();const id=String(r[idIdx]||'').trim();return tipo==='Posição de abertura'&&!closedIds.has(id);});
      let openCount=0;
      openRows.forEach(row=>{
        const detalhes=String(ga2(row,'detalhes')||'');const ticker2=detalhes.split('/')[0].trim();
        const montante=parseFloat(ga2(row,'montante'))||0;const units=parseFloat(ga2(row,'unidades'))||0;
        const dateRaw=ga2(row,'data');const tipoAtivo=String(ga2(row,'tipo de ativo')||'');
        if(!ticker2||montante<=0||units<=0)return;
        const priceEUR=montante/units;const assetType=ga(ticker2,'',tipoAtivo);
        txns.push({date:nd(dateRaw),ticker:ticker2,product:ticker2,isin:'',type:'BUY',qty:units,price:priceEUR,total:montante,currency:'EUR',broker:'eToro',assetType,commission:0,autofx:0,totalCost:0,wht:0});
        openCount++;
      });
      log.push(`[OK] Posições abertas: ${openCount} importadas`);
    }
  }
  // Dividendos
  const divSn=wb.SheetNames.find(s=>s.toLowerCase().includes('dividend'));
  if(divSn){
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[divSn],{header:1,defval:'',raw:false});
    if(rows.length>1){
      const hdr=rows[0].map(h=>String(h).trim().toLowerCase());
      const g=(row,...ns)=>{for(const n of ns){const i=hdr.indexOf(n);if(i>=0&&row[i]!==undefined&&row[i]!=='')return row[i];}return '';};
      let divCount=0;
      rows.slice(1).forEach(row=>{
        const name=String(g(row,'nome do instrumento','instrument name'));if(!name)return;
        const isin=String(g(row,'isin')||'');const ticker2=tk(isin,name);
        const dateRaw=g(row,'data de pagamento','payment date');
        const divEUR=parseFloat(g(row,'dividendos líquidos recebidos (eur)','net dividends received (eur)'))||0;
        const whtEUR=parseFloat(g(row,'montante da retenção na fonte (eur)','withholding tax amount (eur)'))||0;
        const gross=divEUR+whtEUR;
        if(gross>0){txns.push({date:nd(dateRaw),ticker:ticker2,product:name,isin,type:'DIV',qty:1,price:gross,total:gross,currency:'EUR',broker:'eToro',assetType:ga(name,isin),commission:0,autofx:0,totalCost:0,wht:whtEUR});divCount++;}
      });
      log.push(`[OK] Dividendos: ${divCount}`);
    }
  }
  return{transactions:txns,log};
}

function parseXTB_XLSX(wb){
  // XTB: usa as 3 folhas. Cash Operations = valores em € (fonte de custo/realização);
  // Open/Closed Positions = quantidades reais por Position ID (corrige splits e comentários errados).
  const txns=[],log=[];
  const sheet=n=>wb.Sheets[n]?XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,defval:'',raw:false}):null;
  const num=v=>{const s=String(v??'').trim().replace(/\s/g,'');if(!s)return 0;return parseFloat(/,\d{1,2}$/.test(s)&&!s.includes('.')?s.replace(',','.'):s.replace(/,/g,''))||0;};
  const pid=v=>{const s=String(v??'').trim().replace(/[.,]0+$/,'');return /^\d+$/.test(s)?s:'';};
  const table=(rows,first)=>{if(!rows)return[];const i=rows.findIndex(r=>String(r[0]).trim()===first||String(r[1]).trim()===first);if(i<0)return[];
    const h=rows[i].map(x=>String(x).trim().toLowerCase());return rows.slice(i+1).map(r=>{const o={};h.forEach((k,j)=>{if(k&&o[k]===undefined)o[k]=r[j];});return o;});};

  const co=table(sheet('Cash Operations'),'Type');
  if(!co.length)return{transactions:txns,log:['[ERRO] Cash Operations não encontrado ou vazio']};

  // 1) Quantidade real de cada posição (lote) = aberta + fechada
  const qtyByPos={},closedByPos={};
  const openLots={};
  table(sheet('Open Positions'),'Instrument/Position').forEach(r=>{const id=pid(r['instrument/position']);if(id&&String(r.type).trim()==='BUY'){qtyByPos[id]=(qtyByPos[id]||0)+num(r.volume);openLots[id]={ticker:cleanTk(r.ticker),time:String(r['open time (utc)']||''),qty:num(r.volume),price:num(r['open price'])};}});
  table(sheet('Closed Positions'),'Instrument').forEach(r=>{const id=pid(r['position id']);if(!id)return;const v=num(r.volume);qtyByPos[id]=(qtyByPos[id]||0)+v;closedByPos[id]=(closedByPos[id]||0)+v;});
  const hasPosSheets=Object.keys(qtyByPos).length>0;
  if(!hasPosSheets)log.push('[AVISO] Sem folhas Open/Closed Positions — quantidades vêm do Comment (pode falhar em splits)');

  const cqty=c=>{const m=String(c||'').match(/(\d+(?:\.\d+)?)(?:\/\d+(?:\.\d+)?)?\s*@/);return m?parseFloat(m[1]):0;};
  const buys={},sells={},divs={},refunds=[],fees=[],cash=[];

  co.forEach(r=>{
    const type=String(r.type||'').trim();if(!type||type==='Total')return;
    const t=String(r.ticker||'').trim(),ticker=cleanTk(t),inst=String(r.instrument||ticker),time=String(r.time||'').trim();
    const amount=num(r.amount),comment=String(r.comment||''),posId=pid(r['position id']);
    if(type==='Stock purchase'){
      const k=posId||('row'+r.id);
      if(!buys[k])buys[k]={ticker,inst,time,eur:0,cq:0,posId,comm:0};
      buys[k].eur+=Math.abs(amount);buys[k].cq+=cqty(comment);
    }else if(type==='Stock sell'||type==='Stock sale'){
      const k=ticker+'|'+time.substring(0,19);
      if(!sells[k])sells[k]={ticker,inst,time,eur:0,qty:0,posIds:[],comm:0};
      const s=sells[k];s.eur+=amount;s.posIds.push(posId);
      let q=cqty(comment);
      if(!q&&posId&&closedByPos[posId]){q=closedByPos[posId];closedByPos[posId]=0;}
      if(!q)log.push(`[ERRO] Venda ${ticker} ${time}: quantidade desconhecida (${comment})`);
      s.qty+=q;
    }else if(type==='Deposit'||type==='Withdrawal'){
      cash.push(cashTxn(nd(time),amount,'XTB',(comment.split(',')[0]||type).trim(),String(r.id||'')));
    }else if(type==='Commission'||type==='SEC fee'){
      fees.push({ticker,time,eur:Math.abs(amount),posId,type});
    }else if(type==='Dividend'){
      const k=ticker+'|'+time.substring(0,10);
      if(!divs[k])divs[k]={ticker,inst,time,div:0,wht:0};
      divs[k].div+=amount;
    }else if(type==='Withholding tax'){
      if(amount>0){refunds.push({ticker,inst,time,eur:amount,comment});return;}
      const k=ticker+'|'+time.substring(0,10);
      if(!divs[k])divs[k]={ticker,inst,time,div:0,wht:0};
      divs[k].wht+=amount;
    }
  });

  // 2) Comissões / SEC fee → venda (mesma posição, na data da venda ou depois) ou compra (mesma posição)
  const sellList=Object.values(sells).sort((a,b)=>a.time.localeCompare(b.time));
  fees.forEach(f=>{
    const s=sellList.filter(s=>s.ticker===f.ticker&&s.posIds.includes(f.posId)&&s.time.substring(0,10)<=f.time.substring(0,10)).pop();
    const b=buys[f.posId];
    if(f.type==='SEC fee'&&s){s.comm+=f.eur;return;}
    if(s&&s.time.substring(0,16)===f.time.substring(0,16)){s.comm+=f.eur;return;}
    if(b){b.comm+=f.eur;return;}
    if(s){s.comm+=f.eur;return;}
    log.push(`[AVISO] ${f.type} ${f.ticker} ${f.time} €${f.eur} sem operação associada`);
  });

  // 3) Compras: qty da posição real; avisa se o Comment não bate
  Object.values(buys).forEach(b=>{
    let qty=b.posId&&qtyByPos[b.posId]?qtyByPos[b.posId]:b.cq;
    if(!qty){log.push(`[ERRO] Compra ${b.ticker} ${b.time}: quantidade desconhecida`);return;}
    if(b.cq&&Math.abs(b.cq-qty)>1e-6)log.push(`[INFO] ${b.ticker} ${nd(b.time)}: Comment diz ${b.cq}, posição tem ${qty} (split?) — usado ${qty}`);
    txns.push({date:nd(b.time),ticker:b.ticker,product:b.inst,isin:'',type:'BUY',qty,price:b.eur/qty,total:b.eur,
      currency:'EUR',broker:'XTB',assetType:ga(b.inst,''),commission:b.comm,autofx:0,totalCost:b.comm,wht:0,_xtbPos:b.posId});
  });
  // 3b) Lotes abertos sem compra no Cash Operations (ex.: ação oferecida) — custo = qty × open price
  Object.entries(openLots).forEach(([id,l])=>{if(buys[id])return;
    const inst=(co.find(r=>cleanTk(r.ticker)===l.ticker)||{}).instrument||l.ticker,eur=l.qty*l.price;
    txns.push({date:nd(l.time),ticker:l.ticker,product:inst,isin:'',type:'BUY',qty:l.qty,price:l.price,total:eur,
      currency:'EUR',broker:'XTB',assetType:ga(inst,''),commission:0,autofx:0,totalCost:0,wht:0,_xtbPos:id});
    log.push(`[INFO] ${l.ticker} ${nd(l.time)}: ${l.qty} un. sem compra no Cash Operations (oferta?) — custo €${eur.toFixed(2)}`);
  });
  // 4) Vendas agrupadas (1 ordem = 1 linha)
  sellList.forEach(s=>{if(!s.qty)return;
    txns.push({date:nd(s.time),ticker:s.ticker,product:s.inst,isin:'',type:'SELL',qty:s.qty,price:s.eur/s.qty,total:s.eur,
      currency:'EUR',broker:'XTB',assetType:ga(s.inst,''),commission:s.comm,autofx:0,totalCost:s.comm,wht:0});
  });
  // 5) Dividendos (WHT = soma das retenções desse dia) + estornos de retenção em linha própria
  Object.values(divs).forEach(d=>{
    if(d.div<=0){if(d.wht)log.push(`[AVISO] Retenção sem dividendo: ${d.ticker} ${d.time} €${d.wht.toFixed(2)}`);return;}
    txns.push({date:nd(d.time),ticker:d.ticker,product:d.inst,isin:'',type:'DIV',qty:1,price:d.div,total:d.div,
      currency:'EUR',broker:'XTB',assetType:ga(d.inst,''),commission:0,autofx:0,totalCost:0,wht:Math.abs(d.wht)});
  });
  refunds.forEach(f=>{
    txns.push({date:nd(f.time),ticker:f.ticker,product:f.inst+' — estorno retenção',isin:'',type:'DIV',qty:1,price:0,total:0,
      currency:'EUR',broker:'XTB',assetType:ga(f.inst,''),commission:0,autofx:0,totalCost:0,wht:-f.eur,refund:true,note:f.comment});
    log.push(`[INFO] Estorno de retenção ${f.ticker} ${nd(f.time)} +€${f.eur.toFixed(2)} (${f.comment})`);
  });

  txns.push(...cash);
  const c=k=>txns.filter(t=>t.type===k&&!t.refund).length;
  log.unshift(`[OK] XTB: ${c('BUY')} compras | ${c('SELL')} vendas | ${c('DIV')} dividendos | ${refunds.length} estornos WHT | ${cash.length} movimentos de capital (líquido €${cash.reduce((a,t)=>a+t.total,0).toFixed(2)})`);
  return{transactions:txns,log};
}

function parseIBKR_PT(text){
  // Histórico de transações (PT). Colunas: 2 Data,4 Descrição,5 Tipo,6 Símbolo,7 Qtd,8 Preço,9 Moeda,10 Valor bruto,11 Corretagem,12 Valor líquido
  // Valor bruto / corretagem / líquido já vêm na moeda-base (EUR) — não converter.
  const txns=[],log=[];
  const rows=text.replace(/^﻿/,'').trim().split(/\r?\n/).map(parseCSVLine).filter(r=>r[0]==='Histórico de transações'&&r[1]==='Data');
  if(!rows.length)return{transactions:txns,log:['[ERRO] Secção "Histórico de transações" não encontrada']};
  const f=v=>{const n=parseFloat(String(v).replace(/,/g,''));return isNaN(n)?0:n;};
  const isinOf=d=>{const m=String(d||'').match(/\(([A-Z]{2}[A-Z0-9]{9}\d)\)/);return m?m[1]:'';};
  const tick=(sym,isin)=>isin&&ISIN_T[isin]?ISIN_T[isin]:String(sym).replace(/\.DvRT$/,'');
  const isOpt=s=>/\s\d{6}[CP]\d{8}$/.test(String(s));
  const sorted=[...rows].sort((a,b)=>a[2].localeCompare(b[2]));
  const held={},names={},divs={},opts=[],isinBySym={};
  rows.forEach(r=>{const m=String(r[4]).match(/^([A-Z0-9.]+)\(([A-Z]{2}[A-Z0-9]{9}\d)\)/);if(m)isinBySym[m[1].replace(/\.DvRT$/,'')]=m[2];});
  sorted.forEach(r=>{
    const date=nd(r[2]),desc=r[4],tipo=r[5],sym=r[6],isin=isinOf(desc)||isinBySym[String(sym).replace(/\.DvRT$/,'')]||'';
    if(tipo==='Compra'||tipo==='Venda'){
      const qty=Math.abs(f(r[7])),gross=Math.abs(f(r[10])),comm=Math.abs(f(r[11]));
      if(isOpt(sym)){opts.push(`${date} ${tipo} ${qty} ${desc} @ ${r[8]} ${r[9]} → €${f(r[12]).toFixed(2)}`);return;}
      const t=tick(sym,isin);names[sym]=desc;held[sym]=(held[sym]||0)+(tipo==='Compra'?qty:-qty);
      txns.push({date,ticker:t,product:desc,isin,type:tipo==='Compra'?'BUY':'SELL',qty,price:gross/qty,total:gross,currency:'EUR',broker:'IBKR',
        assetType:ga(desc,isin),commission:comm,autofx:0,totalCost:comm,wht:0,_sym:sym});
    }else if(tipo==='Depósito'||tipo==='Levantamento'){
      txns.push(cashTxn(date,f(r[12]),'IBKR',desc,r[2]+'|'+r[12]));
    }else if(tipo==='Operação societária'){
      // Fusão/aquisição em dinheiro → venda de toda a posição pelo valor recebido
      const q=held[sym]||0,eur=f(r[12]);
      if(q>0&&eur>0&&/Aquisição|Mesclado/i.test(desc)){
        held[sym]=0;txns.push({date,ticker:tick(sym,isin),product:names[sym]||desc,isin,type:'SELL',qty:q,price:eur/q,total:eur,currency:'EUR',broker:'IBKR',
          assetType:ga(names[sym]||desc,isin),commission:0,autofx:0,totalCost:0,wht:0,corporate:true});
        log.push(`[INFO] ${sym} ${date}: aquisição em dinheiro — ${q} ações vendidas por €${eur.toFixed(2)}`);
      }else log.push(`[AVISO] Operação societária não tratada: ${date} ${desc}`);
    }else if(tipo==='Dividendo'||tipo==='Retenção de imposto estrangeiro'){
      const base=String(sym).replace(/\.DvRT$/,''),k=base+'|'+date;
      if(!divs[k])divs[k]={sym:base,isin,date,desc,div:0,wht:0};
      if(isin&&!divs[k].isin)divs[k].isin=isin;
      if(tipo==='Dividendo')divs[k].div+=f(r[12]);else divs[k].wht+=f(r[12]); // soma algébrica (há estornos positivos)
    }
  });
  Object.values(divs).forEach(d=>{
    const t=tick(d.sym,d.isin),prod=String(d.desc).replace(/\(.*$/,'').trim()||d.sym;
    if(d.div>0){
      txns.push({date:d.date,ticker:t,product:names[d.sym]||prod,isin:d.isin,type:'DIV',qty:1,price:d.div,total:d.div,currency:'EUR',broker:'IBKR',
        assetType:ga(names[d.sym]||prod,d.isin),commission:0,autofx:0,totalCost:0,wht:Math.max(0,-d.wht)});
      if(d.wht>0.005)log.push(`[INFO] ${d.sym} ${d.date}: estornos de retenção superiores à retenção (+€${d.wht.toFixed(2)})`);
    }else if(Math.abs(d.wht)>0.005){
      txns.push({date:d.date,ticker:t,product:(names[d.sym]||prod)+' — acerto retenção',isin:d.isin,type:'DIV',qty:1,price:0,total:0,currency:'EUR',broker:'IBKR',
        assetType:ga(names[d.sym]||prod,d.isin),commission:0,autofx:0,totalCost:0,wht:-d.wht,refund:d.wht>0});
      log.push(`[INFO] ${d.sym} ${d.date}: acerto de retenção sem dividendo ${d.wht>0?'+':''}€${d.wht.toFixed(2)}`);
    }
  });
  if(opts.length)log.push(`[AVISO] ${opts.length} operação(ões) de opções não importada(s): `+opts.join(' | '));
  const c=k=>txns.filter(t=>t.type===k).length;
  const cs=txns.filter(t=>t.type==='CASH');
  log.unshift(`[OK] IBKR: ${c('BUY')} compras | ${c('SELL')} vendas | ${c('DIV')} dividendos | ${cs.length} movimentos de capital (líquido €${cs.reduce((a,t)=>a+t.total,0).toFixed(2)})`);
  return{transactions:txns,log};
}

function parseFREEDOM24(h,r){const g=(...ns)=>{for(const n of ns){const i=h.indexOf(n);if(i>=0&&r[i]&&r[i]!=='')return r[i];}return '';};const date=g('date','tradedate');const ticker2=g('ticker','symbol','isin');const t=g('operation','type','transactiontype').toLowerCase();const type=t.includes('sell')?'SELL':t.includes('div')?'DIV':'BUY';const qty=Math.abs(pn(g('quantity','volume','qty')));const price=Math.abs(pn(g('price','tradeprice')));const comm=Math.abs(pn(g('commission','fee','fees')));if(!ticker2)return null;return{date:nd(date),ticker:cleanTk(ticker2).substring(0,8),product:ticker2,isin:'',type,qty,price,total:qty*price,currency:g('currency')||'USD',broker:'Freedom24',assetType:ga(ticker2,''),commission:comm,autofx:0,totalCost:comm,wht:0};}
function parseManualCSV(h,r){const g=(...ns)=>{for(const n of ns){const i=h.indexOf(n);if(i>=0&&r[i]&&r[i]!=='')return r[i];}return '';};const date=g('date');const ticker2=g('ticker','symbol');const type=(g('type')||'BUY').toUpperCase();const qty=Math.abs(pn(g('qty','quantity')));const price=Math.abs(pn(g('price')));const comm=Math.abs(pn(g('cost','commission','fee')));const broker=g('broker')||'Manual';if(!ticker2)return null;return{date:nd(date),ticker:ticker2.toUpperCase(),product:g('product')||ticker2,isin:'',type,qty,price,total:qty*price,currency:g('currency')||'EUR',broker,assetType:ga(ticker2,''),commission:comm,autofx:0,totalCost:comm,wht:0};}


// ══════════════════════════════════════════════════════════════════════════════
// EQUATE PLUS (Siemens Healthineers — Share Matching / MIP) — declaração de fim de ano em PDF
// ══════════════════════════════════════════════════════════════════════════════
// Reconstrói linhas de texto a partir dos itens do pdf.js (colunas separadas por " | ")
function pdfLines(pages){
  const out=[];
  pages.forEach(items=>{
    const L=[];
    items.filter(i=>i.s&&i.s.trim()!=='').forEach(i=>{let l=L.find(l=>Math.abs(l.y-i.y)<=2.5);if(!l){l={y:i.y,it:[]};L.push(l);}l.it.push(i);});
    L.sort((a,b)=>b.y-a.y).forEach(l=>{
      l.it.sort((a,b)=>a.x-b.x);let s='',end=null;
      l.it.forEach(i=>{const gap=end===null?0:i.x-end;s+=end===null?'':gap>12?' | ':gap>1.5?' ':'';s+=i.s;end=i.x+i.w;});
      out.push(s.replace(/\s+/g,' ').trim());
    });
  });
  return out;
}
const EQ_MONTHS={jan:1,fev:2,feb:2,mar:3,abr:4,apr:4,mai:5,may:5,jun:6,jul:7,ago:8,aug:8,set:9,sep:9,out:10,oct:10,nov:11,dez:12,dec:12};
function eqDate(s){const m=String(s||'').trim().toLowerCase().match(/^(\d{1,2})\.? ([a-zç]{3})[a-z.]* (\d{4})$/);if(!m||!EQ_MONTHS[m[2]])return null;return`${m[3]}-${String(EQ_MONTHS[m[2]]).padStart(2,'0')}-${m[1].padStart(2,'0')}`;}
function eqNum(s){const t=String(s||'').replace(/EUR/i,'').replace(/[\s ]/g,'').trim();if(!/^-?[\d.,]+$/.test(t))return NaN;return parseFloat(/,\d{1,3}$/.test(t)&&!/\.\d+,/.test(t)?t.replace(/\./g,'').replace(',','.'):t.replace(/,/g,''));}
const EQ_ISIN='DE000SHL1006',EQ_TK='SHL',EQ_NAME='Siemens Healthineers AG';
function parseEQUATE_LINES(lines){
  const log=[],lots=[],divs=[],other=[];
  // Período da declaração
  let from=null,to=null;
  for(const l of lines){const m=l.match(/(\d{1,2} [a-zç]{3} \d{4}) - (\d{1,2} [a-zç]{3} \d{4})/i);if(m){from=eqDate(m[1]);to=eqDate(m[2]);if(from&&to)break;}}
  let section='',last=null;
  lines.forEach(l=>{
    const c=l.split(' | ');
    if(/^(Folha de pagamento|Transferência|Dividendo|Venda|Vendas|Compra|Sale|Sell|Transfer)$/i.test(l)){section=l.toLowerCase();last=null;return;}
    if(/^Nome do plano \|/.test(l)){section='lotes';last=null;return;}
    if(/^Planos \|/.test(l)||/^Transações \|/.test(l)){section='';last=null;}
    // Lote: Plano | Instrumento | Data de alocação | Base de custo | Quantidade | Valor estimado
    if(section==='lotes'&&c.length>=5){const d=eqDate(c[2]),cost=eqNum(c[3]),q=eqNum(c[4]);
      if(d&&isFinite(cost)&&isFinite(q)&&q>0){last={plan:c[0],instr:c[1],date:d,cps:cost,qty:q};lots.push(last);return;}}
    if(section==='lotes'&&last&&c.length===1&&!/^(Página|Siemens Healthineers Share:|\d{4} Zurich|Switzerland|Suíça|Declaração|Plan holdings)/i.test(l)){last.instr+=' '+l;return;}
    if(section==='dividendo'&&c.length>=8){const dEx=eqDate(c[0]),dPay=eqDate(c[1]);
      if(dEx&&dPay){divs.push({date:dPay,exDate:dEx,qty:eqNum(c[2]),gross:eqNum(c[4]),tax:eqNum(c[5]),fees:eqNum(c[6])||0,net:eqNum(c[7])});return;}}
    if(section&&section!=='lotes'&&section!=='dividendo'&&c.length>=3&&eqDate(c[0]))other.push(section+': '+l);
  });
  const kind=p=>/match/i.test(p.plan)?'MATCH':/dividend/i.test(p.plan)?'DRIP':/^MIP/i.test(p.plan)?'MIP':/^SMP/i.test(p.plan)?'SMP':'OUTRO';
  const txns=lots.map(p=>{const k=kind(p),unm=/UNMATCHED/i.test(p.instr);
    return{date:p.date,ticker:EQ_TK,product:EQ_NAME,isin:EQ_ISIN,type:'BUY',qty:p.qty,price:p.cps,total:p.cps*p.qty,currency:'EUR',broker:'Equate',assetType:'Ação',
      commission:0,autofx:0,totalCost:0,wht:0,plan:k,unmatched:unm,note:(p.plan+' — '+p.instr).replace(/\s+/g,' '),_ref:p.date+'|'+p.qty,_rangeFrom:'0000-01-01',_rangeTo:to||p.date};});
  divs.forEach(d=>txns.push({date:d.date,ticker:EQ_TK,product:EQ_NAME,isin:EQ_ISIN,type:'DIV',qty:1,price:d.gross,total:d.gross,currency:'EUR',broker:'Equate',assetType:'Ação',
    commission:d.fees||0,autofx:0,totalCost:0,wht:d.tax||0,_rangeFrom:from||d.date,_rangeTo:to||d.date}));
  const by=k=>txns.filter(t=>t.plan===k);const sq=a=>a.reduce((s,t)=>s+t.qty,0);
  log.push(`[OK] Equate ${from||'?'} a ${to||'?'}: ${lots.length} lotes (${sq(txns.filter(t=>t.type==='BUY')).toFixed(3)} ações) | ${divs.length} dividendo(s)`);
  log.push(`[INFO] Compras SMP ${sq(by('SMP')).toFixed(3)} · MIP ${sq(by('MIP')).toFixed(3)} · Matching ${sq(by('MATCH')).toFixed(3)} · Dividendos reinvestidos ${sq(by('DRIP')).toFixed(3)}`);
  const un=txns.filter(t=>t.unmatched);if(un.length)log.push(`[INFO] ${sq(un).toFixed(3)} ações SMP ainda sem matching (UNMATCHED)`);
  if(by('OUTRO').length)log.push(`[AVISO] ${by('OUTRO').length} lote(s) de plano desconhecido: `+by('OUTRO').map(t=>t.note).join('; '));
  if(other.some(o=>/^(venda|vendas|sale|sell)/.test(o)))log.push('[AVISO] A declaração tem vendas — ainda não tratadas pela app: '+other.filter(o=>/^(venda|vendas|sale|sell)/.test(o)).join(' | '));
  return{transactions:txns,log,from,to};
}
// Vários PDFs: lotes vêm da declaração mais recente (posições a 31/12); dividendos de todas
function mergeEQUATE(results){
  results.sort((a,b)=>(a.to||'').localeCompare(b.to||''));
  const newest=results[results.length-1],txns=[],log=[],seen=new Set();
  results.forEach(r=>{log.push(...r.log);r.transactions.filter(t=>t.type==='DIV').forEach(t=>{const k=t.date+'|'+t.total;if(!seen.has(k)){seen.add(k);txns.push(t);}});});
  txns.push(...newest.transactions.filter(t=>t.type==='BUY'));
  if(results.length>1)log.unshift(`[OK] ${results.length} declarações — lotes da mais recente (${newest.to}), dividendos de todas`);
  return{transactions:txns,log};
}
let _pdfjsP=null;
function loadPdfJs(){
  if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
  if(_pdfjsP)return _pdfjsP;
  _pdfjsP=new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
    s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';res(window.pdfjsLib);};
    s.onerror=()=>{_pdfjsP=null;rej(new Error('Não consegui carregar o leitor de PDF'));};document.head.appendChild(s);});
  return _pdfjsP;
}
async function pdfToLines(arrayBuffer){
  const pdfjs=await loadPdfJs();const doc=await pdfjs.getDocument({data:new Uint8Array(arrayBuffer)}).promise;const pages=[];
  for(let i=1;i<=doc.numPages;i++){const tc=await(await doc.getPage(i)).getTextContent();pages.push(tc.items.filter(it=>it.str!==undefined).map(it=>({s:it.str,x:it.transform[4],y:it.transform[5],w:it.width})));}
  return pdfLines(pages);
}
