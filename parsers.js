// PortfolioTracker PT — parsers.js (utils + parsers das corretoras)
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
  const txns=[];const rows=text.trim().split('\n').map(parseCSVLine);const headers=rows[0].map(h=>h.toLowerCase().trim().replace(/^"|"$/g,''));
  rows.slice(1).forEach(row=>{
    const bi=i=>row[i]!==undefined?String(row[i]).replace(/^"|"$/g,'').trim():'';
    const bn=(...ns)=>{for(const n of ns){const i=headers.indexOf(n);if(i>=0&&row[i]!==undefined&&String(row[i]).trim()!='')return String(row[i]).replace(/^"|"$/g,'').trim();}return '';};
    const date=bn('data','date')||bi(0),product=bn('produto','product')||bi(2),isin=bn('isin')||bi(3);if(!product&&!isin)return;
    const qn=pn(bi(6)||bn('quantidade','quantity')),qty=Math.abs(qn);
    const price=Math.abs(pn(bi(7)||bn('preços','price')));
    const autofx=Math.abs(pn(bi(13))),costs=Math.abs(pn(bi(14))),totalEUR=Math.abs(pn(bi(15)||bn('total eur','total')));
    if(qty===0&&totalEUR===0)return;
    const type=qn<0?'SELL':'BUY',assetType=ga(product,isin),ticker=tk(isin,product);
    const ep=price>0?price:(qty>0?(totalEUR-costs)/qty:0);
    txns.push({date:nd(date),ticker,product,isin:isin||'',type,qty,price:Math.abs(ep),total:Math.abs(qty>0?qty*ep:totalEUR-costs),currency:'EUR',broker:'DEGIRO',assetType,commission:costs,autofx,totalCost:costs+autofx,wht:0});
  });
  return txns;
}

