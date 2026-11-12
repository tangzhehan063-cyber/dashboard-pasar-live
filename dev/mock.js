(function(){
const day=864e5, seed={AAPL:340,BBCA:5300,BBRI:4100,BTC:1.6e9,ETH:5.8e7,SOL:2.4e6,XRP:3.9e4,DOGE:3.2e3,BNB:1e7};
function ohlc(sym,start){start=start||new Date(Date.now()-90*day);const n=Math.max(2,Math.round((Date.now()-new Date(start))/day));let p=seed[sym]||1e5;const a=[];for(let i=0;i<n;i++){const o=p;p=p*(1+Math.sin(i*1.3+sym.length)*0.02+0.002);a.push({st:new Date(Date.now()-(n-i)*day).toISOString(),o,h:Math.max(o,p)*1.01,l:Math.min(o,p)*0.99,c:p});}return a;}
function pay(tool,inp){
 if(tool==="generate_new_session_id")return{data:{chatSessionId:"mock"}};
 if(tool==="crypto_get_price")return{data:inp.symbols.map(s=>({symbol:s,midPrice:(seed[s]||1e5)*1.08}))};
 if(/_get_technicals$/.test(tool)){const L=(seed[inp.symbol]||1e5)*1.08,i=(k,v,g)=>({key:k,value:v,signal:g});
  const d={movingAverages:{movingAveragesSummary:{buyCount:9,sellCount:4,neutralCount:0,signal:"BULLISH"},simpleIndicators:[i("SMA_50",L*.96,"BUY"),i("SMA_200",L*.88,"BUY")],exponentialIndicators:[]},
   oscillators:{oscillatorsSummary:{buyCount:3,sellCount:3,neutralCount:8,signal:"NEUTRAL"},indicators:[i("RSI_12",58.4,"NEUTRAL")]},
   supportAndResistance:{indicators:[{key:"R1",value:L*1.012},{key:"PP",value:L*1.0},{key:"S1",value:L*.985}]}};
  return tool.startsWith("indo")?{data:{...d,overallSummary:{buyCount:12,neutralCount:8,sellCount:7,signal:"BULLISH"}}}:{data:{indicators:d,summary:{buyCount:12,neutralCount:8,sellCount:7,signal:"BULLISH",description:"From the last 24 hours"}}};}
 if(tool==="indo_stocks_get_fundamentals")return{data:{fundamentals:{earnings:{lastUpdated:"Last updated on 28 Oct 2026"},overview:{data:[{key:"revenue",value:"Rp127.23T"},{key:"net_income",value:"Rp57.54T"},{key:"eps",value:"Rp466.74"}]},
  ratios:[{key:"valuation",fields:[{key:"pe",value:"11.41x"},{key:"pb",value:"2.33x"}]},{key:"profitability",fields:[{key:"npm",value:"45.22%"},{key:"roe",value:"20.44%"}]},{key:"solvency",fields:[{key:"de",value:"4.6%"}]},{key:"dividend",fields:[{key:"ttm",value:"6.12%"}]}]},
  financials:{yearly:{incomeStatement:{chart:[[2021,87.9,31.4],[2022,95.7,40.7],[2023,135.1,48.6],[2024,120.8,54.8],[2025,127.2,57.5]].map(([t,r,n])=>({timeframe:String(t),revenue:r*1e12,netProfitLoss:n*1e12}))}}}}};
 if(tool==="us_stocks_get_fundamentals")return{data:{fundamentals:{analystRatings:{buyPercentage:63.4,totalAnalystRatingCount:112},priceTarget:{targetHigh:400,targetLow:245,targetConsensus:341.94},
  earningsPerShare:{earnings:{actualEps:[2.01,2.02,2.05,null],expectedEps:[1.95,1.89,1.99,2.94],axisValues:["Mar 26","Jun 26","Sep 26","Dec 26"]}},
  overview:{data:[{key:"revenue",value:"$478.83B"},{key:"netIncome",value:"$132.18B"},{key:"eps",value:"9.01"}]},
  ratios:[{key:"valuation",fields:[{key:"pe",value:"38.81"},{key:"pb",value:"45.18"}]},{key:"profitability",fields:[{key:"npm",value:"27.6%"},{key:"roe",value:"142.26%"}]},{key:"solvency",fields:[{key:"debtToEquity",value:"0.71"}]},{key:"dividend",fields:[{key:"dividendYieldTTM",value:"0.31%"}]}]}}};
 if(/_get_ohlc$/.test(tool))return{data:ohlc(inp.symbol,inp.start)};
 if(tool==="us_stocks_get_price")return{marketStatus:{isMarketOpen:true},data:inp.symbols.map((s,i)=>({symbol:s,midPrice:150+i*40,prevClosePrice:148+i*41,lowPrice:146+i*40,highPrice:153+i*40}))};
 if(tool==="indo_stocks_get_price")return{data:inp.symbols.map((s,i)=>({symbol:s,lastPrice:4000+i*1150,prevClosePrice:3980+i*1170,stats:{turnover:"1,2T"}}))};
 if(tool==="portfolio_get_buying_power")return{usdToIdrRate:16350};
 if(tool==="portfolio_get_wallet_balance")return{data:{totals:{IDR:{amount:2500000},USD:{amount:120.5}}}};
 if(tool==="portfolio_get_holdings"){const it=(sym,name,q,v,c,pnl)=>({tileInfo:{displaySymbol:sym,name},display:{valueAndProfit:{totalQuantity:q,meta:{value:v,currency:c,profitValue:pnl,profitValuePercentage:pnl/v*100}}}});
  return{data:{reportedTotals:{netAssetValueIdr:48000000,unrealisedPnlIdr:3100000},assetCategories:[
  {assetCategory:"cryptocurrency",title:"Crypto",totalCount:2,assetCategoryData:[it("BTC","Bitcoin",0.012,20000000,"IDR",2100000),it("ETH","Ethereum",0.1,6000000,"IDR",-300000)]},
  {assetCategory:"global_equity",title:"US",totalCount:1,assetCategoryData:[it("AAPL","Apple Inc.",3,700,"USD",40)]},
  {assetCategory:"indo_stock",title:"IDX",totalCount:1,assetCategoryData:[it("BBCA","Bank Central Asia",5,4800000,"IDR",200000)]}]}}}
 return{};}
const mcp={callTool:async(s,t,i)=>({payload:pay(t,i)}),invalidate:async()=>{},watchTool:(s,t,i,cb)=>{setTimeout(()=>cb({type:"data",result:{payload:pay(t,i)}}),50);return()=>{}}};
window.claude={use:async()=>mcp};})();