function parseDEGIRO_ACC(text){
  const txns=[];const rows=text.trim().split('\n').map(parseCSVLine).slice(1);
  const fxByDate={};
  for(let i=0;i<rows.length-1;i++){const r=rows[i],next=rows[i+1];if(r[5]==='Crédito de divisa'&&r[7]==='EUR'&&next&&next[5]==='Levantamento de divisa'&&next[7]==='USD'){const ea=Math.abs(pn(r[8])),ua=Math.abs(pn(next[8]));if(ea>0&&ua>0)fxByDate[nd(r[0])]=ua/ea;}}
  const divMap={};
  rows.forEach(r=>{
    if(!r[5])return;const desc=r[5].trim(),date=nd(r[0]),produto=r[3]||'',isin=r[4]||'',moeda=r[7]||'EUR',valor=pn(r[8]);const key=`${isin||produto}|${date}`;
    if(desc==='Dividendo'){if(!divMap[key])divMap[key]={produto,isin,date,divUSD:0,divEUR:0,whtUSD:0,whtEUR:0};if(moeda==='EUR')divMap[key].divEUR+=valor;else divMap[key].divUSD+=valor;}
    else if(desc==='Imposto sobre dividendo'||desc.startsWith('QIE')){if(!divMap[key])divMap[key]={produto,isin,date,divUSD:0,divEUR:0,whtUSD:0,whtEUR:0};if(moeda==='EUR')divMap[key].whtEUR+=Math.abs(valor);else divMap[key].whtUSD+=Math.abs(valor);}
    else if(desc.includes('Custo de Conectividade')||desc.includes('Taxa de Conectividade')){txns.push({date,ticker:'DEGIRO',product:desc.substring(0,40),isin:'',type:'FEE',qty:0,price:0,total:0,currency:'EUR',broker:'DEGIRO',assetType:'Ação',commission:Math.abs(valor),autofx:0,totalCost:Math.abs(valor),wht:0});}
  });
  const sorted=Object.keys(fxByDate).sort();
  Object.values(divMap).forEach(d=>{
    let rate=fxByDate[d.date];
    if(!rate&&sorted.length>0){const cl=sorted.reduce((p,c)=>Math.abs(new Date(c)-new Date(d.date))<Math.abs(new Date(p)-new Date(d.date))?c:p,sorted[0]);rate=fxByDate[cl]||1.1;}
    rate=rate||1.1;const divEUR=d.divEUR>0?d.divEUR:(d.divUSD>0?d.divUSD/rate:0);const whtEUR=d.whtEUR>0?d.whtEUR:(d.whtUSD>0?d.whtUSD/rate:0);const gross=divEUR+whtEUR;
    if(gross>0.001){const ticker2=tk(d.isin,d.produto);txns.push({date:d.date,ticker:ticker2,product:d.produto,isin:d.isin,type:'DIV',qty:1,price:gross,total:gross,currency:'EUR',broker:'DEGIRO',assetType:ga(d.produto,d.isin),commission:0,autofx:0,totalCost:0,wht:whtEUR});}
  });
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
  const txns=[],log=[];
  const wsCO=wb.Sheets['Cash Operations'];
  if(!wsCO)return{transactions:txns,log:['[ERRO] Cash Operations não encontrado']};
  const rows=XLSX.utils.sheet_to_json(wsCO,{header:1,defval:'',raw:false});
  const hIdx=rows.findIndex(r=>String(r[0]).trim()==='Type');
  if(hIdx<0)return{transactions:txns,log:['[ERRO] Header não encontrado']};
  const hdr=rows[hIdx].map(h=>String(h).trim().toLowerCase());
  const g=(row,...ns)=>{for(const n of ns){const i=hdr.indexOf(n);if(i>=0&&row[i]!==undefined&&row[i]!=='')return row[i];}return '';};

  // Agrupar por ID para evitar duplicados (XTB divide posição em múltiplas linhas)
  const buyMap={};  // ID → {ticker, inst, timeRaw, totalEUR, qty, price, assetType}
  const divMap={};  // ID → {ticker, inst, timeRaw, div, wht, assetType}

  rows.slice(hIdx+1).forEach(row=>{
    const type=String(g(row,'type')).trim();
    const rawTicker=String(g(row,'ticker','symbol')||'');
    const ticker2=cleanTk(rawTicker);
    const inst=String(g(row,'instrument')||ticker2);
    const timeRaw=g(row,'time');
    const amount=parseFloat(String(g(row,'amount')).replace(',','.'))||0;
    const comment=String(g(row,'comment')||'');
    const id=String(g(row,'id')||Math.random());
    const assetType=ga(inst,'');

    if(type==='Stock purchase'||type==='Stock sale'||type==='Stock sell'){
      const isSell=type==='Stock sale'||type==='Stock sell';
      const totalEUR=Math.abs(amount);
      // Comment: "OPEN BUY 300 @ 5.09" ou "CLOSE BUY 300/1500 @ 5.52"
      const cm=comment.match(/(\d+(?:\.\d+)?)(?:\/\d+)?\s*@\s*([\d\.]+)/);
      let qty=cm?parseFloat(cm[1]):0;
      if(qty<=0)return;
      if(isSell){
        // Agrupar vendas pelo total da posição (Comment: "CLOSE BUY 24/300" → posição de 300)
        // Isto reconstrói a venda real antes do FIFO interno do XTB
        const totalPos=comment.match(/\/(\d+)/);
        const posTotal=totalPos?parseInt(totalPos[1]):qty;
        const posKey=`${ticker2}|${nd(timeRaw)}|${posTotal}`;
        if(!buyMap['sell_'+posKey]){
          buyMap['sell_'+posKey]={ticker:ticker2,inst,timeRaw,totalEUR:0,qty:0,assetType,isSell:true,_xtbId:'sell_'+posKey};
        }
        buyMap['sell_'+posKey].totalEUR+=totalEUR;
        buyMap['sell_'+posKey].qty+=qty;
      } else {
        // Compras: agrupar por ID para evitar duplicados
        if(!buyMap[id])buyMap[id]={ticker:ticker2,inst,timeRaw,totalEUR:0,qty:0,assetType,isSell:false};
        buyMap[id].totalEUR+=totalEUR;
        buyMap[id].qty+=qty;
      }
    } else if(type==='Dividend'||type==='DIVIDENT'||type==='DIVIDENT '){
      if(!divMap[id])divMap[id]={ticker:ticker2,inst,timeRaw,div:0,wht:0,assetType};
      divMap[id].div+=amount;
    } else if(type==='Withholding tax'||type==='Withholding Tax'){
      if(!divMap[id])divMap[id]={ticker:ticker2,inst,timeRaw,div:0,wht:0,assetType};
      // Soma algébrica — WHT pode ter estornos positivos
      divMap[id].wht+=amount; // manter sinal para cancelamento
    }
  });

  // Processar compras e vendas agrupadas
  Object.values(buyMap).forEach(b=>{
    const avgPrice=b.qty>0?b.totalEUR/b.qty:0;
    txns.push({date:nd(b.timeRaw),ticker:b.ticker,product:b.inst,isin:'',
      type:b.isSell?'SELL':'BUY',qty:b.qty,price:avgPrice,total:b.totalEUR,
      currency:'EUR',broker:'XTB',assetType:b.assetType,
      commission:0,autofx:0,totalCost:0,wht:0,
      ...(b._xtbId?{_xtbId:b._xtbId}:{})});
  });

  // Processar dividendos (WHT algébrico — negativos são retenções, positivos são estornos)
  Object.values(divMap).forEach(d=>{
    if(d.div>0){
      const whtFinal=Math.abs(Math.min(0,d.wht)); // só o valor negativo líquido
      txns.push({date:nd(d.timeRaw),ticker:d.ticker,product:d.inst,isin:'',
        type:'DIV',qty:1,price:d.div,total:d.div,currency:'EUR',broker:'XTB',
        assetType:d.assetType,commission:0,autofx:0,totalCost:0,wht:whtFinal});
    }
  });

  const b=txns.filter(t=>t.type==='BUY').length;
  const s=txns.filter(t=>t.type==='SELL').length;
  const dv=txns.filter(t=>t.type==='DIV').length;
  log.unshift(`[OK] XTB: ${b} compras | ${s} vendas | ${dv} dividendos`);
  return{transactions:txns,log};
}

function parseIBKR_PT(text){const txns=[],log=[];const lines=text.trim().split('\n');const rows=lines.map(l=>{const r=[];let cur='',inQ=false;for(let i=0;i<l.length;i++){const c=l[i];if(c==='"'){inQ=!inQ;}else if(c===','&&!inQ){r.push(cur.trim());cur='';}else{cur+=c;}}r.push(cur.trim());return r;});const txnRows=rows.filter(r=>r[0]==='Histórico de transações'&&r[1]==='Data');const fxRates={};txnRows.forEach(r=>{if(r[5]==='Componente de negociação de Forex'&&r[6]&&r[6].includes('EUR.USD')){const date=r[2]?r[2].substring(0,10):'';const rate=parseFloat(r[8])||0;if(date&&rate>0)fxRates[date]=rate;}});const divMap={};txnRows.forEach(r=>{const tipo=r[5];if(tipo==='Dividendo'||tipo==='Retenção de imposto estrangeiro'){const sym=r[6]&&r[6]!=='-'?r[6]:'';if(!sym)return;const date=r[2]?r[2].substring(0,10):'';const key=`${sym}|${date}`;if(!divMap[key])divMap[key]={sym,date,desc:r[4],div:0,wht:0};const val=parseFloat(String(r[12]).replace(',','.'))||0;if(tipo==='Dividendo')divMap[key].div+=val;else divMap[key].wht+=val;}});txnRows.forEach(r=>{const tipo=r[5];if(tipo!=='Compra'&&tipo!=='Venda')return;const sym=r[6]&&r[6]!=='-'?r[6]:'';if(!sym)return;const date=r[2]?r[2].substring(0,10):'';const qty=Math.abs(parseFloat(r[7])||0);const priceRaw=parseFloat(r[8])||0;const moeda=r[9]||'USD';const grossRaw=parseFloat(String(r[10]).replace(',','.'))||0;const commRaw=parseFloat(String(r[11]).replace(',','.'))||0;let priceEUR,totalEUR,commEUR;if(moeda==='EUR'){priceEUR=priceRaw;totalEUR=Math.abs(grossRaw);commEUR=Math.abs(commRaw);}else{const rate=fxRates[date]||Object.values(fxRates).slice(-1)[0]||1.1;priceEUR=priceRaw/rate;totalEUR=Math.abs(grossRaw)/rate;commEUR=Math.abs(commRaw)/rate;}const isinMatch=r[4]?r[4].match(/\(([A-Z]{2}[A-Z0-9]{10})\)/):null;const isin=isinMatch?isinMatch[1]:'';const ticker2=isin?(ISIN_T[isin]||sym):sym;const product=r[4]?r[4].split('(')[0].trim():sym;txns.push({date:nd(date),ticker:ticker2,product:product||sym,isin,type:tipo==='Compra'?'BUY':'SELL',qty,price:priceEUR,total:totalEUR,currency:'EUR',broker:'IBKR',assetType:ga(product||sym,isin),commission:commEUR,autofx:0,totalCost:commEUR,wht:0});});Object.values(divMap).forEach(d=>{if(d.div===0)return;const sym=d.sym;const isinMatch=d.desc?d.desc.match(/\(([A-Z]{2}[A-Z0-9]{10})\)/):null;const isin=isinMatch?isinMatch[1]:'';const ticker2=isin?(ISIN_T[isin]||sym):sym;txns.push({date:nd(d.date),ticker:ticker2,product:d.desc?d.desc.split('(')[0].trim():sym,isin,type:'DIV',qty:1,price:d.div,total:d.div,currency:'EUR',broker:'IBKR',assetType:ga(d.desc||sym,isin),commission:0,autofx:0,totalCost:0,wht:Math.abs(Math.min(0,d.wht))});});const b=txns.filter(t=>t.type==='BUY').length,s=txns.filter(t=>t.type==='SELL').length,dv=txns.filter(t=>t.type==='DIV').length;log.unshift(`[OK] IBKR: ${b} compras | ${s} vendas | ${dv} dividendos`);return{transactions:txns,log};}

function parseFREEDOM24(h,r){const g=(...ns)=>{for(const n of ns){const i=h.indexOf(n);if(i>=0&&r[i]&&r[i]!=='')return r[i];}return '';};const date=g('date','tradedate');const ticker2=g('ticker','symbol','isin');const t=g('operation','type','transactiontype').toLowerCase();const type=t.includes('sell')?'SELL':t.includes('div')?'DIV':'BUY';const qty=Math.abs(pn(g('quantity','volume','qty')));const price=Math.abs(pn(g('price','tradeprice')));const comm=Math.abs(pn(g('commission','fee','fees')));if(!ticker2)return null;return{date:nd(date),ticker:cleanTk(ticker2).substring(0,8),product:ticker2,isin:'',type,qty,price,total:qty*price,currency:g('currency')||'USD',broker:'Freedom24',assetType:ga(ticker2,''),commission:comm,autofx:0,totalCost:comm,wht:0};}
function parseManualCSV(h,r){const g=(...ns)=>{for(const n of ns){const i=h.indexOf(n);if(i>=0&&r[i]&&r[i]!=='')return r[i];}return '';};const date=g('date');const ticker2=g('ticker','symbol');const type=(g('type')||'BUY').toUpperCase();const qty=Math.abs(pn(g('qty','quantity')));const price=Math.abs(pn(g('price')));const comm=Math.abs(pn(g('cost','commission','fee')));const broker=g('broker')||'Manual';if(!ticker2)return null;return{date:nd(date),ticker:ticker2.toUpperCase(),product:g('product')||ticker2,isin:'',type,qty,price,total:qty*price,currency:g('currency')||'EUR',broker,assetType:ga(ticker2,''),commission:comm,autofx:0,totalCost:comm,wht:0};}

